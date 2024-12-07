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


def calculate_due_date(
    base_date: datetime, installment_number: int, start_month: int
) -> datetime:
    """
    Calcula la fecha de vencimiento de una cuota.
    Ajusta el mes basado en la cuota y el mes inicial de facturación.
    """
    year_offset, month_offset = divmod(start_month - 1 + installment_number, 12)
    new_month = (month_offset % 12) + 1
    return base_date.replace(
        year=base_date.year + year_offset, month=new_month, day=base_date.day
    )


def update_installment_status(buyer_installment: BuyerInstallment):
    """Actualiza el estado de una cuota según los pagos realizados."""
    if buyer_installment.amount_paid >= buyer_installment.amount:
        buyer_installment.status = PaymentStatus.PAID
    elif buyer_installment.amount_paid > 0:
        buyer_installment.status = PaymentStatus.PARTIAL
    else:
        buyer_installment.status = PaymentStatus.PENDING


def _create_installments_for_horse(horse: Horse, db: Session) -> None:
    """
    Crea las cuotas (Installments) para un caballo y las Buyer Installments para cada comprador.
    """
    try:
        for i in range(1, horse.number_of_installments + 1):
            due_month = (horse.starting_billing_month + i - 1) % 12 + 1
            due_year = (
                datetime.now().year + (horse.starting_billing_month + i - 1) // 12
            )
            due_date = datetime(due_year, due_month, 1)

            # Calcular la fecha de vencimiento usando el mes inicial de facturación
            due_date = calculate_due_date(
                horse.creation_date, i, horse.starting_billing_month
            )

            # Crear la cuota
            installment = Installment(
                horse_id=horse.id,
                due_date=due_date,
                amount=horse.total_value / horse.number_of_installments,
                installment_number=i,
                mes=due_month,
                año=due_year,
            )
            db.add(installment)
            db.flush()  # Asegura que installment.id esté disponible

            # Crear Buyer Installments para cada comprador
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
        # No se realiza commit aquí
        logger.debug(f"Installments created for Horse ID {horse.id}")
    except SQLAlchemyError as e:
        logger.error(f"Error al crear cuotas: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al crear cuotas: {str(e)}")


def distribute_prize(transaction: Transaction, session: Session):
    """Distribuye un premio entre los compradores según su porcentaje."""
    horse = transaction.horse
    logger.debug(f"Distributing prize for horse {horse.id} among buyers.")
    for horse_buyer in horse.buyers:
        buyer_amount = transaction.total_amount * (horse_buyer.percentage / 100)
        horse_buyer.buyer.balance += buyer_amount
        logger.debug(
            f"Updated balance for buyer {horse_buyer.buyer_id}: {horse_buyer.balance}"
        )
    session.commit()
    # Actualizar balance total del usuario
    for horse_buyer in horse.buyers:
        user = horse_buyer.buyer
        user.update_total_balance()
    session.commit()


def distribute_expense(transaction: Transaction, session: Session):
    """Distribuye un gasto entre los compradores según su porcentaje."""
    horse = transaction.horse
    logger.debug(f"Distributing expense for horse {horse.id} among buyers.")
    for horse_buyer in horse.buyers:
        expense_amount = transaction.total_amount * (horse_buyer.percentage / 100)
        horse_buyer.buyer.balance -= expense_amount
        logger.debug(
            f"Deducted {expense_amount} from buyer {horse_buyer.buyer_id}, new balance: {horse_buyer.balance}"
        )
    session.commit()
    # Actualizar balance total del usuario
    for horse_buyer in horse.buyers:
        user = horse_buyer.buyer
        user.update_total_balance()
    session.commit()


def distribute_income_payment(transaction: Transaction, session: Session):
    """Ingresa el monto directamente al balance del usuario."""
    user_tt = transaction.user
    user_tt.balance += transaction.total_amount
    logger.debug(
        f"Updated user balance for user {user_tt.id}: {user_tt.balance}, total: {transaction.total_amount}"
    )
    session.commit()


def process_income(transaction: Transaction, session: Session):
    """Procesa una transacción de tipo INGRESO o PREMIO."""
    logger.debug(f"Processing income transaction: {transaction.id}")
    if transaction.type == TransactionType.INGRESO:
        distribute_income_payment(transaction, session)
    elif transaction.type == TransactionType.PREMIO:
        distribute_prize(transaction, session)
    session.commit()


