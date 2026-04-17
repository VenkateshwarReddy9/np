import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Float, Integer, Boolean, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    table_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("restaurant_tables.id", ondelete="SET NULL"))
    customer_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    order_number: Mapped[str] = mapped_column(String(20), nullable=False)
    # order_type: dine_in|takeout|delivery|online
    order_type: Mapped[str] = mapped_column(String(20), default="dine_in")
    # status: pending|confirmed|preparing|ready|served|completed|cancelled|refunded
    status: Mapped[str] = mapped_column(String(30), default="pending")
    # source: pos|online|doordash|ubereats|grubhub
    source: Mapped[str] = mapped_column(String(30), default="pos")
    external_order_id: Mapped[str | None] = mapped_column(String(100))
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0)
    tip_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(Text)
    customer_name: Mapped[str | None] = mapped_column(String(200))
    customer_phone: Mapped[str | None] = mapped_column(String(30))
    delivery_address: Mapped[str | None] = mapped_column(Text)
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="orders")  # noqa: F821
    table: Mapped["RestaurantTable | None"] = relationship("RestaurantTable", back_populates="orders")  # noqa: F821
    customer: Mapped["Customer | None"] = relationship("Customer")  # noqa: F821
    items: Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    menu_item_id: Mapped[str] = mapped_column(String(36), ForeignKey("menu_items.id", ondelete="RESTRICT"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    modifier_total: Mapped[float] = mapped_column(Float, default=0.0)
    line_total: Mapped[float] = mapped_column(Float, nullable=False)
    special_instructions: Mapped[str | None] = mapped_column(Text)
    # status: pending|sent|preparing|ready|served|voided
    status: Mapped[str] = mapped_column(String(20), default="pending")
    kds_station: Mapped[str | None] = mapped_column(String(50))
    sent_to_kitchen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    order: Mapped["Order"] = relationship("Order", back_populates="items")
    menu_item: Mapped["MenuItem"] = relationship("MenuItem")  # noqa: F821
    modifiers: Mapped[list["OrderItemModifier"]] = relationship("OrderItemModifier", back_populates="order_item", cascade="all, delete-orphan")


class OrderItemModifier(Base):
    __tablename__ = "order_item_modifiers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_item_id: Mapped[str] = mapped_column(String(36), ForeignKey("order_items.id", ondelete="CASCADE"), nullable=False)
    modifier_option_id: Mapped[str] = mapped_column(String(36), ForeignKey("modifier_options.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # snapshot at order time
    price_at_time: Mapped[float] = mapped_column(Float, default=0.0)

    order_item: Mapped["OrderItem"] = relationship("OrderItem", back_populates="modifiers")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    # method: cash|card|contactless|gift_card|split|online
    method: Mapped[str] = mapped_column(String(30), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    tip_amount: Mapped[float] = mapped_column(Float, default=0.0)
    change_given: Mapped[float] = mapped_column(Float, default=0.0)
    # status: pending|completed|refunded|failed
    status: Mapped[str] = mapped_column(String(20), default="pending")
    transaction_ref: Mapped[str | None] = mapped_column(String(255))
    processor: Mapped[str | None] = mapped_column(String(50))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    refund_reason: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    order: Mapped["Order"] = relationship("Order", back_populates="payments")
