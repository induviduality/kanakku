import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TransactionType(StrEnum):
    expense = "expense"
    income = "income"
    transfer = "transfer"
    opening_balance = "opening_balance"


# Association tables (no ORM class needed — accessed via raw SQL or joined loads)
transaction_categories = sa.Table(
    "transaction_categories",
    Base.metadata,
    sa.Column(
        "transaction_id",
        sa.UUID(as_uuid=True),
        sa.ForeignKey("transactions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    sa.Column(
        "category_id",
        sa.UUID(as_uuid=True),
        sa.ForeignKey("categories.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

transaction_tags = sa.Table(
    "transaction_tags",
    Base.metadata,
    sa.Column(
        "transaction_id",
        sa.UUID(as_uuid=True),
        sa.ForeignKey("transactions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    sa.Column(
        "tag_id",
        sa.UUID(as_uuid=True),
        sa.ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

# budget_id has no FK yet (budgets table added in M5); FK added in that migration
transaction_budgets = sa.Table(
    "transaction_budgets",
    Base.metadata,
    sa.Column(
        "transaction_id",
        sa.UUID(as_uuid=True),
        sa.ForeignKey("transactions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    sa.Column(
        "budget_id",
        sa.UUID(as_uuid=True),
        nullable=False,
        primary_key=True,
    ),
)


class Transaction(Base):
    __tablename__ = "transactions"

    __table_args__ = (
        # transfer requires to_account_id; non-transfer forbids it
        sa.CheckConstraint(
            "(type = 'transfer' AND to_account_id IS NOT NULL) OR "
            "(type != 'transfer' AND to_account_id IS NULL)",
            name="ck_transaction_transfer_to_account",
        ),
        # amount must be positive
        sa.CheckConstraint("amount > 0", name="ck_transaction_amount_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[TransactionType] = mapped_column(
        sa.Enum(TransactionType), nullable=False
    )
    transacted_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(sa.Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(sa.String(10), nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    account_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    payment_method_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("payment_methods.id", ondelete="SET NULL"),
        nullable=True,
    )
    payee_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("payees.id", ondelete="SET NULL"),
        nullable=True,
    )
    to_account_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=True,
    )
    to_amount: Mapped[Decimal | None] = mapped_column(sa.Numeric(15, 2), nullable=True)
    to_currency: Mapped[str | None] = mapped_column(sa.String(10), nullable=True)
    # subscription_id populated in M6; column added now so migrations are additive
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True), nullable=True
    )
    # import_record_id populated in M8
    import_record_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True), nullable=True
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
