import uuid
from datetime import datetime
from enum import StrEnum

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

payee_default_categories = sa.Table(
    "payee_default_categories",
    Base.metadata,
    sa.Column(
        "payee_id",
        sa.UUID(as_uuid=True),
        sa.ForeignKey("payees.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    sa.Column(
        "category_id",
        sa.UUID(as_uuid=True),
        sa.ForeignKey("categories.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class CategoryApplicability(StrEnum):
    expense = "expense"
    income = "income"
    both = "both"


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    icon: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    color: Mapped[str | None] = mapped_column(sa.String(32), nullable=True)
    applicability: Mapped[CategoryApplicability | None] = mapped_column(
        sa.Enum(CategoryApplicability), nullable=True
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
