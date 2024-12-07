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

# Configuración del logger
logger = logging.getLogger(__name__)

# ----------------------
# Funciones Auxiliares
# ----------------------


def commit_session(session: Session):
    try:
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
    base_date: datetime, installment_number: int, start_month: int
) -> datetime:
    year_offset, month_offset = divmod(start_month - 1 + installment_number, 12)
    new_month = (month_offset % 12) + 1
    return base_date.replace(
        year=base_date.year + year_offset, month=new_month, day=base_date.day
    )


def update_installment_status(buyer_installment: BuyerInstallment):
    if buyer_installment.amount_paid >= buyer_installment.amount:
        buyer_installment.status = PaymentStatus.PAID
    elif buyer_installment.amount_paid > 0:
        buyer_installment.status = PaymentStatus.PARTIAL
    else:
        buyer_installment.status = PaymentStatus.PENDING


def _create_installments_for_horse(horse: Horse, db: Session) -> None:
    try:
        for i in range(1, horse.number_of_installments + 1):
            due_date = calculate_due_date(
                horse.creation_date, i, horse.starting_billing_month
            )
            installment = Installment(
                horse_id=horse.id,
                due_date=due_date,
                amount=horse.total_value / horse.number_of_installments,
                installment_number=i,
                mes=due_date.month,
                año=due_date.year,
            )
            db.add(installment)
            db.flush()

            for horse_buyer in horse.buyers:
                buyer_amount = (horse.total_value / horse.number_of_installments) * (
                    horse_buyer.percentage / 100
                )
                buyer_installment = BuyerInstallment(
                    horse_buyer_id=horse_buyer.id,
                    installment_id=installment.id,
                    amount=buyer_amount,
                    amount_paid=0.0,
                    status=PaymentStatus.PENDING,
                )
                db.add(buyer_installment)
        logger.debug(f"Installments created for Horse ID {horse.id}")
    except SQLAlchemyError as e:
        logger.error(f"Error al crear cuotas: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al crear cuotas: {str(e)}")


def distribute_prize(transaction: Transaction, session: Session):
    horse = transaction.horse
    logger.debug(f"Distributing prize for horse {horse.id} among buyers.")
    for horse_buyer in horse.buyers:
        buyer_amount = transaction.total_amount * (horse_buyer.percentage / 100)
        horse_buyer.buyer.balance += buyer_amount
        logger.debug(
            f"Updated balance for buyer {horse_buyer.buyer_id}: {horse_buyer.balance}"
        )
    commit_session(session)
    for horse_buyer in horse.buyers:
        user = horse_buyer.buyer
        user.update_total_balance()
    commit_session(session)


def distribute_expense(transaction: Transaction, session: Session):
    horse = transaction.horse
    logger.debug(f"Distributing expense for horse {horse.id} among buyers.")
    for horse_buyer in horse.buyers:
        expense_amount = transaction.total_amount * (horse_buyer.percentage / 100)
        horse_buyer.buyer.balance -= expense_amount
        logger.debug(
            f"Deducted {expense_amount} from buyer {horse_buyer.buyer_id}, new balance: {horse_buyer.balance}"
        )
    commit_session(session)
    for horse_buyer in horse.buyers:
        user = horse_buyer.buyer
        user.update_total_balance()
    commit_session(session)


def distribute_income_payment(transaction: Transaction, session: Session):
    user_tt = transaction.user
    user_tt.balance += transaction.total_amount
    logger.debug(
        f"Updated user balance for user {user_tt.id}: {user_tt.balance}, total: {transaction.total_amount}"
    )
    commit_session(session)


def process_income(transaction: Transaction, session: Session):
    logger.debug(f"Processing income transaction: {transaction.id}")
    if transaction.type == TransactionType.INGRESO:
        distribute_income_payment(transaction, session)
    elif transaction.type == TransactionType.PREMIO:
        distribute_prize(transaction, session)
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


def process_transaction(transaction: Transaction, session: Session):
    try:
        if transaction.type in [TransactionType.INGRESO, TransactionType.PREMIO]:
            process_income(transaction, session)
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
        installments = (
            db.query(Installment).filter(Installment.horse_id == horse.id).all()
        )
        for installment in installments:
            db.query(BuyerInstallment).filter(
                BuyerInstallment.installment_id == installment.id
            ).delete(synchronize_session=False)
            for horse_buyer in horse.buyers:
                buyer_amount = installment.amount * (horse_buyer.percentage / 100)
                buyer_installment = BuyerInstallment(
                    horse_buyer_id=horse_buyer.id,
                    installment_id=installment.id,
                    amount=buyer_amount,
                    amount_paid=0.0,
                    status=PaymentStatus.PENDING,
                )
                db.add(buyer_installment)
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
    with db.begin():
        db.query(BuyerInstallment).filter(
            BuyerInstallment.horse_buyer_id == horse_buyer_id
        ).delete(synchronize_session=False)
        db.delete(horse_buyer)
    logger.debug(f"HorseBuyer eliminado con ID {horse_buyer_id}")
    return True


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
) -> Transaction:
    for key, value in transaction_update.dict(exclude_unset=True).items():
        setattr(transaction, key, value)
    return add_and_refresh(db, transaction)


def delete_transaction(db: Session, transaction_id: int) -> bool:
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        return False
    with db.begin():
        db.delete(transaction)
    logger.debug(f"Transacción eliminada con ID {transaction_id}")
    return True


# ----------------------
# Funciones de Pago y Balance
# ----------------------


def process_payment(buyer_installment: BuyerInstallment, session: Session):
    if buyer_installment.status == PaymentStatus.PAID:
        logger.warning(
            f"Attempted to pay an already paid installment ID {buyer_installment.id}"
        )
        raise HTTPException(status_code=400, detail="Installment already paid")
    remaining_amount = buyer_installment.amount - buyer_installment.amount_paid
    buyer_installment.amount_paid += remaining_amount
    update_installment_status(buyer_installment)
    commit_session(session)
    logger.debug(f"Installment ID {buyer_installment.id} marked as PAID")
    horse_buyer = buyer_installment.horse_buyer
    horse_buyer.balance -= remaining_amount
    logger.debug(
        f"Deducted {remaining_amount} from buyer {horse_buyer.buyer_id}, new balance: {horse_buyer.balance}"
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
        with db.begin():
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
        return False
    try:
        with db.begin():
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
