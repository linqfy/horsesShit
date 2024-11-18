# backend/prod/api/schemas.py

from pydantic import BaseModel, Field, EmailStr, ConfigDict, root_validator
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum


# Enumeraciones compartidas
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


# User Schemas
class UserBaseSchema(BaseModel):
    name: str
    email: EmailStr
    dni: Optional[str] = None
    is_admin: Optional[bool] = None


class UserCreateSchema(UserBaseSchema):
    pass


class UserUpdateSchema(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    dni: Optional[str] = None
    is_admin: Optional[bool] = None
    balance: Optional[float] = None


class UserSchema(UserBaseSchema):
    id: int
    balance: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Horse Schemas
class HorseBaseSchema(BaseModel):
    name: str
    information: Optional[str] = None
    image_url: Optional[str] = None
    total_value: float
    number_of_installments: int


class HorseSchema(HorseBaseSchema):
    id: int
    creation_date: datetime
    total_percentage: float

    model_config = ConfigDict(from_attributes=True)


class HorseCreateSchema(HorseBaseSchema):
    buyers_data: List[dict] = Field(..., example=[{"buyer_id": 1, "percentage": 50.0}])


class HorseUpdateSchema(BaseModel):
    name: Optional[str] = None
    information: Optional[str] = None
    image_url: Optional[str] = None
    total_value: Optional[float] = None
    number_of_installments: Optional[int] = None
    total_percentage: Optional[float] = None  # Corregido el nombre
    buyers_data: Optional[List[dict]] = None  # Agregado


# Horse Buyer Schemas
class HorseBuyerBaseSchema(BaseModel):
    percentage: float
    active: bool = True


class HorseBuyerCreateSchema(HorseBuyerBaseSchema):
    buyer_id: int  # Use the created user's ID
    horse_id: int


class HorseBuyerUpdateSchema(BaseModel):
    percentage: Optional[float] = None
    active: Optional[bool] = None


class HorseBuyerSchema(HorseBuyerBaseSchema):
    id: int
    horse_id: int
    buyer_id: int
    join_date: datetime
    updated_at: datetime
    balance: float
    installments: List["BuyerInstallmentSchema"] = []  # Forward reference

    model_config = ConfigDict(from_attributes=True)


# Installment Schemas
class InstallmentBaseSchema(BaseModel):
    horse_id: int
    due_date: datetime
    amount: float
    installment_number: int


class InstallmentCreateSchema(InstallmentBaseSchema):
    pass


class InstallmentUpdateSchema(BaseModel):
    due_date: Optional[datetime] = None
    amount: Optional[float] = None


class InstallmentSchema(InstallmentBaseSchema):
    id: int
    created_at: datetime
    updated_at: datetime
    buyer_installments: List["BuyerInstallmentSchema"] = []  # Forward reference

    model_config = ConfigDict(from_attributes=True)


# Buyer Installment Schemas
class BuyerInstallmentBaseSchema(BaseModel):
    horse_buyer_id: int
    installment_id: int
    amount: float
    amount_paid: float = 0.0
    status: PaymentStatus = PaymentStatus.PENDING


class BuyerInstallmentCreateSchema(BuyerInstallmentBaseSchema):
    pass


class BuyerInstallmentUpdateSchema(BaseModel):
    amount: Optional[float] = None
    amount_paid: Optional[float] = None
    status: Optional[PaymentStatus] = None


class BuyerInstallmentSchema(BuyerInstallmentBaseSchema):
    id: int
    last_payment_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    payments: List["InstallmentPaymentSchema"] = []  # Forward reference

    model_config = ConfigDict(from_attributes=True)


# Transaction Schemas
class TransactionBaseSchema(BaseModel):
    type: TransactionType
    concept: str
    total_amount: float
    notes: Optional[str] = None
    horse_id: Optional[int] = None
    user_id: Optional[int] = None  # Nuevo campo


class TransactionCreateSchema(TransactionBaseSchema):
    @root_validator(pre=True)
    def check_fields_based_on_type(cls, values):
        transaction_type = values.get("type")
        horse_id = values.get("horse_id")
        user_id = values.get("user_id")

        if transaction_type in ["EGRESO", "PREMIO"]:
            if not horse_id and user_id is None:
                raise ValueError(
                    f"El campo 'horse_id' es requerido para el tipo de transacción '{transaction_type}'"
                )
        elif transaction_type in ["INGRESO", "PAGO"]:
            if not user_id:
                raise ValueError(
                    f"El campo 'user_id' es requerido para el tipo de transacción '{transaction_type}'"
                )
        return values


class TransactionUpdateSchema(BaseModel):
    type: Optional[TransactionType] = None
    concept: Optional[str] = None
    total_amount: Optional[float] = None
    notes: Optional[str] = None
    horse_id: Optional[int] = None
    user_id: Optional[int] = None

    @root_validator(pre=True)
    def check_fields_based_on_type(cls, values):
        transaction_type = values.get("type")
        horse_id = values.get("horse_id")
        user_id = values.get("user_id")

        if transaction_type:
            if transaction_type in ["INGRESO", "EGRESO", "PREMIO"]:
                if "horse_id" not in values or not horse_id:
                    raise ValueError(
                        f"El campo 'horse_id' es requerido para el tipo de transacción '{transaction_type}'"
                    )
            elif transaction_type == "PAGO":
                if "user_id" not in values or not user_id:
                    raise ValueError(
                        "El campo 'user_id' es requerido para el tipo de transacción 'PAGO'"
                    )
        return values


class TransactionSchema(TransactionBaseSchema):
    id: int
    date: datetime
    created_at: datetime
    updated_at: datetime
    installment_payments: List["InstallmentPaymentSchema"] = []

    model_config = ConfigDict(from_attributes=True)


# Installment Payment Schemas
class InstallmentPaymentBaseSchema(BaseModel):
    buyer_installment_id: int
    buyer_id: int
    transaction_id: int
    amount: float


class InstallmentPaymentCreateSchema(InstallmentPaymentBaseSchema):
    pass


class InstallmentPaymentUpdateSchema(BaseModel):
    amount: Optional[float] = None


class InstallmentPaymentSchema(InstallmentPaymentBaseSchema):
    id: int
    payment_date: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Horse Detail Schema
class HorseDetailSchema(BaseModel):
    id: int
    name: str
    information: Optional[str] = None
    image_url: Optional[str] = None
    total_value: float
    number_of_installments: int
    creation_date: datetime
    total_percentage: float
    buyers: List[HorseBuyerSchema] = []
    transactions: List[TransactionSchema] = []
    installments: List[InstallmentSchema] = []

    model_config = ConfigDict(from_attributes=True)


# Schema para Detalle de Balance de Usuario
class BuyerBalanceDetailSchema(BaseModel):
    current_balance: float
    pending_installments: float
    total_paid: float
    horse_balances: List[Dict[str, float]]  # Detalle por HorseBuyer

    model_config = ConfigDict(from_attributes=True)


# Actualizar referencias para forward references
HorseBuyerSchema.update_forward_refs()
BuyerInstallmentSchema.update_forward_refs()
InstallmentPaymentSchema.update_forward_refs()
TransactionSchema.update_forward_refs()
InstallmentSchema.update_forward_refs()
