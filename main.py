# srv start
# main.py
from fastapi import FastAPI
from api import routes  # Importing routes module
from fastapi.middleware.cors import CORSMiddleware
from api.models import create_tables
from api.overdue_checker import (
    check_overdue_installments,
)  # Importa la función de verificación

app = FastAPI()

# Include all routes from the routes module
app.include_router(routes.router)

# Configure CORS
origins = [
    "http://localhost:3000",  # Frontend origin
    # Add other origins if necessary
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows specified origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods
    allow_headers=["*"],  # Allows all headers
)


# Optional: Define a root endpoint
@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI app!"}


@app.on_event("startup")
def on_startup():
    # Verificar cuotas vencidas al iniciar la aplicación
    check_overdue_installments()
    # Crear tablas si no existen


create_tables()


if __name__ == "__main__":
    import uvicorn

    # log everything

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True, log_level="info")
