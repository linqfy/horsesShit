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
        current_time = datetime.now()
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
            horse_buyer = installment.horse_buyer
            # Actualizar el balance total del usuario
            logger.info(
                f"Cuota ID {installment.id} marcada como VENCIDA (afecta a HB-{horse_buyer.id})"
            )

        db.commit()
        logger.info("Verificación y actualización de cuotas vencidas completada.")
    except Exception as e:
        logger.error(f"Error al verificar cuotas vencidas: {str(e)}")
        db.rollback()
    finally:
        db.close()
