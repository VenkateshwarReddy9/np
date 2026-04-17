"""
Online ordering router — public-facing endpoints (no auth required for customers).
Delivery platform webhook stubs (DoorDash, UberEats, Grubhub).
"""
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.models.restaurant import Restaurant
from app.models.menu import MenuCategory, MenuItem
from app.models.order import Order, OrderItem, OrderItemModifier
from app.models.menu import ModifierOption
from app.websocket.manager import ws_manager

router = APIRouter(tags=["online-ordering"])


class OnlineOrderItemCreate(BaseModel):
    menu_item_id: str
    quantity: int = 1
    special_instructions: Optional[str] = None
    modifier_option_ids: list[str] = []


class OnlineOrderCreate(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    order_type: str = "online"  # online|delivery|takeout
    delivery_address: Optional[str] = None
    items: list[OnlineOrderItemCreate]
    notes: Optional[str] = None


@router.get("/online/menu/{slug}")
async def online_menu(slug: str):
    """Public menu for customer-facing ordering portal — no auth."""
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Restaurant).where(Restaurant.slug == slug, Restaurant.is_active == True))
        restaurant = result.scalar_one_or_none()
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        cats = await db.execute(
            select(MenuCategory).where(MenuCategory.restaurant_id == restaurant.id, MenuCategory.is_active == True)
            .order_by(MenuCategory.display_order)
        )
        categories = cats.scalars().all()

        items = await db.execute(
            select(MenuItem).where(MenuItem.restaurant_id == restaurant.id, MenuItem.is_available == True)
            .order_by(MenuItem.display_order)
        )
        all_items = items.scalars().all()
        items_by_cat = {}
        for i in all_items:
            items_by_cat.setdefault(i.category_id or "other", []).append({
                "id": i.id,
                "name": i.name,
                "description": i.description,
                "price": i.base_price,
                "calories": i.calories,
                "image_url": i.image_url,
                "prep_time_min": i.prep_time_min,
            })

        return {
            "restaurant": {
                "id": restaurant.id,
                "name": restaurant.name,
                "slug": restaurant.slug,
                "logo_url": restaurant.logo_url,
                "phone": restaurant.phone,
                "address": restaurant.address,
                "currency": restaurant.currency,
                "tax_rate": restaurant.tax_rate,
            },
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


@router.post("/online/orders/{slug}", status_code=201)
async def place_online_order(slug: str, body: OnlineOrderCreate):
    """Customer places an order — no auth required."""
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Restaurant).where(Restaurant.slug == slug, Restaurant.is_active == True))
        restaurant = result.scalar_one_or_none()
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        subtotal = 0.0
        item_records = []

        for item_data in body.items:
            mi_result = await db.execute(select(MenuItem).where(MenuItem.id == item_data.menu_item_id, MenuItem.restaurant_id == restaurant.id, MenuItem.is_available == True))
            mi = mi_result.scalar_one_or_none()
            if not mi:
                raise HTTPException(status_code=400, detail=f"Item {item_data.menu_item_id} unavailable")

            modifier_total = 0.0
            mod_records = []
            for opt_id in item_data.modifier_option_ids:
                opt_result = await db.execute(select(ModifierOption).where(ModifierOption.id == opt_id))
                opt = opt_result.scalar_one_or_none()
                if opt:
                    modifier_total += opt.price_adjustment
                    mod_records.append(OrderItemModifier(modifier_option_id=opt.id, name=opt.name, price_at_time=opt.price_adjustment))

            line_total = (mi.base_price + modifier_total) * item_data.quantity
            subtotal += line_total

            oi = OrderItem(
                menu_item_id=mi.id,
                quantity=item_data.quantity,
                unit_price=mi.base_price,
                modifier_total=modifier_total,
                line_total=line_total,
                special_instructions=item_data.special_instructions,
                kds_station=mi.station,
            )
            oi.modifiers = mod_records
            item_records.append(oi)

        tax = round(subtotal * (restaurant.tax_rate / 100), 2)
        total = round(subtotal + tax, 2)

        import random
        order = Order(
            restaurant_id=restaurant.id,
            order_number=f"#O{random.randint(1000, 9999)}",
            order_type=body.order_type,
            source="online",
            customer_name=body.customer_name,
            customer_phone=body.customer_phone,
            delivery_address=body.delivery_address,
            notes=body.notes,
            subtotal=round(subtotal, 2),
            tax_amount=tax,
            total=total,
            status="pending",
        )
        order.items = item_records
        db.add(order)
        await db.commit()
        await db.refresh(order)

        await ws_manager.broadcast_to_restaurant(restaurant.id, {
            "event": "order.created",
            "data": {"order_id": order.id, "order_number": order.order_number, "source": "online", "total": total},
        })

        return {"order_id": order.id, "order_number": order.order_number, "total": total, "status": "pending"}


@router.get("/online/orders/{order_id}/status")
async def order_status(order_id: str):
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return {"order_id": order.id, "status": order.status, "order_number": order.order_number}


# ─── Delivery Platform Webhooks (stubs) ──────────────────────────────────────

@router.post("/integrations/doordash", include_in_schema=False)
async def doordash_webhook(request: Request):
    """Normalize DoorDash order payload and create internal order."""
    payload = await request.json()
    # DoorDash webhook normalization would go here
    return {"received": True}


@router.post("/integrations/ubereats", include_in_schema=False)
async def ubereats_webhook(request: Request):
    payload = await request.json()
    return {"received": True}


@router.post("/integrations/grubhub", include_in_schema=False)
async def grubhub_webhook(request: Request):
    payload = await request.json()
    return {"received": True}


@router.get("/settings/restaurant")
async def get_restaurant_settings():
    from app.dependencies import CurrentRestaurant, DB
    # This endpoint is wired in main.py with auth; here for completeness
    pass


@router.get("/settings/restaurant/{restaurant_id}")
async def get_restaurant_public(restaurant_id: str):
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
        r = result.scalar_one_or_none()
        if not r:
            raise HTTPException(status_code=404)
        return {"name": r.name, "slug": r.slug, "timezone": r.timezone, "currency": r.currency, "tax_rate": r.tax_rate}