def get_pending_buyer_installments(horse: Horse, session: Session):
    """Obtiene las cuotas pendientes de pago de un caballo."""
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
    """Procesa una transacción según su tipo."""
    try:
        if transaction.type in [TransactionType.INGRESO, TransactionType.PREMIO]:
            process_income(transaction, session)
        elif transaction.type == TransactionType.EGRESO:
            distribute_expense(transaction, session)
        elif transaction.type == TransactionType.PAGO:
            # PAGO se maneja de forma diferente, posiblemente en otro endpoint
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
    """
    Recalcula las cuotas para todos los compradores de un caballo.
    """
    try:
        installments = (
            db.query(Installment).filter(Installment.horse_id == horse.id).all()
        )

        for installment in installments:
            # Eliminar cuotas existentes para compradores
            db.query(BuyerInstallment).filter(
                BuyerInstallment.installment_id == installment.id
            ).delete(synchronize_session=False)

            # Crear nuevas cuotas para cada comprador
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
        db.commit()
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
    """
    Valida los datos de los compradores del caballo antes de la creación/actualización.
    """
    if not buyers_data:
        raise ValueError("Se requiere al menos un comprador")

    total_percentage = sum(buyer["percentage"] for buyer in buyers_data)
    if abs(total_percentage - 100) > 0.01:
        raise ValueError("La suma de los porcentajes debe ser 100%")


# ----------------------
# CRUD para Usuarios
# ----------------------


def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    """
    Obtener una lista de usuarios con paginación.
    """
    return db.query(User).offset(skip).limit(limit).all()


def get_user(db: Session, user_id: int) -> Optional[User]:
    """
    Obtener un usuario por su ID.
    """
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """
    Obtener un usuario por su correo electrónico.
    """
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, user: schemas.UserCreateSchema) -> User:
    """
    Crear un nuevo usuario.
    """
    db_user = User(**user.dict())
    db.add(db_user)
    try:
        db.commit()
        db.refresh(db_user)
        logger.debug(f"Usuario creado con ID {db_user.id}")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear el usuario: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al crear el usuario: {str(e)}"
        )
    return db_user


def update_user(db: Session, user: User, user_update: schemas.UserUpdateSchema) -> User:
    """
    Actualizar un usuario existente.
    """
    for key, value in user_update.dict(exclude_unset=True).items():
        setattr(user, key, value)
    try:
        db.commit()
        db.refresh(user)
        logger.debug(f"Usuario actualizado con ID {user.id}")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar el usuario: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al actualizar el usuario: {str(e)}"
        )
    return user


