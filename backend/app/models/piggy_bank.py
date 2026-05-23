import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ContributionType(StrEnum):
    transfer = "transfer"
    expense = "expense"


class PiggyBank(Base):
    __tablename__ = "piggy_banks"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(sa.Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(sa.String(10), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(
        sa.Numeric(15, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    target_date: Mapped[date | None] = mapped_column(sa.Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    is_completed: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, default=False, server_default="false"
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


class PiggyBankContribution(Base):
    __tablename__ = "piggy_bank_contributions"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    piggy_bank_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("piggy_banks.id", ondelete="CASCADE"),
        nullable=False,
    )
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("transactions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    contribution_type: Mapped[ContributionType] = mapped_column(
        sa.Enum(ContributionType, name="contributiontype"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(sa.Numeric(15, 2), nullable=False)
    date: Mapped[date] = mapped_column(sa.Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False
    )
