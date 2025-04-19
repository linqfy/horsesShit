# srv start
# main.py
from fastapi import FastAPI, Depends
from api import routes  # Importing routes module
from fastapi.middleware.cors import CORSMiddleware
from api.models import create_tables
from api.overdue_checker import (
    check_overdue_installments,
)  # Importa la función de verificación
import os
import shutil
import glob
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from api.crud import process_queued_transactions
from api.models import get_db  # Asegúrate de importar get_db desde models.py

# Define the database source and backup directory
DB_FILE = os.path.abspath("horses.db")
BACKUP_DIR = os.path.abspath("backups_datos")

def backup_db():
    """Creates a backup copy of the db and keeps at most 10 backups."""
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
    # Create a timestamped backup file name
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"backup_{timestamp}.db"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)
    try:
        shutil.copy(DB_FILE, backup_path)
        print(f"Database backed up to {backup_path}")
    except Exception as e:
        print(f"Backup failed: {e}")

    # Remove oldest backups if there are more than 10
    backup_files = sorted(glob.glob(os.path.join(BACKUP_DIR, "backup_*.db")))
    if len(backup_files) > 10:
        for file in backup_files[: len(backup_files) - 10]:
            try:
                os.remove(file)
                print(f"Deleted old backup: {file}")
            except Exception as e:
                print(f"Failed to delete {file}: {e}")

# Initialize the scheduler
scheduler = BackgroundScheduler()
app = FastAPI()

# Include all routes from the routes module
app.include_router(routes.router)



# Configure CORS
origins = [
    "http://localhost:3000",  # Frontend origin
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Optional: Define a root endpoint
@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI app!"}


@app.on_event("startup")
def on_startup():
    """Run at application startup: process any queued transactions"""
    # Verificar cuotas vencidas al iniciar la aplicación
    check_overdue_installments()
    
    db = next(get_db())
    try:
        process_queued_transactions(db)
    finally:
        db.close()
    # Crear tablas si no existen
    scheduler.add_job(backup_db, "interval", hours=2, next_run_time=datetime.now())
    scheduler.start()
    print("Scheduler started for database backups.")

@app.on_event("shutdown")
def on_shutdown():
    scheduler.shutdown()
    print("Scheduler shutdown.")
    
create_tables()


if __name__ == "__main__":
    import uvicorn

    # log everything

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True, log_level="debug")
