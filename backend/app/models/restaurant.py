import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    address: Mapped[str | None] = mapped_column(String(500))
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    zip_code: Mapped[str | None] = mapped_column(String(20))
    country: Mapped[str] = mapped_column(String(5), default="US")
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    website: Mapped[str | None] = mapped_column(String(255))
    logo_url: Mapped[str | None] = mapped_column(String(500))
    timezone: Mapped[str] = mapped_column(String(50), default="America/New_York")
    currency: Mapped[str] = mapped_column(String(5), default="USD")
    tax_rate: Mapped[float] = mapped_column(default=0.0)
    is_configured: Mapped[bool] = mapped_column(default=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant: Mapped["Tenant | None"] = relationship("Tenant", back_populates="restaurants")  # noqa: F821
    users: Mapped[list["User"]] = relationship("User", back_populates="restaurant", foreign_keys="User.restaurant_id")  # noqa: F821
    settings: Mapped[list["RestaurantSetting"]] = relationship("RestaurantSetting", back_populates="restaurant", cascade="all, delete-orphan")
    menu_categories: Mapped[list["MenuCategory"]] = relationship("MenuCategory", back_populates="restaurant")  # noqa: F821
    menu_items: Mapped[list["MenuItem"]] = relationship("MenuItem", back_populates="restaurant")  # noqa: F821
    tables: Mapped[list["RestaurantTable"]] = relationship("RestaurantTable", back_populates="restaurant")  # noqa: F821
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="restaurant")  # noqa: F821


class RestaurantSetting(Base):
    __tablename__ = "restaurant_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str | None] = mapped_column(Text)  # JSON value
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="settings")

    __table_args__ = (
        __import__("sqlalchemy").UniqueConstraint("restaurant_id", "key"),
    )
