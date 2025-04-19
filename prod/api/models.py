# backend/prod/api/models.py

from sqlalchemy import (
    Table,
    Column,
    Integer,
    String,
    Float,
    ForeignKey,
    CheckConstraint,
    MetaData,
    DateTime,
    Enum,
    Boolean,
    Text,
    ForeignKeyConstraint,
    func,
    UniqueConstraint,
    Index,
    create_engine,
)
from sqlalchemy.orm import (
    relationship,
    declarative_base,
    Session,
    validates,
    sessionmaker,
    joinedload,
)
from datetime import datetime, timedelta
from typing import List, Generator
from contextlib import contextmanager
import enum
from sqlalchemy.exc import SQLAlchemyError
import logging
from fastapi import HTTPException
from pythonjsonlogger import jsonlogger

# Configuración de logging en formato JSON
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter("%(asctime)s %(name)s %(levelname)s %(message)s")
logHandler.setFormatter(formatter)
logger.addHandler(logHandler)

# Definición única de MetaData y Base
metadata = MetaData()
Base = declarative_base(metadata=metadata)

# Configuración de la base de datos
SQLALCHEMY_DATABASE_URL = "sqlite:///./horses.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=(
        {"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
    ),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator:
    """
    Generador para obtener una sesión de base de datos.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Enumeraciones compartidas
class TransactionType(enum.Enum):
    INGRESO = "INGRESO"
    EGRESO = "EGRESO"
    PREMIO = "PREMIO"
    PAGO = "PAGO"


class PaymentStatus(enum.Enum):
    PENDING = "PENDIENTE"
    PARTIAL = "PARCIAL"
    PAID = "PAGADO"
    OVERDUE = "VENCIDO"


# Modelo User
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    dni = Column(String(20))
    is_admin = Column(Boolean, default=False)
    balance = Column(Float, default=0.0)  # Balance total del usuario
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    horses_buying = relationship(
        "HorseBuyer", back_populates="buyer", cascade="all, delete-orphan"
    )
    payments = relationship(
        "InstallmentPayment", back_populates="buyer", cascade="all, delete-orphan"
    )
    transactions = relationship(
        "Transaction", back_populates="user", cascade="all, delete-orphan"
    )

    # Validaciones
    @validates("email")
    def validate_email(self, key, value):
        assert "@" in value, "Invalid email address"
        return value

    @validates("balance")
    def validate_balance(self, key, value):
        assert isinstance(value, (int, float)), "Balance must be a number"
        return float(value)

    @validates("dni")
    def validate_dni(self, key, value):
        if value is not None:
            assert isinstance(value, str), "DNI debe ser una cadena de caracteres"
        return value

    def update_total_balance(self):
        """
        Updates the user's total balance by summing the balances of all active HorseBuyers
        where the associated horse is not deleted.
        """
        pass


# Modelo Horse
class Horse(Base):
    __tablename__ = "horses"

    id = Column(Integer, primary_key=True)
    starting_billing_month = Column(Integer, nullable=False)
    starting_billing_year = Column(Integer, nullable=False)
    name = Column(String(100), nullable=False)
    information = Column(Text)
    image_url = Column(String(500))
    total_value = Column(Float, nullable=False)
    number_of_installments = Column(Integer, nullable=False)
    creation_date = Column(DateTime, default=datetime.utcnow)
    total_percentage = Column(Float, default=0.0)  # Corrección aquí
    is_deleted = Column(Boolean, default=False)  # Campo para soft delete

    # Relaciones
    buyers = relationship(
        "HorseBuyer", back_populates="horse", cascade="all, delete-orphan"
    )
    transactions = relationship(
        "Transaction", back_populates="horse", cascade="all, delete-orphan"
    )
    installments = relationship(
        "Installment", back_populates="horse", cascade="all, delete-orphan"
    )

    __table_args__ = (
    CheckConstraint("total_value >= 0", name="check_non_negative_total_value"),
    CheckConstraint("number_of_installments >= 0", name="check_non_negative_installments"),
    )


# Modelo HorseBuyer
class HorseBuyer(Base):
    __tablename__ = "horse_buyers"

    id = Column(Integer, primary_key=True)
    horse_id = Column(
        Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False
    )
    buyer_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    percentage = Column(Float, nullable=False)
    join_date = Column(DateTime, default=datetime.utcnow)
    active = Column(Boolean, default=True)
    balance = Column(Float, default=0.0)  # Balance individual del comprador
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    horse = relationship("Horse", back_populates="buyers")
    buyer = relationship("User", back_populates="horses_buying")
    installments = relationship(
        "BuyerInstallment", back_populates="horse_buyer", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("horse_id", "buyer_id", name="uix_horse_buyer"),
        CheckConstraint(
            "percentage > 0 AND percentage <= 100", name="check_valid_percentage"
        ),
    )

    @validates("percentage")
    def validate_percentage(self, key, value):
        assert 0 < value <= 100, "Percentage must be between 0 and 100"
        return value


# Modelo Installment
class Installment(Base):
    __tablename__ = "installments"

    id = Column(Integer, primary_key=True)
    horse_id = Column(
        Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False
    )
    due_date = Column(DateTime, nullable=False)
    amount = Column(Float, nullable=False)
    installment_number = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    mes = Column(Integer, nullable=False)
    año = Column(Integer, nullable=False)

    # Relaciones
    horse = relationship("Horse", back_populates="installments")
    buyer_installments = relationship(
        "BuyerInstallment", back_populates="installment", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint(
            "horse_id", "installment_number", name="uix_horse_installment"
        ),
        CheckConstraint("amount > 0", name="check_positive_amount"),
        CheckConstraint(
            "installment_number > 0", name="check_positive_installment_number"
        ),
    )


# Modelo BuyerInstallment
class BuyerInstallment(Base):
    __tablename__ = "buyer_installments"

    id = Column(Integer, primary_key=True)
    horse_buyer_id = Column(
        Integer, ForeignKey("horse_buyers.id", ondelete="CASCADE"), nullable=False
    )
    installment_id = Column(
        Integer, ForeignKey("installments.id", ondelete="CASCADE"), nullable=False
    )
    amount = Column(Float, nullable=False)
    amount_paid = Column(Float, default=0.0)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    last_payment_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    horse_buyer = relationship("HorseBuyer", back_populates="installments")
    installment = relationship("Installment", back_populates="buyer_installments")
    payments = relationship(
        "InstallmentPayment",
        back_populates="buyer_installment",
        cascade="all, delete-orphan",
    )

    mes = Column(Integer, nullable=False)
    año = Column(Integer, nullable=False)

    __table_args__ = (
        CheckConstraint("amount > 0", name="check_positive_amount"),
        CheckConstraint("amount_paid >= 0", name="check_non_negative_amount_paid"),
        UniqueConstraint(
            "horse_buyer_id", "installment_id", name="uix_buyer_installment"
        ),
        Index("ix_buyer_installments_horse_buyer_id", "horse_buyer_id"),
        Index("ix_buyer_installments_installment_id", "installment_id"),
    )


# Modelo InstallmentPayment
class InstallmentPayment(Base):
    __tablename__ = "installment_payments"

    id = Column(Integer, primary_key=True)
    buyer_installment_id = Column(
        Integer, ForeignKey("buyer_installments.id", ondelete="CASCADE"), nullable=False
    )
    transaction_id = Column(
        Integer, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False
    )
    buyer_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    buyer_installment = relationship("BuyerInstallment", back_populates="payments")
    transaction = relationship("Transaction", back_populates="installment_payments")
    buyer = relationship("User", back_populates="payments")

    __table_args__ = (
        CheckConstraint("amount > 0", name="check_positive_amount"),
        Index("ix_installment_payments_buyer_installment_id", "buyer_installment_id"),
        Index("ix_installment_payments_transaction_id", "transaction_id"),
        Index("ix_installment_payments_buyer_id", "buyer_id"),
    )


# Modelo Transaction
class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    type = Column(Enum(TransactionType), nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    concept = Column(String(255), nullable=False)
    total_amount = Column(Float, nullable=False)
    notes = Column(Text)
    horse_id = Column(
        Integer, ForeignKey("horses.id", ondelete="SET NULL"), nullable=True
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    mes = Column(Integer, nullable=False)
    año = Column(Integer, nullable=False)
    fecha_de_pago = Column(DateTime, nullable=True)
    fecha_de_efectividad = Column(DateTime, nullable=True)
    pagado = Column(Boolean, nullable=True)

    # Relaciones
    horse = relationship("Horse", back_populates="transactions")
    user = relationship("User", back_populates="transactions")
    installment_payments = relationship(
        "InstallmentPayment", back_populates="transaction", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "type IN ('INGRESO', 'EGRESO', 'PREMIO', 'PAGO')",
            name="check_transaction_type",
        ),
    )


# Funciones de Utilidad y Lógica de Negocio movidas a crud.py
def create_tables():
    """
    Crea las tablas en la base de datos.
    """
    metadata.create_all(engine)
