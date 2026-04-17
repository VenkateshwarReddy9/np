"""
Seed script — creates a demo restaurant with sample data.
Run: python -m app.seed
"""
import asyncio
import uuid
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext

from app.database import AsyncSessionLocal
from app.models.restaurant import Restaurant
from app.models.user import User
from app.models.menu import MenuCategory, MenuItem, ModifierGroup, ModifierOption, Allergen
from app.models.table import TableSection, RestaurantTable
from app.models.inventory import IngredientCategory, Ingredient, Supplier
from app.models.customer import LoyaltyProgram
from app.models.kds import KDSStation
from app.models.accounting import Account

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed(db: AsyncSession) -> None:
    print("🌱 Seeding demo data...")

    # Restaurant
    restaurant = Restaurant(
        id=str(uuid.uuid4()),
        name="The Demo Kitchen",
        slug="demo-kitchen",
        address="123 Main Street",
        city="Springfield",
        state="IL",
        zip_code="62701",
        phone="(217) 555-0100",
        email="info@demokitchen.com",
        timezone="America/Chicago",
        currency="USD",
        tax_rate=8.5,
        is_configured=True,
    )
    db.add(restaurant)

    # Owner user
    owner = User(
        id=str(uuid.uuid4()),
        restaurant_id=restaurant.id,
        email="owner@demokitchen.com",
        password_hash=pwd_context.hash("demo1234"),
        role="owner",
        first_name="Alex",
        last_name="Rivera",
        phone="(217) 555-0101",
        pin=pwd_context.hash("1234"),
    )
    db.add(owner)

    # Manager user
    manager = User(
        id=str(uuid.uuid4()),
        restaurant_id=restaurant.id,
        email="manager@demokitchen.com",
        password_hash=pwd_context.hash("demo1234"),
        role="manager",
        first_name="Sam",
        last_name="Chen",
        pin=pwd_context.hash("5678"),
    )
    db.add(manager)

    # Cashier
    cashier = User(
        id=str(uuid.uuid4()),
        restaurant_id=restaurant.id,
        email="cashier@demokitchen.com",
        password_hash=pwd_context.hash("demo1234"),
        role="cashier",
        first_name="Jordan",
        last_name="Kim",
        pin=pwd_context.hash("9012"),
    )
    db.add(cashier)

    # Kitchen user
    kitchen_user = User(
        id=str(uuid.uuid4()),
        restaurant_id=restaurant.id,
        email="kitchen@demokitchen.com",
        password_hash=pwd_context.hash("demo1234"),
        role="kitchen",
        first_name="Taylor",
        last_name="Singh",
        pin=pwd_context.hash("3456"),
    )
    db.add(kitchen_user)

    await db.flush()

    # KDS Stations
    grill_station = KDSStation(
        restaurant_id=restaurant.id,
        name="Grill",
        display_order=0,
        color="#DC2626",
    )
    fry_station = KDSStation(
        restaurant_id=restaurant.id,
        name="Fry",
        display_order=1,
        color="#F59E0B",
    )
    salad_station = KDSStation(
        restaurant_id=restaurant.id,
        name="Salad / Cold",
        display_order=2,
        color="#10B981",
    )
    bar_station = KDSStation(
        restaurant_id=restaurant.id,
        name="Bar",
        display_order=3,
        color="#6366F1",
    )
    db.add_all([grill_station, fry_station, salad_station, bar_station])

    # Allergens
    allergens_data = [
        ("Gluten", "🌾"), ("Dairy", "🥛"), ("Eggs", "🥚"),
        ("Peanuts", "🥜"), ("Tree Nuts", "🌰"), ("Fish", "🐟"),
        ("Shellfish", "🦐"), ("Soy", "🫘"), ("Sesame", "🌿"),
    ]
    allergens = []
    for name, icon in allergens_data:
        a = Allergen(name=name, icon=icon)
        db.add(a)
        allergens.append(a)

    # Menu Categories
    cat_appetizers = MenuCategory(restaurant_id=restaurant.id, name="Appetizers", display_order=0)
    cat_burgers = MenuCategory(restaurant_id=restaurant.id, name="Burgers & Sandwiches", display_order=1)
    cat_mains = MenuCategory(restaurant_id=restaurant.id, name="Main Courses", display_order=2)
    cat_salads = MenuCategory(restaurant_id=restaurant.id, name="Salads", display_order=3)
    cat_sides = MenuCategory(restaurant_id=restaurant.id, name="Sides", display_order=4)
    cat_drinks = MenuCategory(restaurant_id=restaurant.id, name="Beverages", display_order=5)
    cat_desserts = MenuCategory(restaurant_id=restaurant.id, name="Desserts", display_order=6)
    db.add_all([cat_appetizers, cat_burgers, cat_mains, cat_salads, cat_sides, cat_drinks, cat_desserts])

    await db.flush()

    # Modifier: Protein temp
    temp_group = ModifierGroup(
        restaurant_id=restaurant.id,
        name="Cook Temperature",
        is_required=True,
        min_selections=1,
        max_selections=1,
    )
    db.add(temp_group)

    size_group = ModifierGroup(
        restaurant_id=restaurant.id,
        name="Size",
        is_required=True,
        min_selections=1,
        max_selections=1,
    )
    db.add(size_group)

    extras_group = ModifierGroup(
        restaurant_id=restaurant.id,
        name="Add-ons",
        is_required=False,
        min_selections=0,
        max_selections=5,
    )
    db.add(extras_group)

    await db.flush()

    for i, temp in enumerate(["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"]):
        db.add(ModifierOption(modifier_group_id=temp_group.id, name=temp, display_order=i, is_default=(temp == "Medium")))

    for i, (size, adj) in enumerate([("Small", -2.0), ("Regular", 0.0), ("Large", 3.0)]):
        db.add(ModifierOption(modifier_group_id=size_group.id, name=size, price_adjustment=adj, display_order=i, is_default=(size == "Regular")))

    for name, adj in [("Bacon", 2.0), ("Extra Cheese", 1.5), ("Avocado", 2.5), ("Fried Egg", 1.5), ("Mushrooms", 1.0)]:
        db.add(ModifierOption(modifier_group_id=extras_group.id, name=name, price_adjustment=adj))

    # Menu Items
    items = [
        MenuItem(restaurant_id=restaurant.id, category_id=cat_appetizers.id, name="Crispy Calamari", description="Lightly breaded calamari with marinara sauce", base_price=12.99, cost_price=3.50, calories=380, prep_time_min=8, station="fry", display_order=0),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_appetizers.id, name="Bruschetta", description="Toasted bread with fresh tomato, basil, and garlic", base_price=9.99, cost_price=2.20, calories=220, prep_time_min=5, station="salad", display_order=1),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_appetizers.id, name="Spinach Artichoke Dip", description="Creamy dip served with tortilla chips", base_price=11.99, cost_price=2.80, calories=450, prep_time_min=7, station="grill", display_order=2),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_burgers.id, name="Classic Cheeseburger", description="8oz beef patty, cheddar, lettuce, tomato, special sauce", base_price=15.99, cost_price=5.20, calories=720, prep_time_min=12, station="grill", display_order=0),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_burgers.id, name="BBQ Bacon Burger", description="8oz beef patty, crispy bacon, BBQ sauce, onion rings", base_price=18.99, cost_price=6.80, calories=890, prep_time_min=14, station="grill", display_order=1),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_burgers.id, name="Veggie Burger", description="Black bean patty, avocado, roasted peppers", base_price=14.99, cost_price=3.90, calories=520, prep_time_min=10, station="grill", display_order=2),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_mains.id, name="Grilled Salmon", description="Atlantic salmon, lemon butter, seasonal vegetables", base_price=24.99, cost_price=9.50, calories=520, prep_time_min=15, station="grill", display_order=0),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_mains.id, name="Chicken Parmesan", description="Breaded chicken breast, marinara, mozzarella, pasta", base_price=19.99, cost_price=6.20, calories=780, prep_time_min=18, station="grill", display_order=1),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_mains.id, name="NY Strip Steak 12oz", description="Prime strip steak, garlic butter, choice of side", base_price=34.99, cost_price=14.00, calories=680, prep_time_min=20, station="grill", display_order=2),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_salads.id, name="Caesar Salad", description="Romaine, croutons, parmesan, Caesar dressing", base_price=11.99, cost_price=2.50, calories=380, prep_time_min=5, station="salad", display_order=0),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_salads.id, name="Greek Salad", description="Cucumber, tomato, olives, feta, red onion", base_price=12.99, cost_price=2.80, calories=290, prep_time_min=5, station="salad", display_order=1),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_sides.id, name="French Fries", description="Crispy seasoned fries", base_price=4.99, cost_price=0.80, calories=380, prep_time_min=8, station="fry", display_order=0),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_sides.id, name="Onion Rings", description="Beer-battered onion rings", base_price=5.99, cost_price=1.10, calories=420, prep_time_min=8, station="fry", display_order=1),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_drinks.id, name="Soft Drink", description="Coke, Diet Coke, Sprite, Lemonade", base_price=3.49, cost_price=0.40, calories=150, prep_time_min=1, station="bar", display_order=0),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_drinks.id, name="Craft Beer (Pint)", description="Local rotating selection", base_price=7.99, cost_price=2.50, calories=200, prep_time_min=2, station="bar", display_order=1),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_drinks.id, name="House Wine (Glass)", description="Red or White", base_price=8.99, cost_price=2.00, calories=125, prep_time_min=2, station="bar", display_order=2),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_desserts.id, name="Chocolate Lava Cake", description="Warm chocolate cake, vanilla ice cream", base_price=8.99, cost_price=2.20, calories=520, prep_time_min=10, station="grill", display_order=0),
        MenuItem(restaurant_id=restaurant.id, category_id=cat_desserts.id, name="New York Cheesecake", description="Classic cheesecake, strawberry topping", base_price=7.99, cost_price=1.80, calories=480, prep_time_min=3, station="salad", display_order=1),
    ]
    for item in items:
        db.add(item)

    # Table sections & tables
    dining_section = TableSection(restaurant_id=restaurant.id, name="Main Dining", color="#3B82F6")
    patio_section = TableSection(restaurant_id=restaurant.id, name="Patio", color="#10B981")
    bar_section = TableSection(restaurant_id=restaurant.id, name="Bar", color="#8B5CF6")
    db.add_all([dining_section, patio_section, bar_section])

    await db.flush()

    tables = [
        # Main dining - 2-tops
        RestaurantTable(restaurant_id=restaurant.id, section_id=dining_section.id, name="T1", capacity=2, pos_x=50, pos_y=50, shape="circle"),
        RestaurantTable(restaurant_id=restaurant.id, section_id=dining_section.id, name="T2", capacity=2, pos_x=160, pos_y=50, shape="circle"),
        RestaurantTable(restaurant_id=restaurant.id, section_id=dining_section.id, name="T3", capacity=4, pos_x=280, pos_y=50, shape="rectangle"),
        RestaurantTable(restaurant_id=restaurant.id, section_id=dining_section.id, name="T4", capacity=4, pos_x=400, pos_y=50, shape="rectangle"),
        RestaurantTable(restaurant_id=restaurant.id, section_id=dining_section.id, name="T5", capacity=6, pos_x=50, pos_y=180, shape="rectangle", width=120.0),
        RestaurantTable(restaurant_id=restaurant.id, section_id=dining_section.id, name="T6", capacity=6, pos_x=220, pos_y=180, shape="rectangle", width=120.0),
        RestaurantTable(restaurant_id=restaurant.id, section_id=dining_section.id, name="T7", capacity=8, pos_x=50, pos_y=310, shape="rectangle", width=200.0),
        # Patio
        RestaurantTable(restaurant_id=restaurant.id, section_id=patio_section.id, name="P1", capacity=2, pos_x=50, pos_y=50, shape="circle"),
        RestaurantTable(restaurant_id=restaurant.id, section_id=patio_section.id, name="P2", capacity=4, pos_x=160, pos_y=50, shape="rectangle"),
        RestaurantTable(restaurant_id=restaurant.id, section_id=patio_section.id, name="P3", capacity=4, pos_x=290, pos_y=50, shape="rectangle"),
        # Bar stools
        RestaurantTable(restaurant_id=restaurant.id, section_id=bar_section.id, name="B1", capacity=1, pos_x=50, pos_y=50, shape="circle"),
        RestaurantTable(restaurant_id=restaurant.id, section_id=bar_section.id, name="B2", capacity=1, pos_x=110, pos_y=50, shape="circle"),
        RestaurantTable(restaurant_id=restaurant.id, section_id=bar_section.id, name="B3", capacity=1, pos_x=170, pos_y=50, shape="circle"),
        RestaurantTable(restaurant_id=restaurant.id, section_id=bar_section.id, name="B4", capacity=1, pos_x=230, pos_y=50, shape="circle"),
    ]
    for t in tables:
        db.add(t)

    # Inventory: Supplier
    supplier = Supplier(
        restaurant_id=restaurant.id,
        name="Fresh Direct Wholesale",
        contact_name="Mike Johnson",
        email="orders@freshdirect.local",
        phone="(217) 555-0200",
        payment_terms="Net 30",
    )
    db.add(supplier)

    # Ingredient categories
    meat_cat = IngredientCategory(restaurant_id=restaurant.id, name="Proteins")
    produce_cat = IngredientCategory(restaurant_id=restaurant.id, name="Produce")
    dairy_cat = IngredientCategory(restaurant_id=restaurant.id, name="Dairy")
    dry_cat = IngredientCategory(restaurant_id=restaurant.id, name="Dry Goods")
    bev_cat = IngredientCategory(restaurant_id=restaurant.id, name="Beverages")
    db.add_all([meat_cat, produce_cat, dairy_cat, dry_cat, bev_cat])

    await db.flush()

    ingredients = [
        Ingredient(restaurant_id=restaurant.id, category_id=meat_cat.id, supplier_id=supplier.id, name="Ground Beef (80/20)", unit="lb", current_stock=40.0, par_level=10.0, reorder_qty=30.0, cost_per_unit=6.50),
        Ingredient(restaurant_id=restaurant.id, category_id=meat_cat.id, supplier_id=supplier.id, name="Salmon Fillet", unit="lb", current_stock=12.0, par_level=5.0, reorder_qty=15.0, cost_per_unit=12.00),
        Ingredient(restaurant_id=restaurant.id, category_id=meat_cat.id, supplier_id=supplier.id, name="Chicken Breast", unit="lb", current_stock=25.0, par_level=8.0, reorder_qty=20.0, cost_per_unit=4.50),
        Ingredient(restaurant_id=restaurant.id, category_id=meat_cat.id, supplier_id=supplier.id, name="Strip Steak", unit="lb", current_stock=18.0, par_level=6.0, reorder_qty=12.0, cost_per_unit=18.00),
        Ingredient(restaurant_id=restaurant.id, category_id=produce_cat.id, supplier_id=supplier.id, name="Romaine Lettuce", unit="each", current_stock=20.0, par_level=5.0, reorder_qty=20.0, cost_per_unit=1.20),
        Ingredient(restaurant_id=restaurant.id, category_id=produce_cat.id, supplier_id=supplier.id, name="Tomatoes", unit="lb", current_stock=15.0, par_level=5.0, reorder_qty=15.0, cost_per_unit=1.50),
        Ingredient(restaurant_id=restaurant.id, category_id=produce_cat.id, supplier_id=supplier.id, name="Avocado", unit="each", current_stock=24.0, par_level=8.0, reorder_qty=24.0, cost_per_unit=1.80),
        Ingredient(restaurant_id=restaurant.id, category_id=dairy_cat.id, supplier_id=supplier.id, name="Cheddar Cheese", unit="lb", current_stock=8.0, par_level=3.0, reorder_qty=10.0, cost_per_unit=5.00),
        Ingredient(restaurant_id=restaurant.id, category_id=dairy_cat.id, supplier_id=supplier.id, name="Mozzarella", unit="lb", current_stock=6.0, par_level=2.0, reorder_qty=8.0, cost_per_unit=5.50),
        Ingredient(restaurant_id=restaurant.id, category_id=dry_cat.id, supplier_id=supplier.id, name="Burger Buns", unit="each", current_stock=60.0, par_level=20.0, reorder_qty=48.0, cost_per_unit=0.40),
        Ingredient(restaurant_id=restaurant.id, category_id=dry_cat.id, supplier_id=supplier.id, name="Russet Potatoes (for fries)", unit="lb", current_stock=50.0, par_level=15.0, reorder_qty=40.0, cost_per_unit=0.60),
        Ingredient(restaurant_id=restaurant.id, category_id=bev_cat.id, supplier_id=supplier.id, name="Soda Syrup (Coke)", unit="l", current_stock=20.0, par_level=5.0, reorder_qty=20.0, cost_per_unit=2.00),
    ]
    for ing in ingredients:
        db.add(ing)

    # Loyalty program
    loyalty = LoyaltyProgram(
        restaurant_id=restaurant.id,
        name="Demo Kitchen Rewards",
        points_per_dollar=1.0,
        redemption_value=0.01,
        min_redemption_points=100,
    )
    db.add(loyalty)

    # Chart of accounts
    accounts = [
        Account(restaurant_id=restaurant.id, type="revenue", code="4001", name="Food Sales"),
        Account(restaurant_id=restaurant.id, type="revenue", code="4002", name="Beverage Sales"),
        Account(restaurant_id=restaurant.id, type="revenue", code="4003", name="Online Order Sales"),
        Account(restaurant_id=restaurant.id, type="expense", code="5001", name="Food Cost (COGS)"),
        Account(restaurant_id=restaurant.id, type="expense", code="5002", name="Beverage Cost (COGS)"),
        Account(restaurant_id=restaurant.id, type="expense", code="6001", name="Labor - Wages"),
        Account(restaurant_id=restaurant.id, type="expense", code="6002", name="Labor - Overtime"),
        Account(restaurant_id=restaurant.id, type="expense", code="7001", name="Rent"),
        Account(restaurant_id=restaurant.id, type="expense", code="7002", name="Utilities"),
        Account(restaurant_id=restaurant.id, type="expense", code="7003", name="Marketing"),
        Account(restaurant_id=restaurant.id, type="expense", code="7004", name="Supplies"),
        Account(restaurant_id=restaurant.id, type="asset", code="1001", name="Cash"),
        Account(restaurant_id=restaurant.id, type="asset", code="1002", name="Checking Account"),
    ]
    for acct in accounts:
        db.add(acct)

    await db.commit()
    print("✅ Seed complete!")
    print("   Owner: owner@demokitchen.com / demo1234")
    print("   Manager: manager@demokitchen.com / demo1234")
    print("   Cashier: cashier@demokitchen.com / demo1234")
    print("   Kitchen: kitchen@demokitchen.com / demo1234")


async def main() -> None:
    async with AsyncSessionLocal() as db:
        await seed(db)


if __name__ == "__main__":
    asyncio.run(main())
