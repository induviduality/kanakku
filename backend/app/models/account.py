import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AccountType(StrEnum):
    bank = "bank"
    cash = "cash"
    credit_card = "credit_card"
    loan = "loan"


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    type: Mapped[AccountType] = mapped_column(sa.Enum(AccountType), nullable=False)
    currency: Mapped[str] = mapped_column(sa.String(10), nullable=False)
    opening_balance: Mapped[Decimal] = mapped_column(
        sa.Numeric(15, 2), nullable=False, default=Decimal("0")
    )
    current_balance: Mapped[Decimal] = mapped_column(
        sa.Numeric(15, 2), nullable=False, default=Decimal("0")
    )
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=True)
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
