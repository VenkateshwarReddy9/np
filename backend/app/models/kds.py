import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, Boolean, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class KDSStation(Base):
    __tablename__ = "kds_stations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(20), default="#1E40AF")
    auto_route_categories: Mapped[str | None] = mapped_column(Text)  # JSON list of category ids
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tickets: Mapped[list["KDSTicket"]] = relationship("KDSTicket", back_populates="station")


class KDSTicket(Base):
    __tablename__ = "kds_tickets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    order_item_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("order_items.id", ondelete="CASCADE"))
    station_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("kds_stations.id", ondelete="SET NULL"))
    # status: waiting|in_progress|ready|bumped
    status: Mapped[str] = mapped_column(String(20), default="waiting")
    priority: Mapped[int] = mapped_column(Integer, default=0)  # higher = more urgent
    displayed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    bumped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    station: Mapped["KDSStation | None"] = relationship("KDSStation", back_populates="tickets")
    order: Mapped["Order"] = relationship("Order")  # noqa: F821
    order_item: Mapped["OrderItem | None"] = relationship("OrderItem")  # noqa: F821