def delete_user(db: Session, user_id: int) -> bool:
    """
    Eliminar un usuario.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    db.delete(user)
    try:
        db.commit()
        logger.debug(f"Usuario eliminado con ID {user_id}")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al eliminar el usuario: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al eliminar el usuario: {str(e)}"
        )
    return True


# ----------------------
# CRUD para Compradores de Caballo
# ----------------------


def get_horse_buyers(db: Session, skip: int = 0, limit: int = 100) -> List[HorseBuyer]:
    """
    Obtener una lista de compradores de caballo con paginación.
    """
    return db.query(HorseBuyer).offset(skip).limit(limit).all()


def get_horse_buyer(db: Session, horse_buyer_id: int) -> Optional[HorseBuyer]:
    """
    Obtener un comprador de caballo por su ID.
    """
    return db.query(HorseBuyer).filter(HorseBuyer.id == horse_buyer_id).first()


def create_horse_buyer(
    db: Session, horse_buyer: schemas.HorseBuyerCreateSchema
) -> HorseBuyer:
    """
    Crear un nuevo comprador de caballo.
    """
    # Validar que la suma de porcentajes no exceda 100%
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
    db.add(db_horse_buyer)
    try:
        db.commit()
        db.refresh(db_horse_buyer)
        logger.debug(f"HorseBuyer creado con ID {db_horse_buyer.id}")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear HorseBuyer: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al crear HorseBuyer: {str(e)}"
        )
    return db_horse_buyer


def update_horse_buyer(
    db: Session,
    horse_buyer: HorseBuyer,
    horse_buyer_update: schemas.HorseBuyerUpdateSchema,
) -> HorseBuyer:
    """
    Actualizar un comprador de caballo existente.
    """
    for key, value in horse_buyer_update.dict(exclude_unset=True).items():
        setattr(horse_buyer, key, value)
    try:
        db.commit()
        db.refresh(horse_buyer)
        logger.debug(f"HorseBuyer actualizado con ID {horse_buyer.id}")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar HorseBuyer: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al actualizar HorseBuyer: {str(e)}"
        )
    return horse_buyer


def delete_horse_buyer(db: Session, horse_buyer_id: int) -> bool:
    """
    Eliminar un comprador de caballo.
    """
    horse_buyer = db.query(HorseBuyer).filter(HorseBuyer.id == horse_buyer_id).first()
    if horse_buyer is None:
        return False
    try:
        # Eliminar Buyer Installments asociados
        buyer_installments = (
            db.query(BuyerInstallment)
            .filter(BuyerInstallment.horse_buyer_id == horse_buyer_id)
            .all()
        )
        for installment in buyer_installments:
            db.delete(installment)

        db.delete(horse_buyer)
        db.commit()
        logger.debug(f"HorseBuyer eliminado con ID {horse_buyer_id}")
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al eliminar HorseBuyer: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al eliminar HorseBuyer: {str(e)}"
        )


# ----------------------
# CRUD para Transacciones
# ----------------------


def get_transactions(db: Session, skip: int = 0, limit: int = 100) -> List[Transaction]:
    """
    Obtener una lista de transacciones con paginación.
    """
    return db.query(Transaction).offset(skip).limit(limit).all()


def get_transaction(db: Session, transaction_id: int) -> Optional[Transaction]:
    """
    Obtener una transacción por su ID.
    """
    return db.query(Transaction).filter(Transaction.id == transaction_id).first()


def update_transaction(
    db: Session,
    transaction: Transaction,
    transaction_update: schemas.TransactionUpdateSchema,
) -> Transaction:
    """
    Actualizar una transacción existente.
    """
    for key, value in transaction_update.dict(exclude_unset=True).items():
        setattr(transaction, key, value)
    try:
        db.commit()
        db.refresh(transaction)
        logger.debug(f"Transacción actualizada con ID {transaction.id}")
        return transaction
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar la transacción: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al actualizar la transacción: {str(e)}"
        )


def delete_transaction(db: Session, transaction_id: int) -> bool:
    """
    Eliminar una transacción.
    """
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        return False
    try:
        db.delete(transaction)
        db.commit()
        logger.debug(f"Transacción eliminada con ID {transaction_id}")
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al eliminar la transacción: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al eliminar la transacción: {str(e)}"
        )


def process_payment(buyer_installment: BuyerInstallment, session: Session):
    """Procesa el pago de una cuota."""
    if buyer_installment.status == PaymentStatus.PAID:
        logger.warning(
            f"Attempted to pay an already paid installment ID {buyer_installment.id}"
        )
        raise HTTPException(status_code=400, detail="Installment already paid")

    remaining_amount = buyer_installment.amount - buyer_installment.amount_paid
    buyer_installment.amount_paid += remaining_amount
    update_installment_status(buyer_installment)
    session.commit()
    logger.debug(f"Installment ID {buyer_installment.id} marked as PAID")

    # Actualizar balance del comprador
    horse_buyer = buyer_installment.horse_buyer
    horse_buyer.balance -= remaining_amount
    logger.debug(
        f"Deducted {remaining_amount} from buyer {horse_buyer.buyer_id}, new balance: {horse_buyer.balance}"
    )
    # Actualizar balance total del usuario
    user = horse_buyer.buyer
    user.update_total_balance()
    session.commit()


def get_user_balance_detail(user_id: int, session: Session) -> dict:
    """Obtiene el detalle del saldo de un usuario."""
    buyer_balance_details = []
    buyers = session.query(HorseBuyer).filter(HorseBuyer.buyer_id == user_id).all()
    if not buyers:
        raise ValueError("Usuario no tiene HorseBuyers asociados")

    for buyer in buyers:
        buyer_balance_details.append(
            {"horse_id": buyer.horse_id, "balance": buyer.balance}
        )

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
    """Calcula el monto total pagado por el comprador en todas las cuotas."""
    total_paid = (
        session.query(func.sum(InstallmentPayment.amount))
        .join(BuyerInstallment)
        .join(HorseBuyer)
        .filter(HorseBuyer.buyer_id == buyer_id)
        .scalar()
    )

    return total_paid or 0.0


def get_pending_installments_amount(buyer_id: int, session: Session) -> float:
    """Calcula el monto total de cuotas pendientes."""
    pending_amount = (
        session.query(func.sum(BuyerInstallment.amount - BuyerInstallment.amount_paid))
        .join(HorseBuyer)
        .filter(
            HorseBuyer.buyer_id == buyer_id,
            BuyerInstallment.status.in_([PaymentStatus.PENDING, PaymentStatus.PARTIAL]),
        )
        .scalar()
    )

    return pending_amount or 0.0


# ----------------------
# CRUD para Caballos
# ----------------------


def get_horses(db: Session, skip: int = 0, limit: int = 100) -> List[Horse]:
    """
    Obtener una lista de caballos con paginación.
    """
    return db.query(Horse).offset(skip).limit(limit).all()


def get_horse(db: Session, horse_id: int) -> Optional[Horse]:
    """
    Obtener un caballo por su ID.
    """
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


def _create_horse_with_buyers(
    starting_billing_month: int,
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
        )
    except HTTPException as e:
        raise e
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


def update_horse(
    db: Session, horse: Horse, horse_update: schemas.HorseUpdateSchema
) -> Horse:
    """
    Actualiza un caballo y opcionalmente sus compradores.
    """
    try:
        with db.begin():  # Maneja la transacción completa
            # Actualizar debugrmación básica del caballo
            for key, value in horse_update.dict(exclude_unset=True).items():
                if key != "buyers_data":
                    setattr(horse, key, value)

            # Si se proporcionan datos de compradores, actualizarlos
            if "buyers_data" in horse_update.dict(exclude_unset=True):
                buyers_data = horse_update.buyers_data
                validate_horse_buyers(buyers_data)

                # Eliminar compradores existentes y sus cuotas
                existing_buyers = (
                    db.query(HorseBuyer).filter(HorseBuyer.horse_id == horse.id).all()
                )
                for buyer in existing_buyers:
                    # Eliminar Buyer Installments asociados
                    buyer_installments = (
                        db.query(BuyerInstallment)
                        .filter(BuyerInstallment.horse_buyer_id == buyer.id)
                        .all()
                    )
                    for installment in buyer_installments:
                        db.delete(installment)
                    db.delete(buyer)

                # Crear nuevos compradores
                for buyer_data in buyers_data:
                    horse_buyer = HorseBuyer(
                        horse_id=horse.id,
                        buyer_id=buyer_data["buyer_id"],
                        percentage=buyer_data["percentage"],
                    )
                    db.add(horse_buyer)

                # Recalcular cuotas para los nuevos compradores
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
    """
    Elimina un caballo y todos los registros relacionados.
    Retorna True si tuvo éxito, False si el caballo no fue encontrado.
    """
    horse = db.query(Horse).filter(Horse.id == horse_id).first()
    if not horse:
        return False

    try:
        with db.begin():  # Maneja la transacción completa
            # Eliminar cuotas y buyer installments
            installments = (
                db.query(Installment).filter(Installment.horse_id == horse_id).all()
            )
            for installment in installments:
                buyer_installments = (
                    db.query(BuyerInstallment)
                    .filter(BuyerInstallment.installment_id == installment.id)
                    .all()
                )
                for buyer_installment in buyer_installments:
                    db.delete(buyer_installment)
                db.delete(installment)

            # Eliminar transacciones asociadas
            transactions = (
                db.query(Transaction).filter(Transaction.horse_id == horse_id).all()
            )
            for transaction in transactions:
                db.delete(transaction)

            # Eliminar compradores
            buyers = db.query(HorseBuyer).filter(HorseBuyer.horse_id == horse_id).all()
            for buyer in buyers:
                db.delete(buyer)

            # Eliminar el caballo
            db.delete(horse)

        logger.debug(f"Caballo eliminado con ID {horse_id}")
        return True
    except SQLAlchemyError as e:
        logger.error(f"Error al eliminar el caballo: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al eliminar el caballo: {str(e)}"
        )


# ----------------------
# CRUD para Compradores de Caballo
# ----------------------


def get_horse_buyers(db: Session, skip: int = 0, limit: int = 100) -> List[HorseBuyer]:
    """
    Obtener una lista de compradores de caballo con paginación.
    """
    return db.query(HorseBuyer).offset(skip).limit(limit).all()


def get_horse_buyer(db: Session, horse_buyer_id: int) -> Optional[HorseBuyer]:
    """
    Obtener un comprador de caballo por su ID.
    """
    return db.query(HorseBuyer).filter(HorseBuyer.id == horse_buyer_id).first()


def create_horse_buyer(
    db: Session, horse_buyer: schemas.HorseBuyerCreateSchema
) -> HorseBuyer:
    """
    Crear un nuevo comprador de caballo.
    """
    # Validar que la suma de porcentajes no exceda 100%
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
    db.add(db_horse_buyer)
    try:
        db.commit()
        db.refresh(db_horse_buyer)
        logger.debug(f"HorseBuyer creado con ID {db_horse_buyer.id}")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear HorseBuyer: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al crear HorseBuyer: {str(e)}"
        )
    return db_horse_buyer


def update_horse_buyer(
    db: Session,
    horse_buyer: HorseBuyer,
    horse_buyer_update: schemas.HorseBuyerUpdateSchema,
) -> HorseBuyer:
    """
    Actualizar un comprador de caballo existente.
    """
    for key, value in horse_buyer_update.dict(exclude_unset=True).items():
        setattr(horse_buyer, key, value)
    try:
        db.commit()
        db.refresh(horse_buyer)
        logger.debug(f"HorseBuyer actualizado con ID {horse_buyer.id}")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar HorseBuyer: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al actualizar HorseBuyer: {str(e)}"
        )
    return horse_buyer


def delete_horse_buyer(db: Session, horse_buyer_id: int) -> bool:
    """
    Eliminar un comprador de caballo.
    """
    horse_buyer = db.query(HorseBuyer).filter(HorseBuyer.id == horse_buyer_id).first()
    if horse_buyer is None:
        return False
    try:
        with db.begin():  # Maneja la transacción completa
            # Eliminar Buyer Installments asociados
            buyer_installments = (
                db.query(BuyerInstallment)
                .filter(BuyerInstallment.horse_buyer_id == horse_buyer_id)
                .all()
            )
            for installment in buyer_installments:
                db.delete(installment)

            db.delete(horse_buyer)
        logger.debug(f"HorseBuyer eliminado con ID {horse_buyer_id}")
        return True
    except SQLAlchemyError as e:
        logger.error(f"Error al eliminar HorseBuyer: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al eliminar HorseBuyer: {str(e)}"
        )


# ----------------------
# CRUD para Transacciones
# ----------------------


def get_transactions(db: Session, skip: int = 0, limit: int = 100) -> List[Transaction]:
    """
    Obtener una lista de transacciones con paginación.
    """
    return db.query(Transaction).offset(skip).limit(limit).all()


def get_transaction(db: Session, transaction_id: int) -> Optional[Transaction]:
    """
    Obtener una transacción por su ID.
    """
    return db.query(Transaction).filter(Transaction.id == transaction_id).first()


def update_transaction(
    db: Session,
    transaction: Transaction,
    transaction_update: schemas.TransactionUpdateSchema,
) -> Transaction:
    """
    Actualizar una transacción existente.
    """
    for key, value in transaction_update.dict(exclude_unset=True).items():
        setattr(transaction, key, value)
    try:
        db.commit()
        db.refresh(transaction)
        logger.debug(f"Transacción actualizada con ID {transaction.id}")
        return transaction
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar la transacción: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al actualizar la transacción: {str(e)}"
        )


def delete_transaction(db: Session, transaction_id: int) -> bool:
    """
    Eliminar una transacción.
    """
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        return False
    try:
        with db.begin():  # Maneja la transacción completa
            db.delete(transaction)
        logger.debug(f"Transacción eliminada con ID {transaction_id}")
        return True
    except SQLAlchemyError as e:
        logger.error(f"Error al eliminar la transacción: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al eliminar la transacción: {str(e)}"
        )


def process_payment(buyer_installment: BuyerInstallment, session: Session):
    """Procesa el pago de una cuota."""
    if buyer_installment.status == PaymentStatus.PAID:
        logger.warning(
            f"Attempted to pay an already paid installment ID {buyer_installment.id}"
        )
        raise HTTPException(status_code=400, detail="Installment already paid")

    remaining_amount = buyer_installment.amount - buyer_installment.amount_paid
    buyer_installment.amount_paid += remaining_amount
    update_installment_status(buyer_installment)
    session.commit()
    logger.debug(f"Installment ID {buyer_installment.id} marked as PAID")

    # Actualizar balance del comprador
    horse_buyer = buyer_installment.horse_buyer
    horse_buyer.balance -= remaining_amount
    logger.debug(
        f"Deducted {remaining_amount} from buyer {horse_buyer.buyer_id}, new balance: {horse_buyer.balance}"
    )
    # Actualizar balance total del usuario
    user = horse_buyer.buyer
    user.update_total_balance()
    session.commit()


def get_user_balance_detail(user_id: int, session: Session) -> dict:
    """Obtiene el detalle del saldo de un usuario."""
    buyer_balance_details = []
    buyers = session.query(HorseBuyer).filter(HorseBuyer.buyer_id == user_id).all()
    if not buyers:
        raise ValueError("Usuario no tiene HorseBuyers asociados")

    for buyer in buyers:
        buyer_balance_details.append(
            {"horse_id": buyer.horse_id, "balance": buyer.balance}
        )

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
    """Calcula el monto total pagado por el comprador en todas las cuotas."""
    total_paid = (
        session.query(func.sum(InstallmentPayment.amount))
        .join(BuyerInstallment)
        .join(HorseBuyer)
        .filter(HorseBuyer.buyer_id == buyer_id)
        .scalar()
    )

    return total_paid or 0.0


def get_pending_installments_amount(buyer_id: int, session: Session) -> float:
    """Calcula el monto total de cuotas pendientes."""
    pending_amount = (
        session.query(func.sum(BuyerInstallment.amount - BuyerInstallment.amount_paid))
        .join(HorseBuyer)
        .filter(
            HorseBuyer.buyer_id == buyer_id,
            BuyerInstallment.status.in_([PaymentStatus.PENDING, PaymentStatus.PARTIAL]),
        )
        .scalar()
    )

    return pending_amount or 0.0


# ----------------------
# CRUD para Transacciones
# ----------------------


def get_transactions(db: Session, skip: int = 0, limit: int = 100) -> List[Transaction]:
    """
    Obtener una lista de transacciones con paginación.
    """
    return db.query(Transaction).offset(skip).limit(limit).all()


def get_transaction(db: Session, transaction_id: int) -> Optional[Transaction]:
    """
    Obtener una transacción por su ID.
    """
    return db.query(Transaction).filter(Transaction.id == transaction_id).first()


def create_transaction(
    db: Session, transaction: schemas.TransactionCreateSchema
) -> Transaction:
    """
    Crear una nueva transacción.
    """
    db_transaction = Transaction(**transaction.dict())
    db.add(db_transaction)
    try:
        db.commit()
        db.refresh(db_transaction)

        return db_transaction
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear la transacción: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al crear la transacción: {str(e)}"
        )


def update_transaction(
    db: Session,
    transaction: Transaction,
    transaction_update: schemas.TransactionUpdateSchema,
) -> Transaction:
    """
    Actualizar una transacción existente.
    """
    for key, value in transaction_update.dict(exclude_unset=True).items():
        setattr(transaction, key, value)
    try:
        db.commit()
        db.refresh(transaction)
        logger.debug(f"Transacción actualizada con ID {transaction.id}")
        return transaction
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar la transacción: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al actualizar la transacción: {str(e)}"
        )


def delete_transaction(db: Session, transaction_id: int) -> bool:
    """
    Eliminar una transacción.
    """
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        return False
    try:
        with db.begin():  # Maneja la transacción completa
            db.delete(transaction)
        logger.debug(f"Transacción eliminada con ID {transaction_id}")
        return True
    except SQLAlchemyError as e:
        logger.error(f"Error al eliminar la transacción: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al eliminar la transacción: {str(e)}"
        )


# ----------------------
# CRUD para Compradores de Caballo
# ----------------------


def get_horse_buyers(db: Session, skip: int = 0, limit: int = 100) -> List[HorseBuyer]:
    """
    Obtener una lista de compradores de caballo con paginación.
    """
    return db.query(HorseBuyer).offset(skip).limit(limit).all()


def get_horse_buyer(db: Session, horse_buyer_id: int) -> Optional[HorseBuyer]:
    """
    Obtener un comprador de caballo por su ID.
    """
    return db.query(HorseBuyer).filter(HorseBuyer.id == horse_buyer_id).first()


def create_horse_buyer(
    db: Session, horse_buyer: schemas.HorseBuyerCreateSchema
) -> HorseBuyer:
    """
    Crear un nuevo comprador de caballo.
    """
    # Validar que la suma de porcentajes no exceda 100%
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
    db.add(db_horse_buyer)
    try:
        db.commit()
        db.refresh(db_horse_buyer)
        logger.debug(f"HorseBuyer creado con ID {db_horse_buyer.id}")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear HorseBuyer: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al crear HorseBuyer: {str(e)}"
        )
    return db_horse_buyer


def update_horse_buyer(
    db: Session,
    horse_buyer: HorseBuyer,
    horse_buyer_update: schemas.HorseBuyerUpdateSchema,
) -> HorseBuyer:
    """
    Actualizar un comprador de caballo existente.
    """
    for key, value in horse_buyer_update.dict(exclude_unset=True).items():
        setattr(horse_buyer, key, value)
    try:
        db.commit()
        db.refresh(horse_buyer)
        logger.debug(f"HorseBuyer actualizado con ID {horse_buyer.id}")
        return horse_buyer
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar HorseBuyer: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al actualizar HorseBuyer: {str(e)}"
        )
    return horse_buyer


def delete_horse_buyer(db: Session, horse_buyer_id: int) -> bool:
    """
    Eliminar un comprador de caballo.
    """
    horse_buyer = db.query(HorseBuyer).filter(HorseBuyer.id == horse_buyer_id).first()
    if horse_buyer is None:
        return False
    try:
        with db.begin():  # Maneja la transacción completa
            # Eliminar Buyer Installments asociados
            buyer_installments = (
                db.query(BuyerInstallment)
                .filter(BuyerInstallment.horse_buyer_id == horse_buyer_id)
                .all()
            )
            for installment in buyer_installments:
                db.delete(installment)

            db.delete(horse_buyer)
        logger.debug(f"HorseBuyer eliminado con ID {horse_buyer_id}")
        return True
    except SQLAlchemyError as e:
        logger.error(f"Error al eliminar HorseBuyer: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al eliminar HorseBuyer: {str(e)}"
        )


# ----------------------
# Funciones de Pago y Balance
# ----------------------


def process_payment(buyer_installment: BuyerInstallment, session: Session):
    """Procesa el pago de una cuota."""
    if buyer_installment.status == PaymentStatus.PAID:
        logger.warning(
            f"Attempted to pay an already paid installment ID {buyer_installment.id}"
        )
        raise HTTPException(status_code=400, detail="Installment already paid")

    remaining_amount = buyer_installment.amount - buyer_installment.amount_paid
    buyer_installment.amount_paid += remaining_amount
    update_installment_status(buyer_installment)
    session.commit()
    logger.debug(f"Installment ID {buyer_installment.id} marked as PAID")

    # Actualizar balance del comprador
    horse_buyer = buyer_installment.horse_buyer
    horse_buyer.balance -= remaining_amount
    logger.debug(
        f"Deducted {remaining_amount} from buyer {horse_buyer.buyer_id}, new balance: {horse_buyer.balance}"
    )
    # Actualizar balance total del usuario
    user = horse_buyer.buyer
    user.update_total_balance()
    session.commit()


def get_user_balance_detail(user_id: int, session: Session) -> dict:
    """Obtiene el detalle del saldo de un usuario."""
    buyer_balance_details = []
    buyers = session.query(HorseBuyer).filter(HorseBuyer.buyer_id == user_id).all()
    if not buyers:
        raise ValueError("Usuario no tiene HorseBuyers asociados")

    for buyer in buyers:
        buyer_balance_details.append(
            {"horse_id": buyer.horse_id, "balance": buyer.balance}
        )

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
    """Calcula el monto total pagado por el comprador en todas las cuotas."""
    total_paid = (
        session.query(func.sum(InstallmentPayment.amount))
        .join(BuyerInstallment)
        .join(HorseBuyer)
        .filter(HorseBuyer.buyer_id == buyer_id)
        .scalar()
    )

    return total_paid or 0.0


def get_pending_installments_amount(buyer_id: int, session: Session) -> float:
    """Calcula el monto total de cuotas pendientes."""
    pending_amount = (
        session.query(func.sum(BuyerInstallment.amount - BuyerInstallment.amount_paid))
        .join(HorseBuyer)
        .filter(
            HorseBuyer.buyer_id == buyer_id,
            BuyerInstallment.status.in_([PaymentStatus.PENDING, PaymentStatus.PARTIAL]),
        )
        .scalar()
    )

    return pending_amount or 0.0


# ----------------------
# CRUD para Caballos
# ----------------------


def get_horses(db: Session, skip: int = 0, limit: int = 100) -> List[Horse]:
    """
    Obtener una lista de caballos con paginación.
    """
    return db.query(Horse).offset(skip).limit(limit).all()


def get_horse(db: Session, horse_id: int) -> Optional[Horse]:
    """
    Obtener un caballo por su ID.
    """
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
    """
    Actualiza un caballo y opcionalmente sus compradores.
    """
    try:
        with db.begin():  # Maneja la transacción completa
            # Actualizar debugrmación básica del caballo
            for key, value in horse_update.dict(exclude_unset=True).items():
                if key != "buyers_data":
                    setattr(horse, key, value)

            # Si se proporcionan datos de compradores, actualizarlos
            if "buyers_data" in horse_update.dict(exclude_unset=True):
                buyers_data = horse_update.buyers_data
                validate_horse_buyers(buyers_data)

                # Eliminar compradores existentes y sus cuotas
                existing_buyers = (
                    db.query(HorseBuyer).filter(HorseBuyer.horse_id == horse.id).all()
                )
                for buyer in existing_buyers:
                    # Eliminar Buyer Installments asociados
                    buyer_installments = (
                        db.query(BuyerInstallment)
                        .filter(BuyerInstallment.horse_buyer_id == buyer.id)
                        .all()
                    )
                    for installment in buyer_installments:
                        db.delete(installment)
                    db.delete(buyer)

                # Crear nuevos compradores
                for buyer_data in buyers_data:
                    horse_buyer = HorseBuyer(
                        horse_id=horse.id,
                        buyer_id=buyer_data["buyer_id"],
                        percentage=buyer_data["percentage"],
                    )
                    db.add(horse_buyer)

                # Recalcular cuotas para los nuevos compradores
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
    """
    Elimina un caballo y todos los registros relacionados.
    Retorna True si tuvo éxito, False si el caballo no fue encontrado.
    """
    horse = db.query(Horse).filter(Horse.id == horse_id).first()
    if not horse:
        return False

    try:
        with db.begin():  # Maneja la transacción completa
            # Eliminar cuotas y buyer installments
            installments = (
                db.query(Installment).filter(Installment.horse_id == horse_id).all()
            )
            for installment in installments:
                buyer_installments = (
                    db.query(BuyerInstallment)
                    .filter(BuyerInstallment.installment_id == installment.id)
                    .all()
                )
                for buyer_installment in buyer_installments:
                    db.delete(buyer_installment)
                db.delete(installment)

            # Eliminar transacciones asociadas
            transactions = (
                db.query(Transaction).filter(Transaction.horse_id == horse_id).all()
            )
            for transaction in transactions:
                db.delete(transaction)

            # Eliminar compradores
            buyers = db.query(HorseBuyer).filter(HorseBuyer.horse_id == horse_id).all()
            for buyer in buyers:
                db.delete(buyer)

            # Eliminar el caballo
            db.delete(horse)

        logger.debug(f"Caballo eliminado con ID {horse_id}")
        return True
    except SQLAlchemyError as e:
        logger.error(f"Error al eliminar el caballo: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error al eliminar el caballo: {str(e)}"
        )


# get installment by id
def get_installment(db: Session, installment_id: int) -> Optional[Installment]:
    """
    Obtener una cuota por su ID.
    """
    return db.query(Installment).filter(Installment.id == installment_id).first()
