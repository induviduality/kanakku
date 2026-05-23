import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import select

from app.config import settings
from app.db.session import async_session_factory
from app.models.user import User
from app.routers.accounts import router as accounts_router
from app.routers.auth import router as auth_router
from app.routers.imports import router as imports_router
from app.routers.gpay import router as gpay_router
from app.routers.export import router as export_router
from app.routers.recently_deleted import router as recently_deleted_router
from app.routers.reports import router as reports_router
from app.routers.budgets import router as budgets_router
from app.routers.categories import router as categories_router
from app.routers.dashboard import router as dashboard_router
from app.routers.payees import router as payees_router
from app.routers.payment_methods import router as payment_methods_router
from app.routers.piggy_banks import router as piggy_banks_router
from app.routers.settings import router as settings_router
from app.routers.splits import router as splits_router
from app.routers.subscriptions import router as subscriptions_router
from app.routers.tags import router as tags_router
from app.routers.transactions import router as transactions_router
from app.security.passwords import hash_password

DEV_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
DEV_USER_EMAIL = "dev@kanakku.local"
DEV_USER_PASSWORD = "dev-password"


async def _seed_dev_user() -> None:
    """Create dev user if it doesn't exist, then seed fixture data."""
    if not settings.dev_mode:
        return

    async with async_session_factory() as session:
        result = await session.execute(
            select(User).where(User.id == DEV_USER_ID)
        )
        if result.scalar_one_or_none() is None:
            dev_user = User(
                id=DEV_USER_ID,
                email=DEV_USER_EMAIL,
                password_hash=hash_password(DEV_USER_PASSWORD),
            )
            session.add(dev_user)
            await session.commit()
            print(f"✓ Created dev user: {DEV_USER_EMAIL} / {DEV_USER_PASSWORD}")

    from app.dev_seed import seed_dev_data
    await seed_dev_data(DEV_USER_ID)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await _seed_dev_user()
    yield


app = FastAPI(title="Kanakku", version="0.1.0", lifespan=lifespan)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(accounts_router, prefix="/api/v1")
app.include_router(payment_methods_router, prefix="/api/v1")
app.include_router(payees_router, prefix="/api/v1")
app.include_router(categories_router, prefix="/api/v1")
app.include_router(tags_router, prefix="/api/v1")
app.include_router(transactions_router, prefix="/api/v1")
app.include_router(splits_router, prefix="/api/v1")
app.include_router(budgets_router, prefix="/api/v1")
app.include_router(subscriptions_router, prefix="/api/v1")
app.include_router(piggy_banks_router, prefix="/api/v1")
app.include_router(imports_router, prefix="/api/v1")
app.include_router(export_router, prefix="/api/v1")
app.include_router(gpay_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(recently_deleted_router, prefix="/api/v1")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
