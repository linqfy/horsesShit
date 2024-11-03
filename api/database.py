from sqlalchemy import (
    Table,
    Column,
    Integer,
    String,
    Float,
    ForeignKey,
    MetaData,
    DateTime,
    Enum,
    Boolean,
    Text,
    ForeignKeyConstraint,
    func,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import (
    relationship,
    declarative_base,
    Session,
    validates,
    sessionmaker,
)
from datetime import datetime, timedelta
from typing import List, Generator
from contextlib import contextmanager
import enum

Base = declarative_base()
metadata = MetaData()

# You should move this to a config file or environment variables in production
SQLALCHEMY_DATABASE_URL = "sqlite:///./horses.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator:
    """
    Generator function to get database session.
    Usage:
        from fastapi import Depends

        @app.get("/")
        def route(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
    """
    Context manager for database sessions.
    Usage:
        with get_db_context() as db:
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TransactionType(enum.Enum):
    INGRESO = "INGRESO"  # Income from installment payments
    EGRESO = "EGRESO"  # Shared expenses
    PREMIO = "PREMIO"  # Prize money to distribute
    PAGO = "PAGO"  # Payment to admin


class PaymentStatus(enum.Enum):
    PENDING = "PENDIENTE"
    PARTIAL = "PARCIAL"
    PAID = "PAGADO"
    OVERDUE = "VENCIDO"


class Horse(Base):
    __tablename__ = "horses"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    information = Column(Text)
    image_url = Column(String)
    total_value = Column(Float, nullable=False)
    number_of_installments = Column(Integer, nullable=False)
    installment_amount = Column(Float, nullable=False)
    creation_date = Column(DateTime, default=datetime.utcnow)
    total_percentage = Column(Float, nullable=False)

    buyers = relationship("HorseBuyer", back_populates="horse")
    transactions = relationship("Transaction", back_populates="horse")
    installments = relationship("Installment", back_populates="horse")

    @validates("number_of_installments", "total_value")
    def validate_positive(self, key, value):
        if value <= 0:
            raise ValueError(f"{key} must be positive")
        return value

    @validates("installment_amount")
    def validate_installment_amount(self, key, value):
        if hasattr(self, "total_value") and self.total_value:
            if abs(self.total_value - (value * self.number_of_installments)) > 0.01:
                raise ValueError(
                    "installment_amount * number_of_installments must equal total_value"
                )
        return value


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    dni = Column(Integer)
    is_admin = Column(Boolean, default=False)
    balance = Column(Float, default=0.0)

    horses_buying = relationship("HorseBuyer", back_populates="buyer")
    payments = relationship("InstallmentPayment", back_populates="buyer")


class HorseBuyer(Base):
    __tablename__ = "horse_buyers"

    id = Column(Integer, primary_key=True)
    horse_id = Column(Integer, ForeignKey("horses.id"))
    buyer_id = Column(Integer, ForeignKey("users.id"))
    percentage = Column(Float, nullable=False)
    join_date = Column(DateTime, default=datetime.utcnow)
    active = Column(Boolean, default=True)

    horse = relationship("Horse", back_populates="buyers")
    buyer = relationship("User", back_populates="horses_buying")
    installments = relationship("BuyerInstallment", back_populates="horse_buyer")

    __table_args__ = (UniqueConstraint("horse_id", "buyer_id", name="uix_horse_buyer"),)

    @validates("percentage")
    def validate_percentage(self, key, value):
        if not (0 < value <= 100):
            raise ValueError("Percentage must be between 0 and 100")
        return value


class Installment(Base):
    __tablename__ = "installments"

    id = Column(Integer, primary_key=True)
    horse_id = Column(Integer, ForeignKey("horses.id"))
    due_date = Column(DateTime, nullable=False)
    amount = Column(Float, nullable=False)
    installment_number = Column(Integer, nullable=False)

    horse = relationship("Horse", back_populates="installments")
    buyer_installments = relationship("BuyerInstallment", back_populates="installment")

    __table_args__ = (
        UniqueConstraint(
            "horse_id", "installment_number", name="uix_horse_installment"
        ),
    )


class BuyerInstallment(Base):
    __tablename__ = "buyer_installments"

    id = Column(Integer, primary_key=True)
    horse_buyer_id = Column(Integer, ForeignKey("horse_buyers.id"))
    installment_id = Column(Integer, ForeignKey("installments.id"))
    amount = Column(Float, nullable=False)
    amount_paid = Column(Float, default=0.0)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    last_payment_date = Column(DateTime, nullable=True)

    horse_buyer = relationship("HorseBuyer", back_populates="installments")
    installment = relationship("Installment", back_populates="buyer_installments")
    payments = relationship("InstallmentPayment", back_populates="buyer_installment")


class InstallmentPayment(Base):
    __tablename__ = "installment_payments"

    id = Column(Integer, primary_key=True)
    buyer_installment_id = Column(Integer, ForeignKey("buyer_installments.id"))
    transaction_id = Column(Integer, ForeignKey("transactions.id"))
    buyer_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow)

    buyer_installment = relationship("BuyerInstallment", back_populates="payments")
    transaction = relationship("Transaction", back_populates="installment_payments")
    buyer = relationship("User", back_populates="payments")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    type = Column(Enum(TransactionType), nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    concept = Column(String, nullable=False)
    total_amount = Column(Float, nullable=False)
    notes = Column(Text)
    horse_id = Column(Integer, ForeignKey("horses.id"), nullable=True)

    horse = relationship("Horse", back_populates="transactions")
    installment_payments = relationship(
        "InstallmentPayment", back_populates="transaction"
    )


def create_horse_installments(horse: Horse, session: Session):
    """Crea las cuotas para un caballo nuevo."""
    for i in range(horse.number_of_installments):
        installment = Installment(
            horse=horse,
            installment_number=i + 1,
            amount=horse.installment_amount,
            due_date=calculate_due_date(horse.creation_date, i + 1),
        )
        session.add(installment)

        # Crea cuotas para cada comprador
        for horse_buyer in horse.buyers:
            buyer_amount = horse.installment_amount * (horse_buyer.percentage / 100)
            buyer_installment = BuyerInstallment(
                horse_buyer=horse_buyer, installment=installment, amount=buyer_amount
            )
            session.add(buyer_installment)
    session.commit()


def calculate_due_date(base_date, installment_number):
    """Calcula la fecha de vencimiento de una cuota."""
    return base_date + timedelta(
        days=installment_number * 30
    )  # Ejemplo de vencimiento mensual


def process_income(transaction: Transaction, session: Session):
    """Procesa un ingreso y distribuye los fondos."""
    if transaction.type == TransactionType.INGRESO:
        distribute_installment_payment(transaction, session)
    elif transaction.type == TransactionType.PREMIO:
        distribute_prize(transaction, session)


def distribute_installment_payment(transaction: Transaction, session: Session):
    """Distribuye el ingreso entre cuotas pendientes de los compradores."""
    remaining_amount = transaction.total_amount
    for buyer_installment in get_pending_buyer_installments(transaction.horse, session):
        if remaining_amount <= 0:
            break
        amount_to_pay = min(
            buyer_installment.amount - buyer_installment.amount_paid, remaining_amount
        )
        buyer_installment.amount_paid += amount_to_pay
        remaining_amount -= amount_to_pay
        update_installment_status(buyer_installment)
        session.commit()


def distribute_prize(transaction: Transaction, session: Session):
    """Distribuye un premio entre los compradores según su porcentaje."""
    horse = transaction.horse
    for horse_buyer in horse.buyers:
        buyer_amount = transaction.total_amount * (horse_buyer.percentage / 100)
        horse_buyer.buyer.balance += buyer_amount
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


def update_installment_status(buyer_installment: BuyerInstallment):
    """Actualiza el estado de una cuota según los pagos realizados."""
    if buyer_installment.amount_paid >= buyer_installment.amount:
        buyer_installment.status = PaymentStatus.PAID
    elif buyer_installment.amount_paid > 0:
        buyer_installment.status = PaymentStatus.PARTIAL
    else:
        buyer_installment.status = PaymentStatus.PENDING


def create_horse_with_buyers(
    session: Session,
    name: str,
    total_value: float,
    number_of_installments: int,
    buyers_data: List[dict],
    information: str = None,
    image_url: str = None,
) -> Horse:

    print("Creating horse with buyers")
    """
    Crea un caballo con sus compradores y cuotas iniciales.

    buyers_data = [
        {
            'buyer_id': id,
            'percentage': float
        },
        ...
    ]
    """

    # Crear caballo
    horse = Horse(
        name=name,
        total_value=total_value,
        number_of_installments=number_of_installments,
        installment_amount=total_value / number_of_installments,
        total_percentage=sum(buyer["percentage"] for buyer in buyers_data),
        information=information,
        image_url=image_url,
    )
    session.add(horse)
    session.flush()  # Para obtener el ID del caballo

    # Crear compradores
    for buyer_data in buyers_data:
        horse_buyer = HorseBuyer(
            horse=horse,
            buyer_id=buyer_data["buyer_id"],
            percentage=buyer_data["percentage"],
        )
        session.add(horse_buyer)

    # Crear cuotas
    create_horse_installments(horse, session)

    session.commit()
    return horse


def process_transaction(transaction: Transaction, session: Session):
    """Procesa una transacción según su tipo."""
    if transaction.type == TransactionType.INGRESO:
        distribute_installment_payment(transaction, session)
    elif transaction.type == TransactionType.PREMIO:
        distribute_prize(transaction, session)
    elif transaction.type == TransactionType.EGRESO:
        distribute_expense(transaction, session)


def distribute_expense(transaction: Transaction, session: Session):
    """Distribuye un gasto entre los compradores según su porcentaje."""
    for horse_buyer in transaction.horse.buyers:
        if horse_buyer.active:
            expense_amount = transaction.total_amount * (horse_buyer.percentage / 100)
            horse_buyer.buyer.balance -= expense_amount
    session.commit()


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


def get_buyer_balance_detail(buyer_id: int, session: Session) -> dict:
    """Obtiene el detalle del saldo de un comprador."""
    buyer = session.query(User).get(buyer_id)
    if not buyer:
        raise ValueError("Buyer not found")

    return {
        "current_balance": buyer.balance,
        "pending_installments": get_pending_installments_amount(buyer_id, session),
        "total_paid": get_total_paid_amount(buyer_id, session),
    }


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


def create_tables():
    Base.metadata.create_all(bind=engine)
