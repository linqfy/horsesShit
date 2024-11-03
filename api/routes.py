from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from . import crud, schemas
from .database import (
    get_db,
    create_horse_with_buyers,
    process_transaction,
    get_buyer_balance_detail,
)

router = APIRouter()


@router.post("/horses/", response_model=schemas.Horse)
def create_horse(horse: schemas.HorseCreate, db: Session = Depends(get_db)):
    """Create a new horse with buyers"""
    try:
        crud.validate_horse_buyers(horse.buyers_data)
        return create_horse_with_buyers(
            db,
            name=horse.name,
            total_value=horse.total_value,
            number_of_installments=horse.number_of_installments,
            buyers_data=horse.buyers_data,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/horses/{horse_id}", response_model=schemas.Horse)
def update_horse(
    horse_id: int,
    horse: schemas.HorseUpdate,
    buyers_data: Optional[List[dict]] = None,
    db: Session = Depends(get_db),
):
    """Update a horse and optionally its buyers"""
    return crud.update_horse(
        db=db, horse_id=horse_id, horse_update=horse, buyers_data=buyers_data
    )


@router.delete("/horses/{horse_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_horse(horse_id: int, db: Session = Depends(get_db)):
    """Delete a horse and all related records"""
    if not crud.delete_horse(db=db, horse_id=horse_id):
        raise HTTPException(status_code=404, detail="Horse not found")
    return {"status": "success"}


@router.put("/horse-buyers/{buyer_id}", response_model=schemas.HorseBuyer)
def update_horse_buyer(
    buyer_id: int, horse_buyer: schemas.HorseBuyerUpdate, db: Session = Depends(get_db)
):
    """Update a horse buyer's information"""
    return crud.update_horse_buyer(db=db, buyer_id=buyer_id, update_data=horse_buyer)


@router.delete("/horse-buyers/{buyer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_horse_buyer(buyer_id: int, db: Session = Depends(get_db)):
    """Delete a horse buyer and redistribute their percentage"""
    if not crud.delete_horse_buyer(db=db, buyer_id=buyer_id):
        raise HTTPException(status_code=404, detail="Horse buyer not found")
    return {"status": "success"}


# Transaction routes
@router.post("/transactions/", response_model=schemas.Transaction)
def create_transaction(
    transaction: schemas.TransactionCreate, db: Session = Depends(get_db)
):
    db_transaction = crud.create_transaction(db=db, transaction=transaction)
    process_transaction(db_transaction, db)
    return db_transaction


@router.put("/transactions/{transaction_id}", response_model=schemas.Transaction)
def update_transaction(
    transaction_id: int,
    transaction: schemas.TransactionUpdate,
    db: Session = Depends(get_db),
):
    db_transaction = crud.get_transaction(db, transaction_id=transaction_id)
    if db_transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return crud.update_transaction(
        db=db, transaction_id=transaction_id, transaction=transaction
    )


@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    if not crud.delete_transaction(db=db, transaction_id=transaction_id):
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"status": "success"}


# Payment routes
@router.post("/payments/", response_model=schemas.InstallmentPayment)
def create_payment(
    payment: schemas.InstallmentPaymentCreate, db: Session = Depends(get_db)
):
    return crud.create_payment(db=db, payment=payment)


@router.put("/payments/{payment_id}", response_model=schemas.InstallmentPayment)
def update_payment(
    payment_id: int,
    payment: schemas.InstallmentPaymentUpdate,
    db: Session = Depends(get_db),
):
    db_payment = crud.get_payment(db, payment_id=payment_id)
    if db_payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    return crud.update_payment(db=db, payment_id=payment_id, payment=payment)


@router.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    if not crud.delete_payment(db=db, payment_id=payment_id):
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"status": "success"}
