# backend/prod/api/overdue_checker.py

from sqlalchemy.orm import Session
from .crud import update_installment_status
from .models import get_db, BuyerInstallment, Installment, PaymentStatus
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def check_overdue_installments():
    """
    Verifica las cuotas pendientes que han pasado su fecha de vencimiento y las marca como vencidas.
    Además, ajusta el balance de los compradores correspondientes.
    """
    db_generator = get_db()
    db = next(db_generator)
    try:
        current_time = datetime.utcnow()
        pending_installments = (
            db.query(BuyerInstallment)
            .join(Installment)
            .filter(
                Installment.due_date < current_time,
                BuyerInstallment.status == PaymentStatus.PENDING,
            )
            .all()
        )

        for installment in pending_installments:
            installment.status = PaymentStatus.OVERDUE
            # Calcular el monto pendiente
            pending_amount = installment.amount - installment.amount_paid
            horse_buyer = installment.horse_buyer
            horse_buyer.balance -= pending_amount
            # Actualizar el balance total del usuario
            user = horse_buyer.buyer
            user.update_total_balance()
            logger.info(
                f"Cuota ID {installment.id} marcada como VENCIDA y se dedujo {pending_amount} del comprador ID {horse_buyer.buyer_id}"
            )

        db.commit()
        logger.info("Verificación y actualización de cuotas vencidas completada.")
    except Exception as e:
        logger.error(f"Error al verificar cuotas vencidas: {str(e)}")
        db.rollback()
    finally:
        db.close()
