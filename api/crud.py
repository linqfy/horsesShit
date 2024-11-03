from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, List, Dict
from . import models, schemas
from .database import (
    User,
    Horse,
    Transaction,
    InstallmentPayment,
    HorseBuyer,
    BuyerInstallment,
    Installment,
    PaymentStatus,
)
from fastapi import HTTPException
from datetime import datetime


def validate_horse_buyers(buyers_data: List[Dict]) -> None:
    """Validate horse buyers data before creation/update"""
    if not buyers_data:
        raise ValueError("At least one buyer is required")


def delete_horse(db: Session, horse_id: int) -> bool:
    """
    Delete a horse and all related records.
    Returns True if successful, False if horse not found.
    """
    horse = db.query(Horse).filter(Horse.id == horse_id).first()
    if not horse:
        return False

    try:
        # Delete related records (cascade should handle this, but being explicit)
        db.query(BuyerInstallment).join(HorseBuyer).filter(
            HorseBuyer.horse_id == horse_id
        ).delete(synchronize_session=False)
        db.query(Installment).filter(Installment.horse_id == horse_id).delete(
            synchronize_session=False
        )
        db.query(HorseBuyer).filter(HorseBuyer.horse_id == horse_id).delete(
            synchronize_session=False
        )
        db.query(Transaction).filter(Transaction.horse_id == horse_id).delete(
            synchronize_session=False
        )

        # Delete the horse
        db.delete(horse)
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting horse: {str(e)}")


def update_horse(
    db: Session,
    horse_id: int,
    horse_update: schemas.HorseUpdate,
    buyers_data: Optional[List[Dict]] = None,
) -> Horse:
    """
    Update a horse and optionally its buyers.
    Raises HTTPException if validation fails.
    """
    horse = db.query(Horse).filter(Horse.id == horse_id).first()
    if not horse:
        raise HTTPException(status_code=404, detail="Horse not found")

    try:
        # Update horse basic information
        for key, value in horse_update.dict(exclude_unset=True).items():
            setattr(horse, key, value)

        # If buyers data is provided, update buyers
        if buyers_data is not None:
            validate_horse_buyers(buyers_data)

            # Delete existing buyers and their installments
            existing_buyers = (
                db.query(HorseBuyer).filter(HorseBuyer.horse_id == horse_id).all()
            )
            for buyer in existing_buyers:
                db.delete(buyer)

            # Create new buyers
            for buyer_data in buyers_data:
                horse_buyer = HorseBuyer(
                    horse_id=horse_id,
                    buyer_id=buyer_data["buyer_id"],
                    percentage=buyer_data["percentage"],
                )
                db.add(horse_buyer)

            # Recalculate installments for new buyers
            recalculate_installments(db, horse)

        db.commit()
        db.refresh(horse)
        return horse
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


def recalculate_installments(db: Session, horse: Horse) -> None:
    """Recalculate installments for all buyers of a horse"""
    installments = db.query(Installment).filter(Installment.horse_id == horse.id).all()

    for installment in installments:
        # Delete existing buyer installments
        db.query(BuyerInstallment).filter(
            BuyerInstallment.installment_id == installment.id
        ).delete(synchronize_session=False)

        # Create new buyer installments
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


def update_horse_buyer(
    db: Session, buyer_id: int, update_data: schemas.HorseBuyerUpdate
) -> HorseBuyer:
    """
    Update a horse buyer's information.
    Handles percentage updates by rebalancing other buyers.
    """
    horse_buyer = db.query(HorseBuyer).filter(HorseBuyer.id == buyer_id).first()
    if not horse_buyer:
        raise HTTPException(status_code=404, detail="Horse buyer not found")

    try:
        if update_data.percentage is not None:
            # Validate new percentage
            other_buyers = (
                db.query(HorseBuyer)
                .filter(
                    and_(
                        HorseBuyer.horse_id == horse_buyer.horse_id,
                        HorseBuyer.id != buyer_id,
                    )
                )
                .all()
            )

            total_others = sum(b.percentage for b in other_buyers)
            if abs((total_others + update_data.percentage) - 100) > 0.01:
                raise ValueError("Total percentage must equal 100%")

            horse_buyer.percentage = update_data.percentage

        if update_data.active is not None:
            horse_buyer.active = update_data.active

        db.commit()
        db.refresh(horse_buyer)
        return horse_buyer
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


