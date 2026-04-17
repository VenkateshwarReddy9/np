import uuid
from datetime import datetime, date, time
from sqlalchemy import String, DateTime, Date, Time, Integer, Boolean, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    table_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("restaurant_tables.id", ondelete="SET NULL"))
    customer_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    # Guest info (used when no customer profile)
    guest_name: Mapped[str] = mapped_column(String(200), nullable=False)
    guest_phone: Mapped[str | None] = mapped_column(String(30))
    guest_email: Mapped[str | None] = mapped_column(String(255))
    party_size: Mapped[int] = mapped_column(Integer, nullable=False)
    reservation_date: Mapped[date] = mapped_column(Date, nullable=False)
    time_slot: Mapped[time] = mapped_column(Time, nullable=False)
    duration_min: Mapped[int] = mapped_column(Integer, default=90)
    # Status: pending|confirmed|seated|completed|cancelled|no_show
    status: Mapped[str] = mapped_column(String(30), default="confirmed")
    notes: Mapped[str | None] = mapped_column(Text)
    confirmation_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    occasion: Mapped[str | None] = mapped_column(String(100))  # birthday|anniversary|etc
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    table: Mapped["RestaurantTable | None"] = relationship("RestaurantTable", back_populates="reservations")  # noqa: F821
    customer: Mapped["Customer | None"] = relationship("Customer")  # noqa: F821


class Waitlist(Base):
    __tablename__ = "waitlist"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    guest_name: Mapped[str] = mapped_column(String(200), nullable=False)
    guest_phone: Mapped[str | None] = mapped_column(String(30))
    party_size: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    estimated_wait_min: Mapped[int | None] = mapped_column(Integer)
    # Status: waiting|notified|seated|removed
    status: Mapped[str] = mapped_column(String(20), default="waiting")
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    seated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
