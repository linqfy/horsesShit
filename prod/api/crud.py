# backend/prod/api/crud.py

from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Dict
from . import schemas
from .models import *
from fastapi import HTTPException
from datetime import datetime, timedelta
from sqlalchemy.exc import SQLAlchemyError
import logging
import json
import os
from datetime import datetime, timedelta
import calendar
from datetime import datetime

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Configure SQLAlchemy logging to capture all related messages
sqlalchemy_logger = logging.getLogger("sqlalchemy")
sqlalchemy_logger.setLevel(logging.INFO)

engine_logger = logging.getLogger("sqlalchemy.engine")
engine_logger.setLevel(logging.INFO)

orm_logger = logging.getLogger("sqlalchemy.orm")
orm_logger.setLevel(logging.INFO)

# File handler configuration
file_handler = logging.FileHandler("app.log", encoding="utf-8")
file_handler.setLevel(logging.INFO)

formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
file_handler.setFormatter(formatter)

# Add the file handler to each logger if it doesn't have any handlers yet
if not logger.handlers:
    logger.addHandler(file_handler)

if not sqlalchemy_logger.handlers:
    sqlalchemy_logger.addHandler(file_handler)

if not engine_logger.handlers:
    engine_logger.addHandler(file_handler)

if not orm_logger.handlers:
    orm_logger.addHandler(file_handler)
# Añadir el file handler al logger si no existe aún


# Ajustar el nivel del logger para SQLAlchemy

# ----------------------
# Funciones Auxiliares
# ----------------------


