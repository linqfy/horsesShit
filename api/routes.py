from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from . import crud, schemas
from .database import *

router = APIRouter()


# userss
@router.get("/users/", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all users"""
    return crud.get_users(db, skip=skip, limit=limit)


@router.get("/users/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(get_db)):
    """Get a user by ID"""
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@router.post("/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Create a new user"""
    return crud.create_user(db=db, user=user)


@router.get("/horses/", response_model=List[schemas.Horse])
def read_horses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all horses"""
    return crud.get_horses(db, skip=skip, limit=limit)


@router.get("/horses/{horse_id}", response_model=schemas.Horse)
def read_horse(horse_id: int, db: Session = Depends(get_db)):
    """Get a horse by ID"""
    db_horse = crud.get_horse(db, horse_id=horse_id)
    if db_horse is None:
        raise HTTPException(status_code=404, detail="Horse not found")
    return db_horse


@router.get("/horse-buyers/{horse_id}", response_model=List[schemas.HorseBuyer])
def read_horse_buyer(horse_id: int, db: Session = Depends(get_db)):
    db_buyers = crud.get_horse_buyers(db, horse_id=horse_id)
    if not db_buyers:
        raise HTTPException(status_code=404, detail="Horse buyers not found")
    return db_buyers


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
            information=horse.information,
            image_url=horse.image_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# pq fast api esta chistoso quiere q todo este adentro de un akey llamada horse xd
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
