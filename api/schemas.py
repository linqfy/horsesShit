from pydantic import BaseModel, Field, validator, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class TransactionType(str, Enum):
    INGRESO = "INGRESO"
    EGRESO = "EGRESO"
    PREMIO = "PREMIO"
    PAGO = "PAGO"


class PaymentStatus(str, Enum):
    PENDING = "PENDIENTE"
    PARTIAL = "PARCIAL"
    PAID = "PAGADO"
    OVERDUE = "VENCIDO"


# Base User Models
class UserBase(BaseModel):
    name: str
    email: EmailStr
    dni: Optional[int] = None
    is_admin: Optional[bool] = None


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    dni: Optional[int] = None
    is_admin: Optional[bool] = None
    balance: Optional[float] = None


class User(UserBase):
    id: int
    name: str
    email: EmailStr
    dni: Optional[int] = None
    is_admin: bool
    balance: float = 0.0
    created_at: datetime

    class Config:
        orm_mode = True


# Base Horse Models
class HorseBase(BaseModel):
    name: str
    information: Optional[str] = None
    image_url: Optional[str] = None
    total_value: float
    number_of_installments: int


class HorseCreate(HorseBase):
    buyers_data: List[dict] = Field(..., example=[{"buyer_id": 1, "percentage": 50.0}])


class HorseUpdate(BaseModel):
    name: Optional[str] = None
    information: Optional[str] = None
    image_url: Optional[str] = None
    total_value: Optional[float] = None
    number_of_installments: Optional[int] = None
    installment_amount: Optional[float] = None
    total_porcentage: Optional[float] = None  # owned by buyers


class Horse(HorseBase):
    id: int
    creation_date: datetime

    class Config:
        orm_mode = True


# Horse Buyer Models
class HorseBuyerBase(BaseModel):
    percentage: float
    active: bool = True


class HorseBuyerCreate(HorseBuyerBase):
    buyer_id: int  # Use the created user's ID
    horse_id: int


class HorseBuyerUpdate(BaseModel):
    percentage: Optional[float] = None
    active: Optional[bool] = None


class HorseBuyer(HorseBuyerBase):
    id: int
    horse_id: int
    buyer_id: int
    join_date: datetime

    class Config:
        orm_mode = True


# Installment Models
class InstallmentBase(BaseModel):
    horse_id: int
    due_date: datetime
    amount: float
    installment_number: int


class InstallmentCreate(InstallmentBase):
    pass


class InstallmentUpdate(BaseModel):
    due_date: Optional[datetime] = None
    amount: Optional[float] = None


class Installment(InstallmentBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


# Buyer Installment Models
class BuyerInstallmentBase(BaseModel):
    horse_buyer_id: int
    installment_id: int
    amount: float
    amount_paid: float = 0.0
    status: PaymentStatus = PaymentStatus.PENDING


class BuyerInstallmentCreate(BuyerInstallmentBase):
    pass


class BuyerInstallmentUpdate(BaseModel):
    amount: Optional[float] = None
    amount_paid: Optional[float] = None
    status: Optional[PaymentStatus] = None


class BuyerInstallment(BuyerInstallmentBase):
    id: int
    last_payment_date: Optional[datetime]
    created_at: datetime

    class Config:
        orm_mode = True


# Transaction Models
class TransactionBase(BaseModel):
    type: TransactionType
    concept: str
    total_amount: float
    notes: Optional[str] = None
    horse_id: int


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    concept: Optional[str] = None
    total_amount: Optional[float] = None
    notes: Optional[str] = None


class Transaction(TransactionBase):
    id: int
    date: datetime
    created_at: Optional[datetime]

    class Config:
        orm_mode = True


# Payment Models
class InstallmentPaymentBase(BaseModel):
    buyer_installment_id: int
    amount: float


class InstallmentPaymentCreate(InstallmentPaymentBase):
    pass


class InstallmentPaymentUpdate(BaseModel):
    amount: Optional[float] = None


class InstallmentPayment(InstallmentPaymentBase):
    id: int
    transaction_id: int
    buyer_id: int
    payment_date: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