def commit_session(session: Session):
    """
    Commits the current transaction if no transaction block
    is active; otherwise, flushes the session to push changes
    and lets the outer transaction control the commit.
    """
    try:
        if session.in_transaction() and session.get_transaction()._parent is not None:
            # Inside a nested transaction such as provided by `with session.begin()`
            session.flush()
        else:
            session.commit()
    except SQLAlchemyError as e:
        session.rollback()
        logger.error(f"Database error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

def add_and_refresh(session: Session, instance):
    session.add(instance)
    commit_session(session)
    session.refresh(instance)
    return instance




def calculate_due_date(
    base_date: datetime, installment_number: int, start_year: int, start_month: int
) -> datetime:
    # Calculate the total months to add (installment 1 is start_month)
    months_to_add = installment_number - 1
    total_months = start_month - 1 + months_to_add
    year_offset, month_offset = divmod(total_months, 12)
    new_month = month_offset + 1
    due_year = start_year + year_offset

    # Get the last day of the target month
    last_day = calendar.monthrange(due_year, new_month)[1]
    due_date = datetime(due_year, new_month, last_day)

    return due_date


EGRESO_PAYMENTS_FILE = "egreso_payments.json"

def _load_egreso_payments():
    if not os.path.exists(EGRESO_PAYMENTS_FILE):
        # Create the file if it doesn't exist
        with open(EGRESO_PAYMENTS_FILE, "w", encoding="utf-8") as f:
            json.dump({}, f)
        logger.debug(f"Created file {EGRESO_PAYMENTS_FILE}")
        return {}
    
    try:
        with open(EGRESO_PAYMENTS_FILE, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:  # Handle empty file
                logger.warning(f"Empty payment file found at {EGRESO_PAYMENTS_FILE}, initializing with empty dict")
                _save_egreso_payments({})
                return {}
            return json.loads(content)
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON in {EGRESO_PAYMENTS_FILE}, resetting file")
        _save_egreso_payments({})
        return {}

def _save_egreso_payments(data):
    with open(EGRESO_PAYMENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f)

def set_egreso_paid(egreso_id: int, user_id: int, paid: bool = True):
    data = _load_egreso_payments()
    key = f"{egreso_id}:{user_id}"
    data[key] = paid
    _save_egreso_payments(data)

def is_egreso_paid(egreso_id: int, user_id: int) -> bool:
    data = _load_egreso_payments()
    return data.get(f"{egreso_id}:{user_id}", False)

def mark_egreso_paid(egreso_id: int, user_id: int):
    set_egreso_paid(egreso_id, user_id, True)


def update_installment_status(buyer_installment: BuyerInstallment):
    if buyer_installment.amount_paid >= buyer_installment.amount:
        buyer_installment.status = PaymentStatus.PAID
    elif buyer_installment.amount_paid > 0:
        buyer_installment.status = PaymentStatus.PARTIAL
    else:
        buyer_installment.status = PaymentStatus.PENDING

def process_queued_transactions(db: Session):
    """
    Processes all queued transactions whose effective date has passed.
    This should be run at application startup.
    """
    # Find all PREMIO transactions with an effective date that has passed the 31-day waiting period
    now = datetime.utcnow()
    queued_transactions = (
        db.query(Transaction)
        .filter(
            Transaction.type == TransactionType.PREMIO,
            Transaction.fecha_de_efectividad.isnot(None),
            Transaction.fecha_de_efectividad + timedelta(days=31) <= now
        )
        .all()
    )
    
    logger.info(f"Found {len(queued_transactions)} queued transactions to process")
    
    # Process each transaction in its own transaction context
    for transaction in queued_transactions:
        try:
            # Use a regular transaction (not a savepoint/nested transaction)
            with db.begin():
                logger.info(f"Processing queued transaction {transaction.id}")
                process_transaction(transaction, db)
                # No need to call commit_session here as the context manager handles it
        except Exception as e:
            logger.error(f"Error processing queued transaction {transaction.id}: {str(e)}")
            # The context manager will automatically roll back on exception

def _create_installments_for_horse(horse: Horse, db: Session) -> None:
    try:
        for i in range(1, horse.number_of_installments + 1):
            due_date = calculate_due_date(
                horse.creation_date, i, start_month=horse.starting_billing_month+1, start_year=horse.starting_billing_year
            )
            installment = Installment(
                horse_id=horse.id,
                due_date=due_date,
                amount=round(horse.total_value / horse.number_of_installments, 2),
                installment_number=i,
                mes=due_date.month,
                año=due_date.year,
            )
            db.add(installment)
            db.flush()

            for horse_buyer in horse.buyers:
                buyer_amount = round(
                    (horse.total_value / horse.number_of_installments)
                    * (horse_buyer.percentage / 100),
                    2
                )
                buyer_installment = BuyerInstallment(
                    horse_buyer_id=horse_buyer.id,
                    installment_id=installment.id,
                    amount=buyer_amount,
                    amount_paid=0.0,
                    status=PaymentStatus.PENDING,
                    mes=due_date.month,
                    año=due_date.year
                )
                db.add(buyer_installment)
        logger.debug(f"Installments created for Horse ID {horse.id}")
    except SQLAlchemyError as e:
        logger.error(f"Error al crear cuotas: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al crear cuotas: {str(e)}")


def create_horse_with_buyers(db: Session, **horse_data) -> Horse:
    """
    Crea un caballo con sus compradores y cuotas iniciales.
    """
    try:
        return _create_horse_with_buyers(
            session=db,
            name=horse_data.get("name"),
            total_value=horse_data.get("total_value"),
            number_of_installments=horse_data.get("number_of_installments"),
            buyers_data=horse_data.get("buyers_data"),
            information=horse_data.get("information"),
            image_url=horse_data.get("image_url"),
            starting_billing_month=horse_data.get("starting_billing_month"),
            starting_billing_year=horse_data.get("starting_billing_year"),
        )
    except HTTPException as e:
        raise e
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


def _create_horse_with_buyers(
    starting_billing_month: int,
    starting_billing_year: int,
    session: Session,
    name: str,
    total_value: float,
    number_of_installments: int,
    buyers_data: List[dict],
    information: str = None,
    image_url: str = None,
) -> Horse:
    """
    Crea un caballo con sus compradores y cuotas iniciales.
    """
    logger.debug("Creando caballo con compradores")

    # Validar porcentajes
    total_percentage = sum(buyer["percentage"] for buyer in buyers_data)
    if abs(total_percentage - 100) > 0.01:
        logger.error("La suma de los porcentajes no es 100%")
        raise ValueError("La suma de los porcentajes debe ser 100%")

    try:
        with session.begin():  # Maneja la transacción completa
            # Crear caballo
            horse = Horse(
                starting_billing_month=starting_billing_month,
                starting_billing_year=starting_billing_year,
                name=name,
                total_value=total_value,
                number_of_installments=number_of_installments,
                total_percentage=total_percentage,
                information=information,
                image_url=image_url,
            )
            session.add(horse)
            session.flush()

            # Crear compradores
            for buyer_data in buyers_data:
                horse_buyer = HorseBuyer(
                    horse=horse,
                    buyer_id=buyer_data["buyer_id"],
                    percentage=buyer_data["percentage"],
                )
                session.add(horse_buyer)

            # Crear cuotas
            if number_of_installments > 0:
                _create_installments_for_horse(horse, session)

        session.refresh(horse)
        logger.debug(f"Horse creado con ID {horse.id}")
        return horse
    except SQLAlchemyError as e:
        logger.error(f"Error creando caballo con compradores: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Error al crear el caballo con compradores"
        )
    except ValueError as ve:
        logger.error(f"Validación fallida al crear caballo: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))


def distribute_prize(transaction: Transaction, session: Session, reccomitted=False):
    # Calculate the effective date (actual effective application date is queued)
    effective_date = transaction.fecha_de_efectividad + timedelta(days=31)
    
    # Only apply distribution if the effective date has been reached; otherwise, queue it.
    if datetime.utcnow() < effective_date:
        logger.info(f"Transaction {transaction.id} is queued until effective date {effective_date}")
        # The transaction is queued - will be processed later by process_queued_transactions
        return
    
    # Effective date has passed, process the transaction now
    horse = transaction.horse
    for horse_buyer in horse.buyers:
        buyer_amount = round(transaction.total_amount * (horse_buyer.percentage / 100), 2)
        # Register the credit for the corresponding month
        user_instance = session.query(User).filter(User.id == horse_buyer.buyer_id).first()
        if user_instance:
            user_instance.balance += buyer_amount
    if reccomitted:
        commit_session(session)

def distribute_expense(transaction: Transaction, session: Session):
    horse = transaction.horse
    logger.debug(f"Distributing expense for horse {horse.id} among buyers.")
    for horse_buyer in horse.buyers:
        expense_amount = round(transaction.total_amount * (horse_buyer.percentage / 100), 2)
        user_instance = session.query(User).filter(User.id == horse_buyer.buyer_id).first()
        if user_instance:
            user_instance.balance -= expense_amount
            set_egreso_paid(transaction.id, user_instance.id, True)
        logger.debug(
            f"Deducted {expense_amount} from buyer {horse_buyer.buyer_id}, new balance: {horse_buyer.balance}"
        )
    commit_session(session)
    for horse_buyer in horse.buyers:
        user = horse_buyer.buyer
        user.update_total_balance()
    commit_session(session)


def distribute_income_payment(transaction: Transaction, session: Session, recommitted=False):
    user_tt = transaction.user_id
    horse_tt = transaction.horse_id

    # get a horse buyer with matching user and horse
    user_tt = (
        session.query(HorseBuyer)
        .filter(HorseBuyer.buyer_id == user_tt, HorseBuyer.horse_id == horse_tt)
        .first()
    )
    if not user_tt:
        raise ValueError("El usuario no es comprador del caballo")
    
    user_tt.balance += transaction.total_amount

    logger.debug(
        f"Updated user balance for user {user_tt.id}: {user_tt.balance}, total: {transaction.total_amount}"
    )
    if recommitted:
        commit_session(session)


def process_income(transaction: Transaction, session: Session, recommitted=False):
    logger.debug(f"Processing income transaction: {transaction.id}")
    if transaction.type == TransactionType.INGRESO:
        distribute_income_payment(transaction, session, recommitted)
    elif transaction.type == TransactionType.PREMIO:
        distribute_prize(transaction, session)
    if recommitted:
        commit_session(session)


def get_pending_buyer_installments(horse: Horse, session: Session):
    return (
        session.query(BuyerInstallment)
        .join(Installment)
        .filter(
            Installment.horse_id == horse.id,
            BuyerInstallment.status != PaymentStatus.PAID,
        )
        .all()
    )


def process_transaction(transaction: Transaction, session: Session, recommitted=False):
    try:
        if transaction.type in [TransactionType.INGRESO, TransactionType.PREMIO]:
            process_income(transaction, session, recommitted)
        elif transaction.type == TransactionType.EGRESO:
            distribute_expense(transaction, session)
        elif transaction.type == TransactionType.PAGO:
            pass
        else:
            raise ValueError("Tipo de transacción desconocido")
    except SQLAlchemyError as e:
        session.rollback()
        logger.error(f"Error procesando transacción {transaction.id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error procesando la transacción")
    except ValueError as ve:
        session.rollback()
        logger.error(f"Validación fallida en transacción {transaction.id}: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))


def recalculate_installments(db: Session, horse: Horse) -> None:
    try:
        installments = db.query(Installment).filter(Installment.horse_id == horse.id).all()
        for installment in installments:
            # Get existing buyer installments for this installment, keyed by horse_buyer_id
            existing_buyer_installments = {
                bi.horse_buyer_id: bi for bi in db.query(BuyerInstallment)
                .filter(BuyerInstallment.installment_id == installment.id)
                .all()
            }
            if installment.due_date < datetime.utcnow():
                continue

            for horse_buyer in horse.buyers:
                buyer_amount = round(installment.amount * (horse_buyer.percentage / 100), 2)
                if horse_buyer.id in existing_buyer_installments:
                    # Update the existing record but preserve the previous amount_paid
                    buyer_installment = existing_buyer_installments[horse_buyer.id]
                    buyer_installment.amount = buyer_amount
                    update_installment_status(buyer_installment)
                    # Remove so that remaining installments can be deleted later
                    del existing_buyer_installments[horse_buyer.id]
                else:
                    # Create new buyer installment if not existing
                    buyer_installment = BuyerInstallment(
                        horse_buyer_id=horse_buyer.id,
                        installment_id=installment.id,
                        amount=buyer_amount,
                        amount_paid=0.0,
                        status=PaymentStatus.PENDING,
                    )
                    db.add(buyer_installment)

            # Delete any buyer installments that no longer correspond to current buyers
            for extra in existing_buyer_installments.values():
                db.delete(extra)

        commit_session(db)
        logger.debug(f"Cuotas recalculadas para Horse ID {horse.id}")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al recalcular cuotas: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al recalcular cuotas: {str(e)}"
        )


# ----------------------
# Validaciones
# ----------------------


def validate_horse_buyers(buyers_data: List[Dict]) -> None:
    if not buyers_data:
        raise ValueError("Se requiere al menos un comprador")
    total_percentage = sum(buyer["percentage"] for buyer in buyers_data)
    if abs(total_percentage - 100) > 0.01:
        raise ValueError("La suma de los porcentajes debe ser 100%")


# ----------------------
# CRUD para Usuarios
# ----------------------


def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    return db.query(User).offset(skip).limit(limit).all()


def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, user: schemas.UserCreateSchema) -> User:
    db_user = User(**user.dict())
    return add_and_refresh(db, db_user)


def update_user(db: Session, user: User, user_update: schemas.UserUpdateSchema) -> User:
    for key, value in user_update.dict(exclude_unset=True).items():
        setattr(user, key, value)
    return add_and_refresh(db, user)


def delete_user(db: Session, user_id: int) -> bool:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    db.delete(user)
    commit_session(db)
    logger.debug(f"Usuario eliminado con ID {user_id}")
    return True


# ----------------------
# CRUD para Compradores de Caballo
# ----------------------


def get_horse_buyers(db: Session, skip: int = 0, limit: int = 100) -> List[HorseBuyer]:
    return db.query(HorseBuyer).offset(skip).limit(limit).all()


def get_horse_buyer(db: Session, horse_buyer_id: int) -> Optional[HorseBuyer]:
    return db.query(HorseBuyer).filter(HorseBuyer.id == horse_buyer_id).first()


def create_horse_buyer(
    db: Session, horse_buyer: schemas.HorseBuyerCreateSchema
) -> HorseBuyer:
    total_percentage = (
        db.query(func.sum(HorseBuyer.percentage))
        .filter(HorseBuyer.horse_id == horse_buyer.horse_id)
        .scalar()
        or 0.0
    )
    if total_percentage + horse_buyer.percentage > 100.0:
        raise HTTPException(
            status_code=400, detail="La suma de porcentajes excede el 100%"
        )
    db_horse_buyer = HorseBuyer(
        horse_id=horse_buyer.horse_id,
        buyer_id=horse_buyer.buyer_id,
        percentage=horse_buyer.percentage,
        active=horse_buyer.active,
    )
    return add_and_refresh(db, db_horse_buyer)


def update_horse_buyer(
    db: Session,
    horse_buyer: HorseBuyer,
    horse_buyer_update: schemas.HorseBuyerUpdateSchema,
) -> HorseBuyer:
    for key, value in horse_buyer_update.dict(exclude_unset=True).items():
        setattr(horse_buyer, key, value)
    return add_and_refresh(db, horse_buyer)


def delete_horse_buyer(db: Session, horse_buyer_id: int) -> bool:
    horse_buyer = db.query(HorseBuyer).filter(HorseBuyer.id == horse_buyer_id).first()
    if horse_buyer is None:
        return False
    try:
        db.query(BuyerInstallment).filter(
            BuyerInstallment.horse_buyer_id == horse_buyer_id
        ).delete(synchronize_session=False)
        db.delete(horse_buyer)
        commit_session(db)
        logger.debug(f"HorseBuyer eliminado con ID {horse_buyer_id}")
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error eliminando HorseBuyer: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error eliminando HorseBuyer: {str(e)}"
        )


# ----------------------
# CRUD para Transacciones
# ----------------------


def get_transactions(db: Session, skip: int = 0, limit: int = 100) -> List[Transaction]:
    return db.query(Transaction).offset(skip).limit(limit).all()


def get_transaction(db: Session, transaction_id: int) -> Optional[Transaction]:
    return db.query(Transaction).filter(Transaction.id == transaction_id).first()


def create_transaction(
    db: Session, transaction: schemas.TransactionCreateSchema
) -> Transaction:
    return add_and_refresh(db, Transaction(**transaction.dict()))


def update_transaction(
    db: Session,
    transaction: Transaction,
    transaction_update: schemas.TransactionUpdateSchema,
    revert_original: bool = False
) -> Transaction:
    """
    Updates a transaction and optionally reverts its original financial effects.

    Args:
        db (Session): Database session.
        transaction (Transaction): The original transaction to update.
        transaction_update (schemas.TransactionUpdateSchema): The updated transaction data.
        revert_original (bool): Whether to revert the original transaction's financial effects.

    Returns:
        Transaction: The updated transaction.
    """
    if revert_original:
        # Reverse original financial effects
        if transaction.type == TransactionType.PREMIO:
            effective_date = transaction.fecha_de_efectividad + timedelta(days=31)
            if datetime.utcnow() >= effective_date:
                for horse_buyer in transaction.horse.buyers:
                    amount = round(transaction.total_amount * (horse_buyer.percentage / 100), 2)
                    horse_buyer.balance -= amount
                    horse_buyer.buyer.balance -= amount
        elif transaction.type == TransactionType.INGRESO:
            transaction.user.balance -= transaction.total_amount
            for horse_buyer in transaction.horse.buyers:
                if horse_buyer.buyer_id == transaction.user_id:
                    horse_buyer.balance -= transaction.total_amount
                    horse_buyer.buyer.balance -= transaction.total_amount
        elif transaction.type == TransactionType.EGRESO:
            for horse_buyer in transaction.horse.buyers:
                amount = round(transaction.total_amount * (horse_buyer.percentage / 100), 2)
                horse_buyer.balance += amount
                horse_buyer.buyer.balance += amount

    # Apply updates to the transaction
    for key, value in transaction_update.dict(exclude_unset=True).items():
        setattr(transaction, key, value)

    # Save Egreso payment status in JSON if updated
    values = transaction_update.dict(exclude_unset=True)
    if transaction.type == TransactionType.EGRESO and 'pagado' in values and 'user_id' in values:
        print(f"Setting Egreso payment status for transaction {transaction.id} to {values['pagado']} (value: {values['user_id']})")
        logger.debug(f"Setting Egreso payment status for transaction {transaction.id} to {values['pagado']} (value: {values['user_id']})")
        set_egreso_paid(transaction.id, values['user_id'], bool(values['pagado']))

    # Process the updated transaction to apply new financial effects
    process_transaction(transaction, db)

    return add_and_refresh(db, transaction)


def delete_transaction(db: Session, transaction_id: int) -> bool:
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        return False
    try:
        # Reverse balance effects
        if transaction.type == TransactionType.PREMIO:
            effective_date = transaction.fecha_de_efectividad + timedelta(days=31)
            if datetime.utcnow() >= effective_date:
                for horse_buyer in transaction.horse.buyers:
                    amount = round(transaction.total_amount * (horse_buyer.percentage / 100), 2)
                    horse_buyer.balance -= amount
                    horse_buyer.buyer.balance -= amount
        elif transaction.type == TransactionType.INGRESO:
            transaction.user.balance -= transaction.total_amount
            for horse_buyer in transaction.horse.buyers:
                if horse_buyer.buyer_id == transaction.user_id:
                    horse_buyer.balance -= transaction.total_amount
                    horse_buyer.buyer.balance -= amount
        elif transaction.type == TransactionType.EGRESO:
            for horse_buyer in transaction.horse.buyers:
                amount = round(transaction.total_amount * (horse_buyer.percentage / 100), 2)
                horse_buyer.balance += amount
                horse_buyer.buyer.balance += amount
        logger.debug(f"Transaction ID {transaction_id} deleted. INFO: ({transaction.type}) {transaction.total_amount}")
        db.delete(transaction)
        commit_session(db)
        return True
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting transaction: {str(e)}")


# ----------------------
# Funciones de Pago y Balance
# ----------------------


def process_payment(
    buyer_installment: BuyerInstallment,
    session: Session,
    payment_amount: float,
    deduct_from_balance: bool
):
    if buyer_installment.status == PaymentStatus.PAID:
        logger.warning(
            f"Attempted to pay an already paid installment ID {buyer_installment.id}"
        )
        raise HTTPException(status_code=400, detail="Installment already paid")

    remaining = buyer_installment.amount - buyer_installment.amount_paid
    if payment_amount > remaining:
        logger.warning(
            f"Payment amount {payment_amount} exceeds the remaining {remaining} for installment ID {buyer_installment.id}"
        )
        raise HTTPException(
            status_code=400,
            detail="Payment amount exceeds the remaining balance"
        )

    buyer_installment.amount_paid += payment_amount
    update_installment_status(buyer_installment)
    commit_session(session)
    logger.debug(
        f"Installment ID {buyer_installment.id} updated; amount paid is now {buyer_installment.amount_paid}"
    )

    if deduct_from_balance:
        horse_buyer = buyer_installment.horse_buyer
        user_instance = session.query(User).filter(User.id == horse_buyer.buyer_id).first()
        if user_instance:
            user_instance.balance += payment_amount
        logger.debug(
            f"Deducted {payment_amount} from buyer {horse_buyer.buyer_id}, new balance: {horse_buyer.balance}"
        )
        user = horse_buyer.buyer
        user.update_total_balance()
        commit_session(session)


def get_user_balance_detail(user_id: int, session: Session) -> dict:
    buyer_balance_details = [
        {"horse_id": buyer.horse_id, "balance": buyer.balance}
        for buyer in session.query(HorseBuyer)
        .filter(HorseBuyer.buyer_id == user_id)
        .all()
    ]
    if not buyer_balance_details:
        raise ValueError("Usuario no tiene HorseBuyers asociados")
    return {
        "current_balance": session.query(User.balance)
        .filter(User.id == user_id)
        .scalar()
        or 0.0,
        "pending_installments": get_pending_installments_amount(user_id, session),
        "total_paid": get_total_paid_amount(user_id, session),
        "horse_balances": buyer_balance_details,
    }


def get_total_paid_amount(buyer_id: int, session: Session) -> float:
    return (
        session.query(func.sum(InstallmentPayment.amount))
        .join(BuyerInstallment)
        .join(HorseBuyer)
        .filter(HorseBuyer.buyer_id == buyer_id)
        .scalar()
        or 0.0
    )


def get_pending_installments_amount(buyer_id: int, session: Session) -> float:
    return (
        session.query(func.sum(BuyerInstallment.amount - BuyerInstallment.amount_paid))
        .join(HorseBuyer)
        .filter(
            HorseBuyer.buyer_id == buyer_id,
            BuyerInstallment.status.in_([PaymentStatus.PENDING, PaymentStatus.PARTIAL]),
        )
        .scalar()
        or 0.0
    )


# ----------------------
# CRUD para Caballos
# ----------------------


def get_horses(db: Session, skip: int = 0, limit: int = 100) -> List[Horse]:
    return db.query(Horse).offset(skip).limit(limit).all()


def get_horse(db: Session, horse_id: int) -> Optional[Horse]:
    return (
        db.query(Horse)
        .options(
            joinedload(Horse.buyers),
            joinedload(Horse.transactions),
            joinedload(Horse.installments).joinedload(Installment.buyer_installments),
        )
        .filter(Horse.id == horse_id)
        .first()
    )


def update_horse(
    db: Session, horse: Horse, horse_update: schemas.HorseUpdateSchema
) -> Horse:
    try:
        # Use a nested transaction to avoid "a transaction is already begun" error.
        with db.begin_nested():
            for key, value in horse_update.dict(exclude_unset=True).items():
                if key != "buyers_data":
                    setattr(horse, key, value)
            if "buyers_data" in horse_update.dict(exclude_unset=True):
                buyers_data = horse_update.buyers_data
                validate_horse_buyers(buyers_data)
                existing_buyers = (
                    db.query(HorseBuyer).filter(HorseBuyer.horse_id == horse.id).all()
                )
                for buyer in existing_buyers:
                    db.query(BuyerInstallment).filter(
                        BuyerInstallment.horse_buyer_id == buyer.id
                    ).delete(synchronize_session=False)
                    db.delete(buyer)
                for buyer_data in buyers_data:
                    horse_buyer = HorseBuyer(
                        horse_id=horse.id,
                        buyer_id=buyer_data["buyer_id"],
                        percentage=buyer_data["percentage"],
                    )
                    db.add(horse_buyer)
                recalculate_installments(db, horse)
        db.refresh(horse)
        logger.debug(f"Caballo actualizado con ID {horse.id}")
        return horse
    except SQLAlchemyError as e:
        logger.error(f"Error al actualizar el caballo: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al actualizar el caballo: {str(e)}"
        )
    except ValueError as ve:
        logger.error(f"Validación fallida al actualizar caballo: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))


def delete_horse(db: Session, horse_id: int) -> bool:
    horse = db.query(Horse).filter(Horse.id == horse_id).first()
    if not horse:
        logger.info(f"No se encontró el caballo con ID {horse_id}")
        return False
    try:
        with db.begin_nested():
            db.query(BuyerInstallment).filter(
                BuyerInstallment.installment_id.in_(
                    db.query(Installment.id).filter(Installment.horse_id == horse_id)
                )
            ).delete(synchronize_session=False)
            db.query(Installment).filter(Installment.horse_id == horse_id).delete(
                synchronize_session=False
            )
            db.query(Transaction).filter(Transaction.horse_id == horse_id).delete(
                synchronize_session=False
            )
            db.query(HorseBuyer).filter(HorseBuyer.horse_id == horse_id).delete(
                synchronize_session=False
            )
            db.delete(horse)
        logger.debug(f"Caballo eliminado con ID {horse_id}")
        return True
    except SQLAlchemyError as e:
        logger.error(f"Error al eliminar el caballo: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al eliminar el caballo: {str(e)}"
        )


def get_installment(db: Session, installment_id: int) -> Optional[Installment]:
    return db.query(Installment).filter(Installment.id == installment_id).first()
