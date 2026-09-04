import uuid
from datetime import datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Earmark(Base):
    __tablename__ = "earmarks"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    amount: Mapped[Decimal] = mapped_column(sa.Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(sa.String(10), nullable=False)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    piggy_bank_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("piggy_banks.id", ondelete="SET NULL"),
        nullable=True,
    )
    icon: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    color: Mapped[str | None] = mapped_column(sa.String(20), nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
        nullable=False,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
