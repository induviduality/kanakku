from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def test_db_connect(db_engine: AsyncEngine) -> None:
    async with db_engine.connect() as conn:
        result = await conn.execute(text("SELECT 1"))
        assert result.scalar() == 1
