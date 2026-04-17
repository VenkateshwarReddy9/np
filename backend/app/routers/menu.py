from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File
from sqlalchemy import select, update
from pydantic import BaseModel
from app.dependencies import CurrentUser, CurrentRestaurant, DB, require_manager
from app.models.menu import MenuCategory, MenuItem, ModifierGroup, ModifierOption, Allergen

router = APIRouter(prefix="/menu", tags=["menu"])


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    display_order: int = 0
    is_active: bool = True
    available_start: Optional[str] = None
    available_end: Optional[str] = None


class CategoryUpdate(CategoryCreate):
    pass


class ModifierOptionCreate(BaseModel):
    name: str
    price_adjustment: float = 0.0
    cost_adjustment: float = 0.0
    is_default: bool = False
    is_available: bool = True
    display_order: int = 0


class ModifierGroupCreate(BaseModel):
    name: str
    is_required: bool = False
    min_selections: int = 0
    max_selections: int = 1
    display_order: int = 0
    options: List[ModifierOptionCreate] = []


class MenuItemCreate(BaseModel):
    category_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    base_price: float
    cost_price: float = 0.0
    calories: Optional[int] = None
    prep_time_min: int = 10
    is_available: bool = True
    is_featured: bool = False
    display_order: int = 0
    station: Optional[str] = None
    notes: Optional[str] = None
    modifier_group_ids: List[str] = []
    allergen_ids: List[str] = []


class MenuItemUpdate(MenuItemCreate):
    pass


# ─── Categories ─────────────────────────────────────────────────────────────

