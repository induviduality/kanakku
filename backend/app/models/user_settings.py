import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    primary_currency: Mapped[str] = mapped_column(sa.String(10), nullable=False, default="INR")
    timezone: Mapped[str] = mapped_column(sa.String(64), nullable=False, default="Asia/Kolkata")
    date_format: Mapped[str] = mapped_column(sa.String(32), nullable=False, default="DD/MM/YYYY")
    number_format: Mapped[str] = mapped_column(sa.String(32), nullable=False, default="en-IN")
    updated_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
        nullable=False,
    )
