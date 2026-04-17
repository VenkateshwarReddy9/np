import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, Float, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class TableSection(Base):
    __tablename__ = "table_sections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#3B82F6")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tables: Mapped[list["RestaurantTable"]] = relationship("RestaurantTable", back_populates="section")


class RestaurantTable(Base):
    __tablename__ = "restaurant_tables"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    section_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("table_sections.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=4)
    # Floor plan position
    pos_x: Mapped[float] = mapped_column(Float, default=0.0)
    pos_y: Mapped[float] = mapped_column(Float, default=0.0)
    width: Mapped[float] = mapped_column(Float, default=80.0)
    height: Mapped[float] = mapped_column(Float, default=80.0)
    shape: Mapped[str] = mapped_column(String(20), default="rectangle")  # rectangle|circle|bar
    # Status: available|occupied|reserved|cleaning|inactive
    status: Mapped[str] = mapped_column(String(20), default="available")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="tables")  # noqa: F821
    section: Mapped["TableSection | None"] = relationship("TableSection", back_populates="tables")
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="table")  # noqa: F821
    reservations: Mapped[list["Reservation"]] = relationship("Reservation", back_populates="table")  # noqa: F821
