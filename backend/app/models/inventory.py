import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Float, Integer, Boolean, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class IngredientCategory(Base):
    __tablename__ = "ingredient_categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    ingredients: Mapped[list["Ingredient"]] = relationship("Ingredient", back_populates="category")


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30))
    address: Mapped[str | None] = mapped_column(Text)
    payment_terms: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ingredients: Mapped[list["Ingredient"]] = relationship("Ingredient", back_populates="supplier")
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship("PurchaseOrder", back_populates="supplier")


class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("ingredient_categories.id", ondelete="SET NULL"))
    supplier_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("suppliers.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # unit: kg|g|l|ml|each|oz|lb|cup|tbsp|tsp
    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="each")
    current_stock: Mapped[float] = mapped_column(Float, default=0.0)
    par_level: Mapped[float] = mapped_column(Float, default=0.0)  # reorder trigger level
    reorder_qty: Mapped[float] = mapped_column(Float, default=0.0)
    cost_per_unit: Mapped[float] = mapped_column(Float, default=0.0)
    barcode: Mapped[str | None] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(String(100))  # walk-in|dry-storage|bar
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category: Mapped["IngredientCategory | None"] = relationship("IngredientCategory", back_populates="ingredients")
    supplier: Mapped["Supplier | None"] = relationship("Supplier", back_populates="ingredients")
    transactions: Mapped[list["InventoryTransaction"]] = relationship("InventoryTransaction", back_populates="ingredient")
    waste_logs: Mapped[list["WasteLog"]] = relationship("WasteLog", back_populates="ingredient")

    @property
    def is_low_stock(self) -> bool:
        return self.current_stock <= self.par_level


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    supplier_id: Mapped[str] = mapped_column(String(36), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    po_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    # status: draft|sent|received|partial|cancelled
    status: Mapped[str] = mapped_column(String(20), default="draft")
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(Text)
    ordered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="purchase_orders")
    items: Mapped[list["PurchaseOrderItem"]] = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    purchase_order_id: Mapped[str] = mapped_column(String(36), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    ingredient_id: Mapped[str] = mapped_column(String(36), ForeignKey("ingredients.id", ondelete="RESTRICT"), nullable=False)
    quantity_ordered: Mapped[float] = mapped_column(Float, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    quantity_received: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(String(255))

    purchase_order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="items")
    ingredient: Mapped["Ingredient"] = relationship("Ingredient")


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    ingredient_id: Mapped[str] = mapped_column(String(36), ForeignKey("ingredients.id", ondelete="CASCADE"), nullable=False)
    # type: purchase|usage|waste|adjustment|transfer
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)  # positive = add, negative = subtract
    cost: Mapped[float] = mapped_column(Float, default=0.0)
    reference_id: Mapped[str | None] = mapped_column(String(36))  # order_id or po_id
    reason: Mapped[str | None] = mapped_column(String(255))
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ingredient: Mapped["Ingredient"] = relationship("Ingredient", back_populates="transactions")


class WasteLog(Base):
    __tablename__ = "waste_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    ingredient_id: Mapped[str] = mapped_column(String(36), ForeignKey("ingredients.id", ondelete="CASCADE"), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    # reason: spoilage|overproduction|drop|trimming|other
    reason: Mapped[str] = mapped_column(String(50), nullable=False)
    estimated_cost: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(Text)
    logged_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ingredient: Mapped["Ingredient"] = relationship("Ingredient", back_populates="waste_logs")