def delete_horse_buyer(db: Session, buyer_id: int) -> bool:
    """
    Delete a horse buyer if there are other buyers to take over the percentage.
    Returns True if successful, False if buyer not found.
    """
    horse_buyer = db.query(HorseBuyer).filter(HorseBuyer.id == buyer_id).first()
    if not horse_buyer:
        return False

    try:
        # Check if this is the last buyer
        other_buyers = (
            db.query(HorseBuyer)
            .filter(
                and_(
                    HorseBuyer.horse_id == horse_buyer.horse_id,
                    HorseBuyer.id != buyer_id,
                )
            )
            .all()
        )

        if not other_buyers:
            raise ValueError("Cannot delete the last buyer of a horse")

        # Redistribute percentage to other buyers proportionally
        total_others_percentage = sum(b.percentage for b in other_buyers)
        ratio = (100 / total_others_percentage) if total_others_percentage > 0 else 0

        for other_buyer in other_buyers:
            other_buyer.percentage *= ratio

        # Delete the buyer and their installments
        db.delete(horse_buyer)
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# User operations
def get_user(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(User).offset(skip).limit(limit).all()


def create_user(db: Session, user: schemas.UserCreate):
    db_user = User(**user.dict())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


# Horse operations
def get_horse(db: Session, horse_id: int):
    return db.query(Horse).filter(Horse.id == horse_id).first()


def get_horses(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Horse).offset(skip).limit(limit).all()


def get_horse_buyers(db: Session, horse_id: int):
    return db.query(HorseBuyer).filter(HorseBuyer.horse_id == horse_id).all()


# Transaction operations
def create_transaction(db: Session, transaction: schemas.TransactionCreate):
    db_transaction = Transaction(**transaction.dict())
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


def get_transactions(
    db: Session,
    horse_id: Optional[int] = None,
    transaction_type: Optional[schemas.TransactionType] = None,
    skip: int = 0,
    limit: int = 100,
):
    query = db.query(Transaction)
    if horse_id:
        query = query.filter(Transaction.horse_id == horse_id)
    if transaction_type:
        query = query.filter(Transaction.type == transaction_type)
    return query.offset(skip).limit(limit).all()


# Payment operations
def create_payment(db: Session, payment: schemas.InstallmentPaymentCreate):
    # Get the buyer_installment to verify it exists and get the buyer_id
    buyer_installment = db.query(BuyerInstallment).get(payment.buyer_installment_id)
    if not buyer_installment:
        raise ValueError("Invalid buyer_installment_id")

    # Create transaction for this payment
    transaction = Transaction(
        type=schemas.TransactionType.INGRESO,
        concept=f"Payment for installment {buyer_installment.installment.installment_number}",
        total_amount=payment.amount,
        horse_id=buyer_installment.horse_buyer.horse_id,
    )
    db.add(transaction)
    db.flush()

    # Create the payment
    db_payment = InstallmentPayment(
        **payment.dict(),
        transaction_id=transaction.id,
        buyer_id=buyer_installment.horse_buyer.buyer_id,
    )
    db.add(db_payment)

    # Update buyer_installment
    buyer_installment.amount_paid += payment.amount
    buyer_installment.last_payment_date = db_payment.payment_date

    db.commit()
    db.refresh(db_payment)
    return db_payment


def get_payments(
    db: Session,
    buyer_id: Optional[int] = None,
    horse_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
):
    query = db.query(InstallmentPayment)

    if buyer_id:
        query = query.filter(InstallmentPayment.buyer_id == buyer_id)

    if horse_id:
        query = (
            query.join(BuyerInstallment)
            .join(HorseBuyer)
            .filter(HorseBuyer.horse_id == horse_id)
        )

    return query.offset(skip).limit(limit).all()
