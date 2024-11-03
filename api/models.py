from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    ForeignKey,
    DateTime,
    Enum,
    Boolean,
    Text,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()


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


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    dni = Column(Integer)
    is_admin = Column(Boolean, default=False)
    balance = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    horses_buying = relationship("HorseBuyer", back_populates="buyer")
    payments = relationship("InstallmentPayment", back_populates="buyer")

    @validates("email")
    def validate_email(self, key, value):
        assert "@" in value, "Invalid email address"
        return value

    @validates("balance")
    def validate_balance(self, key, value):
        assert isinstance(value, (int, float)), "Balance must be a number"
        return float(value)


class Horse(Base):
    __tablename__ = "horses"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    information = Column(Text)
    image_url = Column(String(500))
    total_value = Column(Float, nullable=False)
    number_of_installments = Column(Integer, nullable=False)
    installment_amount = Column(Float, nullable=False)
    creation_date = Column(DateTime, default=datetime.utcnow)
    total_porcentage = Column(Float, default=0.0)

    # Relationships
    buyers = relationship("HorseBuyer", back_populates="horse")
    transactions = relationship("Transaction", back_populates="horse")
    installments = relationship("Installment", back_populates="horse")

    __table_args__ = (
        CheckConstraint("total_value > 0", name="check_positive_total_value"),
        CheckConstraint(
            "number_of_installments > 0", name="check_positive_installments"
        ),
        CheckConstraint(
            "installment_amount > 0", name="check_positive_installment_amount"
        ),
    )

    @validates("number_of_installments", "total_value")
    def validate_positive(self, key, value):
        assert value > 0, f"{key} must be positive"
        return value

    @validates("installment_amount")
    def validate_installment_amount(self, key, value):
        if hasattr(self, "total_value") and self.total_value:
            assert (
                abs(self.total_value - (value * self.number_of_installments)) < 0.01
            ), "installment_amount * number_of_installments must equal total_value"
        return value


class HorseBuyer(Base):
    __tablename__ = "horse_buyers"

    id = Column(Integer, primary_key=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"))
    buyer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    percentage = Column(Float, nullable=False)
    join_date = Column(DateTime, default=datetime.utcnow)
    active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    horse = relationship("Horse", back_populates="buyers")
    buyer = relationship("User", back_populates="horses_buying")
    installments = relationship("BuyerInstallment", back_populates="horse_buyer")

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


class Installment(Base):
    __tablename__ = "installments"

    id = Column(Integer, primary_key=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"))
    due_date = Column(DateTime, nullable=False)
    amount = Column(Float, nullable=False)
    installment_number = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    horse = relationship("Horse", back_populates="installments")
    buyer_installments = relationship("BuyerInstallment", back_populates="installment")

    __table_args__ = (
        UniqueConstraint(
            "horse_id", "installment_number", name="uix_horse_installment"
        ),
        CheckConstraint("amount > 0", name="check_positive_amount"),
        CheckConstraint(
            "installment_number > 0", name="check_positive_installment_number"
        ),
    )


class BuyerInstallment(Base):
    __tablename__ = "buyer_installments"

    id = Column(Integer, primary_key=True)
    horse_buyer_id = Column(Integer, ForeignKey("horse_buyers.id", ondelete="CASCADE"))
    installment_id = Column(Integer, ForeignKey("installments.id", ondelete="CASCADE"))
    amount = Column(Float, nullable=False)
    amount_paid = Column(Float, default=0.0)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    last_payment_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    horse_buyer = relationship("HorseBuyer", back_populates="installments")
    installment = relationship("Installment", back_populates="buyer_installments")
    payments = relationship("InstallmentPayment", back_populates="buyer_installment")

    __table_args__ = (
        CheckConstraint("amount > 0", name="check_positive_amount"),
        CheckConstraint("amount_paid >= 0", name="check_non_negative_amount_paid"),
    )


class InstallmentPayment(Base):
    __tablename__ = "installment_payments"

    id = Column(Integer, primary_key=True)
    buyer_installment_id = Column(
        Integer, ForeignKey("buyer_installments.id", ondelete="CASCADE")
    )
    transaction_id = Column(Integer, ForeignKey("transactions.id", ondelete="CASCADE"))
    buyer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    buyer_installment = relationship("BuyerInstallment", back_populates="payments")
    transaction = relationship("Transaction", back_populates="installment_payments")
    buyer = relationship("User", back_populates="payments")

    __table_args__ = (CheckConstraint("amount > 0", name="check_positive_amount"),)


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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    horse = relationship("Horse", back_populates="transactions")
    installment_payments = relationship(
        "InstallmentPayment", back_populates="transaction"
    )

    __table_args__ = (
        CheckConstraint("total_amount > 0", name="check_positive_amount"),
    )