@router.get("/categories")
async def list_categories(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(
        select(MenuCategory)
        .where(MenuCategory.restaurant_id == restaurant.id)
        .order_by(MenuCategory.display_order)
    )
    return result.scalars().all()


@router.post("/categories", status_code=201)
async def create_category(body: CategoryCreate, restaurant: CurrentRestaurant, db: DB):
    cat = MenuCategory(restaurant_id=restaurant.id, **body.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.put("/categories/{category_id}")
async def update_category(category_id: str, body: CategoryUpdate, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(MenuCategory).where(MenuCategory.id == category_id, MenuCategory.restaurant_id == restaurant.id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(cat, k, v)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(category_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(MenuCategory).where(MenuCategory.id == category_id, MenuCategory.restaurant_id == restaurant.id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(cat)
    await db.commit()


# ─── Menu Items ──────────────────────────────────────────────────────────────

@router.get("/items")
async def list_items(
    restaurant: CurrentRestaurant,
    db: DB,
    category_id: Optional[str] = None,
    available_only: bool = False,
):
    query = select(MenuItem).where(MenuItem.restaurant_id == restaurant.id)
    if category_id:
        query = query.where(MenuItem.category_id == category_id)
    if available_only:
        query = query.where(MenuItem.is_available == True)
    query = query.order_by(MenuItem.display_order)
    result = await db.execute(query)
    items = result.scalars().all()
    return [
        {
            "id": i.id,
            "name": i.name,
            "description": i.description,
            "category_id": i.category_id,
            "base_price": i.base_price,
            "cost_price": i.cost_price,
            "profit_margin": i.profit_margin,
            "calories": i.calories,
            "prep_time_min": i.prep_time_min,
            "is_available": i.is_available,
            "is_featured": i.is_featured,
            "image_url": i.image_url,
            "display_order": i.display_order,
            "station": i.station,
            "notes": i.notes,
        }
        for i in items
    ]


@router.get("/items/{item_id}")
async def get_item(item_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id, MenuItem.restaurant_id == restaurant.id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.post("/items", status_code=201)
async def create_item(body: MenuItemCreate, restaurant: CurrentRestaurant, db: DB):
    item_data = body.model_dump(exclude={"modifier_group_ids", "allergen_ids"})
    item = MenuItem(restaurant_id=restaurant.id, **item_data)

    if body.modifier_group_ids:
        result = await db.execute(select(ModifierGroup).where(ModifierGroup.id.in_(body.modifier_group_ids)))
        item.modifier_groups = result.scalars().all()

    if body.allergen_ids:
        result = await db.execute(select(Allergen).where(Allergen.id.in_(body.allergen_ids)))
        item.allergens = result.scalars().all()

    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"id": item.id, "name": item.name, "profit_margin": item.profit_margin}


@router.put("/items/{item_id}")
async def update_item(item_id: str, body: MenuItemUpdate, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id, MenuItem.restaurant_id == restaurant.id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item_data = body.model_dump(exclude={"modifier_group_ids", "allergen_ids"}, exclude_none=True)
    for k, v in item_data.items():
        setattr(item, k, v)

    if body.modifier_group_ids is not None:
        result2 = await db.execute(select(ModifierGroup).where(ModifierGroup.id.in_(body.modifier_group_ids)))
        item.modifier_groups = result2.scalars().all()

    if body.allergen_ids is not None:
        result3 = await db.execute(select(Allergen).where(Allergen.id.in_(body.allergen_ids)))
        item.allergens = result3.scalars().all()

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(item_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id, MenuItem.restaurant_id == restaurant.id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.delete(item)
    await db.commit()


@router.patch("/items/{item_id}/toggle")
async def toggle_availability(item_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id, MenuItem.restaurant_id == restaurant.id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_available = not item.is_available
    await db.commit()
    return {"id": item.id, "is_available": item.is_available}


# ─── Modifier Groups ─────────────────────────────────────────────────────────

@router.get("/modifier-groups")
async def list_modifier_groups(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(
        select(ModifierGroup).where(ModifierGroup.restaurant_id == restaurant.id)
    )
    return result.scalars().all()


@router.post("/modifier-groups", status_code=201)
async def create_modifier_group(body: ModifierGroupCreate, restaurant: CurrentRestaurant, db: DB):
    group = ModifierGroup(
        restaurant_id=restaurant.id,
        name=body.name,
        is_required=body.is_required,
        min_selections=body.min_selections,
        max_selections=body.max_selections,
        display_order=body.display_order,
    )
    db.add(group)
    await db.flush()

    for opt_data in body.options:
        opt = ModifierOption(modifier_group_id=group.id, **opt_data.model_dump())
        db.add(opt)

    await db.commit()
    await db.refresh(group)
    return group


@router.put("/modifier-groups/{group_id}")
async def update_modifier_group(group_id: str, body: ModifierGroupCreate, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(ModifierGroup).where(ModifierGroup.id == group_id, ModifierGroup.restaurant_id == restaurant.id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Modifier group not found")
    group.name = body.name
    group.is_required = body.is_required
    group.min_selections = body.min_selections
    group.max_selections = body.max_selections
    await db.commit()
    return group


@router.delete("/modifier-groups/{group_id}", status_code=204)
async def delete_modifier_group(group_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(ModifierGroup).where(ModifierGroup.id == group_id, ModifierGroup.restaurant_id == restaurant.id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(group)
    await db.commit()


# ─── Allergens ───────────────────────────────────────────────────────────────

@router.get("/allergens")
async def list_allergens(db: DB):
    result = await db.execute(select(Allergen).order_by(Allergen.name))
    return result.scalars().all()


# ─── Public QR Menu ──────────────────────────────────────────────────────────

@router.get("/public/{slug}", include_in_schema=False)
async def public_menu(slug: str, db: DB):
    """No auth required — used by QR code menus."""
    from app.models.restaurant import Restaurant
    result = await db.execute(select(Restaurant).where(Restaurant.slug == slug, Restaurant.is_active == True))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    cats_result = await db.execute(
        select(MenuCategory)
        .where(MenuCategory.restaurant_id == restaurant.id, MenuCategory.is_active == True)
        .order_by(MenuCategory.display_order)
    )
    categories = cats_result.scalars().all()

    items_result = await db.execute(
        select(MenuItem)
        .where(MenuItem.restaurant_id == restaurant.id, MenuItem.is_available == True)
        .order_by(MenuItem.display_order)
    )
    items = items_result.scalars().all()

    items_by_cat = {}
    for item in items:
        cat_id = item.category_id or "uncategorized"
        items_by_cat.setdefault(cat_id, []).append({
            "id": item.id,
            "name": item.name,
            "description": item.description,
            "price": item.base_price,
            "calories": item.calories,
            "image_url": item.image_url,
        })

    return {
        "restaurant": {"name": restaurant.name, "logo_url": restaurant.logo_url},
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "items": items_by_cat.get(c.id, []),
            }
            for c in categories
        ],
    }
