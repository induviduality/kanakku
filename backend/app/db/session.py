from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine = create_async_engine(settings.database_url, echo=settings.debug)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)

_readonly_engine: AsyncEngine | None = None


def get_readonly_engine() -> AsyncEngine:
    global _readonly_engine
    if _readonly_engine is None:
        _readonly_engine = create_async_engine(settings.readonly_database_url, echo=settings.debug)
    return _readonly_engine


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
