# srv start
# main.py
from fastapi import FastAPI
from api import routes  # Importing routes module
from api.database import create_tables

app = FastAPI()

# Include all routes from the routes module
app.include_router(routes.router)


# Optional: Define a root endpoint
@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI app!"}


@app.on_event("startup")
async def startup():
    create_tables()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
