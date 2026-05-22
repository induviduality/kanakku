from fastapi import FastAPI

from app.routers.auth import router as auth_router

app = FastAPI(title="Kanakku", version="0.1.0")
app.include_router(auth_router, prefix="/api/v1")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
