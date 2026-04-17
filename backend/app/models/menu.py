import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Float, Integer, Boolean, ForeignKey, Text, func, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

# Association tables
item_allergen_table = Table(
    "item_allergens",
    Base.metadata,
    Column("menu_item_id", String(36), ForeignKey("menu_items.id", ondelete="CASCADE")),
    Column("allergen_id", String(36), ForeignKey("allergens.id", ondelete="CASCADE")),
)

item_modifier_table = Table(
    "item_modifiers",
    Base.metadata,
    Column("menu_item_id", String(36), ForeignKey("menu_items.id", ondelete="CASCADE")),
    Column("modifier_group_id", String(36), ForeignKey("modifier_groups.id", ondelete="CASCADE")),
)


class MenuCategory(Base):
    __tablename__ = "menu_categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    available_start: Mapped[str | None] = mapped_column(String(10))  # "HH:MM"
    available_end: Mapped[str | None] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="menu_categories")  # noqa: F821
    items: Mapped[list["MenuItem"]] = relationship("MenuItem", back_populates="category", cascade="all, delete-orphan")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[str] = mapped_column(String(36), ForeignKey("menu_categories.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    base_price: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    cost_price: Mapped[float] = mapped_column(Float, default=0.0)  # cached cost to make
    calories: Mapped[int | None] = mapped_column(Integer)
    prep_time_min: Mapped[int] = mapped_column(Integer, default=10)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    image_url: Mapped[str | None] = mapped_column(String(500))
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    station: Mapped[str | None] = mapped_column(String(50))  # grill|fry|salad|bar|expo
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="menu_items")  # noqa: F821
    category: Mapped["MenuCategory | None"] = relationship("MenuCategory", back_populates="items")
    modifier_groups: Mapped[list["ModifierGroup"]] = relationship("ModifierGroup", secondary=item_modifier_table, back_populates="items")
    allergens: Mapped[list["Allergen"]] = relationship("Allergen", secondary=item_allergen_table, back_populates="items")
    ingredients: Mapped[list["MenuItemIngredient"]] = relationship("MenuItemIngredient", back_populates="menu_item", cascade="all, delete-orphan")

    @property
    def profit_margin(self) -> float:
        if self.base_price > 0:
            return round((self.base_price - self.cost_price) / self.base_price * 100, 2)
        return 0.0


class ModifierGroup(Base):
    __tablename__ = "modifier_groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    min_selections: Mapped[int] = mapped_column(Integer, default=0)
    max_selections: Mapped[int] = mapped_column(Integer, default=1)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    options: Mapped[list["ModifierOption"]] = relationship("ModifierOption", back_populates="group", cascade="all, delete-orphan")
    items: Mapped[list["MenuItem"]] = relationship("MenuItem", secondary=item_modifier_table, back_populates="modifier_groups")


class ModifierOption(Base):
    __tablename__ = "modifier_options"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    modifier_group_id: Mapped[str] = mapped_column(String(36), ForeignKey("modifier_groups.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price_adjustment: Mapped[float] = mapped_column(Float, default=0.0)
    cost_adjustment: Mapped[float] = mapped_column(Float, default=0.0)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    group: Mapped["ModifierGroup"] = relationship("ModifierGroup", back_populates="options")


class Allergen(Base):
    __tablename__ = "allergens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50))

    items: Mapped[list["MenuItem"]] = relationship("MenuItem", secondary=item_allergen_table, back_populates="allergens")


# Alias association model classes for explicit FK reference
class ItemModifier(Base):
    __tablename__ = "item_modifiers_explicit"
    __table_args__ = {"extend_existing": True}
    # Use the Table() approach above instead
    menu_item_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    modifier_group_id: Mapped[str] = mapped_column(String(36), primary_key=True)


class ItemAllergen(Base):
    __tablename__ = "item_allergens_explicit"
    __table_args__ = {"extend_existing": True}
    menu_item_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    allergen_id: Mapped[str] = mapped_column(String(36), primary_key=True)


class MenuItemIngredient(Base):
    """Links a menu item to its ingredients for real-time cost calculation."""
    __tablename__ = "menu_item_ingredients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    menu_item_id: Mapped[str] = mapped_column(String(36), ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False)
    ingredient_id: Mapped[str] = mapped_column(String(36), ForeignKey("ingredients.id", ondelete="CASCADE"), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)

    menu_item: Mapped["MenuItem"] = relationship("MenuItem", back_populates="ingredients")
    ingredient: Mapped["Ingredient"] = relationship("Ingredient")  # noqa: F821
