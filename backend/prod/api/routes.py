# backend/prod/api/routes.py

from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from .overdue_checker import (
    check_overdue_installments,
)  # Importa la función de verificación
import os
from typing import List
from . import crud, schemas
from .models import *
from .models import get_db  # Asegúrate de importar get_db desde models.py
import logging

router = APIRouter()

# Configuración del logger
logger = logging.getLogger(__name__)

# ----------------------
# Rutas para Usuarios
# ----------------------


# Obtener todos los usuarios
@router.get("/users/", response_model=List[schemas.UserSchema])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_users(db, skip=skip, limit=limit)


# Obtener un usuario por ID
@router.get("/users/{user_id}", response_model=schemas.UserSchema)
def read_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return db_user


# Crear un nuevo usuario
@router.post(
    "/users/", response_model=schemas.UserSchema, status_code=status.HTTP_201_CREATED
)
def create_user(user: schemas.UserCreateSchema, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email ya registrado")
    return crud.create_user(db=db, user=user)


# Actualizar un usuario existente
@router.put("/users/{user_id}", response_model=schemas.UserSchema)
def update_user(
    user_id: int, user: schemas.UserUpdateSchema, db: Session = Depends(get_db)
):
    db_user = crud.get_user(db, user_id=user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return crud.update_user(db=db, user=db_user, user_update=user)


# Eliminar un usuario
@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    success = crud.delete_user(db=db, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ----------------------
# Rutas para Caballos
# ----------------------


# Obtener todos los caballos
@router.get("/horses/", response_model=List[schemas.HorseSchema])
def read_horses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_horses(db, skip=skip, limit=limit)


# Obtener un caballo por ID con detalles
@router.get("/horses/{horse_id}", response_model=schemas.HorseDetailSchema)
def get_horse(horse_id: int, db: Session = Depends(get_db)):
    db_horse = crud.get_horse(db, horse_id=horse_id)
    if not db_horse:
        raise HTTPException(status_code=404, detail="Caballo no encontrado")
    return db_horse


# Crear un nuevo caballo con compradores
@router.post(
    "/horses/",
    response_model=schemas.HorseDetailSchema,
    status_code=status.HTTP_201_CREATED,
)
def create_horse(horse: schemas.HorseCreateSchema, db: Session = Depends(get_db)):
    try:
        return crud.create_horse_with_buyers(db=db, **horse.dict())
    except HTTPException as e:
        raise e
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


# Actualizar un caballo existente
@router.put("/horses/{horse_id}", response_model=schemas.HorseDetailSchema)
def update_horse(
    horse_id: int, horse: schemas.HorseUpdateSchema, db: Session = Depends(get_db)
):
    db_horse = crud.get_horse(db, horse_id=horse_id)
    if not db_horse:
        raise HTTPException(status_code=404, detail="Caballo no encontrado")
    try:
        return crud.update_horse(db=db, horse=db_horse, horse_update=horse)
    except HTTPException as e:
        raise e
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


# Eliminar un caballo
@router.delete("/horses/{horse_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_horse(horse_id: int, db: Session = Depends(get_db)):
    success = crud.delete_horse(db=db, horse_id=horse_id)
    if not success:
        raise HTTPException(status_code=404, detail="Caballo no encontrado")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ----------------------
# Rutas para Compradores de Caballo
# ----------------------


# Obtener todos los compradores de caballo
@router.get("/horse-buyers/", response_model=List[schemas.HorseBuyerSchema])
def read_horse_buyers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_horse_buyers(db, skip=skip, limit=limit)


# Obtener un comprador de caballo por ID
@router.get("/horse-buyers/{horse_buyer_id}", response_model=schemas.HorseBuyerSchema)
def read_horse_buyer(horse_buyer_id: int, db: Session = Depends(get_db)):
    horse_buyer = crud.get_horse_buyer(db, horse_buyer_id=horse_buyer_id)
    if not horse_buyer:
        raise HTTPException(status_code=404, detail="HorseBuyer no encontrado")
    return horse_buyer


# Crear un comprador de caballo
@router.post(
    "/horse-buyers/",
    response_model=schemas.HorseBuyerSchema,
    status_code=status.HTTP_201_CREATED,
)
def create_horse_buyer(
    horse_buyer: schemas.HorseBuyerCreateSchema, db: Session = Depends(get_db)
):
    return crud.create_horse_buyer(db=db, horse_buyer=horse_buyer)


# Actualizar un comprador de caballo
@router.put("/horse-buyers/{horse_buyer_id}", response_model=schemas.HorseBuyerSchema)
def update_horse_buyer(
    horse_buyer_id: int,
    horse_buyer_update: schemas.HorseBuyerUpdateSchema,
    db: Session = Depends(get_db),
):
    horse_buyer = crud.get_horse_buyer(db, horse_buyer_id=horse_buyer_id)
    if not horse_buyer:
        raise HTTPException(status_code=404, detail="HorseBuyer no encontrado")
    return crud.update_horse_buyer(
        db=db, horse_buyer=horse_buyer, horse_buyer_update=horse_buyer_update
    )


# Eliminar un comprador de caballo
@router.delete("/horse-buyers/{horse_buyer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_horse_buyer(horse_buyer_id: int, db: Session = Depends(get_db)):
    success = crud.delete_horse_buyer(db=db, horse_buyer_id=horse_buyer_id)
    if not success:
        raise HTTPException(status_code=404, detail="HorseBuyer no encontrado")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ----------------------
# Rutas para Transacciones
# ----------------------


# Crear una transacción
@router.post(
    "/transactions/",
    response_model=schemas.TransactionSchema,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction(
    transaction: schemas.TransactionCreateSchema, db: Session = Depends(get_db)
):
    try:
        db_transaction = crud.create_transaction(db=db, transaction=transaction)
        # Procesar la transacción de acuerdo a su tipo
        crud.process_transaction(db_transaction, db)
        return db_transaction
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error creando transacción: {str(e)}")
        raise HTTPException(status_code=500, detail="Error creando la transacción")


# Obtener todas las transacciones
@router.get("/transactions/", response_model=List[schemas.TransactionSchema])
def read_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_transactions(db, skip=skip, limit=limit)


# Actualizar una transacción existente
@router.put("/transactions/{transaction_id}", response_model=schemas.TransactionSchema)
def update_transaction(
    transaction_id: int,
    transaction: schemas.TransactionUpdateSchema,
    db: Session = Depends(get_db),
):
    db_transaction = crud.get_transaction(db, transaction_id=transaction_id)
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    try:
        updated_transaction = crud.update_transaction(
            db=db, transaction=db_transaction, transaction_update=transaction
        )
        # Procesar la transacción actualizada
        crud.process_transaction(updated_transaction, db)
        return updated_transaction
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error actualizando transacción: {str(e)}")
        raise HTTPException(status_code=500, detail="Error actualizando la transacción")


# Eliminar una transacción
@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    success = crud.delete_transaction(db=db, transaction_id=transaction_id)
    if not success:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/installments/check-overdue/",
    status_code=status.HTTP_200_OK,
    summary="Verificar y actualizar cuotas vencidas manualmente",
    description="Ejecuta la verificación de cuotas vencidas y actualiza los balances de los compradores.",
)
def manual_check_overdue_installments(db: Session = Depends(get_db)):
    """
    Endpoint para ejecutar manualmente la verificación de cuotas vencidas.
    """
    try:
        check_overdue_installments()
        return {"message": "Verificación de cuotas vencidas ejecutada exitosamente."}
    except Exception as e:
        logger.error(
            f"Error al ejecutar verificación manual de cuotas vencidas: {str(e)}"
        )
        raise HTTPException(
            status_code=500, detail="Error al ejecutar la verificación."
        )


# ----------------------
# Nuevo Endpoint para Pagar Cuotas
# ----------------------


@router.post(
    "/installments/pay/{installment_id}",
    response_model=schemas.BuyerInstallmentSchema,
    status_code=status.HTTP_200_OK,
)
def pay_installment(installment_id: int, db: Session = Depends(get_db)):
    """
    Pagar una cuota y actualizar el estado de la cuota y el balance del comprador.
    """
    try:
        buyer_installment = (
            db.query(BuyerInstallment)
            .filter(BuyerInstallment.id == installment_id)
            .first()
        )
        if not buyer_installment:
            raise HTTPException(status_code=404, detail="Installment not found")

        if buyer_installment.status == PaymentStatus.PAID:
            raise HTTPException(status_code=400, detail="Installment already paid")

        # Realizar el pago
        crud.process_payment(buyer_installment, db)

        return buyer_installment
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error al pagar la cuota: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al pagar la cuota")


# ----------------------
# Endpoint para Registrar PAGO (Administración)
# ----------------------


@router.post(
    "/transactions/pago/",
    response_model=schemas.TransactionSchema,
    status_code=status.HTTP_201_CREATED,
)
def create_pago(
    transaction: schemas.TransactionCreateSchema, db: Session = Depends(get_db)
):
    if transaction.type != "PAGO":
        raise HTTPException(status_code=400, detail="Tipo de transacción debe ser PAGO")

    # Asegurar que el usuario es admin
    admin_user = crud.get_user(db, user_id=transaction.user_id)
    if not admin_user or not admin_user.is_admin:
        raise HTTPException(status_code=403, detail="Usuario no autorizado para PAGO")

    try:
        db_transaction = crud.create_transaction(db=db, transaction=transaction)
        # Procesar la transacción de PAGO
        # Asumiendo que PAGO simplemente registra la transacción sin afectar balances de usuarios
        logger.info(f"PAGO registrado por admin user {admin_user.id}")
        return db_transaction
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error creando PAGO: {str(e)}")
        raise HTTPException(status_code=500, detail="Error creando el PAGO")


# ----------------------
# Endpoint para Obtener el Balance de un Usuario
# ----------------------


@router.get("/users/{user_id}/balance", response_model=schemas.BuyerBalanceDetailSchema)
def get_user_balance_detail(user_id: int, db: Session = Depends(get_db)):
    """
    Obtener el detalle del saldo de un usuario, incluyendo balances individuales de cada HorseBuyer.
    """
    try:
        balance_detail = crud.get_user_balance_detail(user_id, db)
        return balance_detail
    except ValueError as ve:
        logger.error(f"Error al obtener balance: {str(ve)}")
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Error al obtener balance: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Error al obtener el balance del usuario"
        )


@router.get(
    "/horse-buyers/{horse_buyer_id}/installments",
    response_model=List[schemas.BuyerInstallmentSchema],
)
def get_installments(
    horse_buyer_id: int,
    month: int = None,
    year: int = None,
    db: Session = Depends(get_db),
):
    from datetime import datetime

    # Use current month and year as default if not provided
    if month is None or year is None:
        current_date = datetime.utcnow()
        month = month or current_date.month
        year = year or current_date.year

    installments = (
        db.query(BuyerInstallment)
        .join(Installment)
        .filter(BuyerInstallment.horse_buyer_id == horse_buyer_id)
        .filter(Installment.mes == month, Installment.año == year)
        .all()  # Retrieve all matching installments
    )
    return installments


# Get installment by ID
@router.get(
    "/installments/{installment_id}",
    response_model=schemas.InstallmentSchema,
)
def get_installment(installment_id: int, db: Session = Depends(get_db)):
    db_installment = crud.get_installment(db, installment_id=installment_id)
    if not db_installment:
        raise HTTPException(status_code=404, detail="Installment not found")
    return db_installment
