import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, func
from pydantic import BaseModel
from app.dependencies import CurrentUser, CurrentRestaurant, DB
from app.models.order import Order, OrderItem, OrderItemModifier, Payment
from app.models.menu import MenuItem, ModifierOption
from app.models.table import RestaurantTable
from app.websocket.manager import ws_manager

router = APIRouter(prefix="/orders", tags=["orders"])


class OrderItemModifierCreate(BaseModel):
    modifier_option_id: str


class OrderItemCreate(BaseModel):
    menu_item_id: str
    quantity: int = 1
    special_instructions: Optional[str] = None
    modifiers: List[OrderItemModifierCreate] = []


class OrderCreate(BaseModel):
    table_id: Optional[str] = None
    customer_id: Optional[str] = None
    order_type: str = "dine_in"
    notes: Optional[str] = None
    items: List[OrderItemCreate] = []
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None


class PaymentCreate(BaseModel):
    method: str  # cash|card|contactless|gift_card
    amount: float
    tip_amount: float = 0.0
    change_given: float = 0.0
    transaction_ref: Optional[str] = None


class OfflineOrderSync(BaseModel):
    orders: List[dict]


def _order_number(restaurant_id: str) -> str:
    import random
    return f"#{random.randint(1000, 9999)}"


async def _build_order_dict(order: Order) -> dict:
    return {
        "id": order.id,
        "order_number": order.order_number,
        "order_type": order.order_type,
        "status": order.status,
        "table_id": order.table_id,
        "customer_id": order.customer_id,
        "subtotal": order.subtotal,
        "tax_amount": order.tax_amount,
        "tip_amount": order.tip_amount,
        "discount_amount": order.discount_amount,
        "total": order.total,
        "notes": order.notes,
        "created_at": order.created_at.isoformat(),
        "items": [
            {
                "id": i.id,
                "menu_item_id": i.menu_item_id,
                "quantity": i.quantity,
                "unit_price": i.unit_price,
                "line_total": i.line_total,
                "status": i.status,
                "special_instructions": i.special_instructions,
                "modifiers": [{"name": m.name, "price": m.price_at_time} for m in i.modifiers],
            }
            for i in order.items
        ],
    }


@router.get("")
async def list_orders(
    restaurant: CurrentRestaurant,
    db: DB,
    status: Optional[str] = None,
    order_type: Optional[str] = None,
    table_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    query = select(Order).where(Order.restaurant_id == restaurant.id)
    if status:
        query = query.where(Order.status == status)
    if order_type:
        query = query.where(Order.order_type == order_type)
    if table_id:
        query = query.where(Order.table_id == table_id)
    query = query.order_by(Order.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", status_code=201)
async def create_order(body: OrderCreate, current_user: CurrentUser, restaurant: CurrentRestaurant, db: DB):
    # Resolve menu items and build totals
    subtotal = 0.0
    item_records = []

    for item_data in body.items:
        mi_result = await db.execute(select(MenuItem).where(MenuItem.id == item_data.menu_item_id))
        menu_item = mi_result.scalar_one_or_none()
        if not menu_item:
            raise HTTPException(status_code=404, detail=f"Menu item {item_data.menu_item_id} not found")

        modifier_total = 0.0
        modifier_records = []
        for mod in item_data.modifiers:
            opt_result = await db.execute(select(ModifierOption).where(ModifierOption.id == mod.modifier_option_id))
            opt = opt_result.scalar_one_or_none()
            if opt:
                modifier_total += opt.price_adjustment
                modifier_records.append(OrderItemModifier(
                    modifier_option_id=opt.id,
                    name=opt.name,
                    price_at_time=opt.price_adjustment,
                ))

        line_total = (menu_item.base_price + modifier_total) * item_data.quantity
        subtotal += line_total

        oi = OrderItem(
            menu_item_id=menu_item.id,
            quantity=item_data.quantity,
            unit_price=menu_item.base_price,
            modifier_total=modifier_total,
            line_total=line_total,
            special_instructions=item_data.special_instructions,
            kds_station=menu_item.station,
        )
        oi.modifiers = modifier_records
        item_records.append(oi)

    tax_amount = round(subtotal * (restaurant.tax_rate / 100), 2)
    total = round(subtotal + tax_amount, 2)

    order = Order(
        restaurant_id=restaurant.id,
        table_id=body.table_id,
        customer_id=body.customer_id,
        created_by=current_user.id,
        order_number=_order_number(restaurant.id),
        order_type=body.order_type,
        notes=body.notes,
        customer_name=body.customer_name,
        customer_phone=body.customer_phone,
        subtotal=round(subtotal, 2),
        tax_amount=tax_amount,
        total=total,
        status="pending",
    )
    order.items = item_records
    db.add(order)

    # Mark table occupied
    if body.table_id:
        tbl_result = await db.execute(select(RestaurantTable).where(RestaurantTable.id == body.table_id))
        tbl = tbl_result.scalar_one_or_none()
        if tbl:
            tbl.status = "occupied"

    await db.commit()
    await db.refresh(order)

    order_dict = await _build_order_dict(order)

    # Broadcast to KDS and POS
    await ws_manager.broadcast_to_restaurant(restaurant.id, {
        "event": "order.created",
        "data": order_dict,
    })

    return order_dict


@router.get("/{order_id}")
async def get_order(order_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Order).where(Order.id == order_id, Order.restaurant_id == restaurant.id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return await _build_order_dict(order)


@router.patch("/{order_id}/status")
async def update_order_status(order_id: str, status: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Order).where(Order.id == order_id, Order.restaurant_id == restaurant.id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = status
    if status == "completed":
        order.completed_at = datetime.now(timezone.utc)
        if order.table_id:
            tbl_result = await db.execute(select(RestaurantTable).where(RestaurantTable.id == order.table_id))
            tbl = tbl_result.scalar_one_or_none()
            if tbl:
                tbl.status = "available"

    await db.commit()
    await ws_manager.broadcast_to_restaurant(restaurant.id, {
        "event": "order.status",
        "data": {"order_id": order_id, "status": status},
    })
    return {"id": order_id, "status": status}


@router.post("/{order_id}/payments", status_code=201)
async def add_payment(order_id: str, body: PaymentCreate, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Order).where(Order.id == order_id, Order.restaurant_id == restaurant.id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payment = Payment(
        order_id=order_id,
        method=body.method,
        amount=body.amount,
        tip_amount=body.tip_amount,
        change_given=body.change_given,
        transaction_ref=body.transaction_ref,
        status="completed",
        processed_at=datetime.now(timezone.utc),
    )
    db.add(payment)

    order.tip_amount += body.tip_amount
    order.total += body.tip_amount
    order.status = "completed"
    order.completed_at = datetime.now(timezone.utc)

    if order.table_id:
        tbl_result = await db.execute(select(RestaurantTable).where(RestaurantTable.id == order.table_id))
        tbl = tbl_result.scalar_one_or_none()
        if tbl:
            tbl.status = "available"

    await db.commit()

    # Trigger inventory deduction via Celery
    from app.tasks.celery_app import celery_app
    celery_app.send_task("app.tasks.inventory.deduct_for_order", args=[order_id])

    # Trigger loyalty points
    if order.customer_id:
        celery_app.send_task("app.tasks.notifications.award_loyalty_points", args=[order.customer_id, order.total])

    await ws_manager.broadcast_to_restaurant(restaurant.id, {
        "event": "order.completed",
        "data": {"order_id": order_id, "total": order.total},
    })

    return {"payment_id": payment.id, "status": "completed"}


@router.post("/{order_id}/cancel")
async def cancel_order(order_id: str, reason: Optional[str] = None, restaurant: CurrentRestaurant = None, db: DB = None):
    result = await db.execute(select(Order).where(Order.id == order_id, Order.restaurant_id == restaurant.id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = "cancelled"
    if order.table_id:
        tbl_result = await db.execute(select(RestaurantTable).where(RestaurantTable.id == order.table_id))
        tbl = tbl_result.scalar_one_or_none()
        if tbl:
            tbl.status = "available"
    await db.commit()
    return {"id": order_id, "status": "cancelled"}


@router.post("/sync")
async def sync_offline_orders(body: OfflineOrderSync, current_user: CurrentUser, restaurant: CurrentRestaurant, db: DB):
    """Bulk sync orders created while offline."""
    results = []
    for raw_order in body.orders:
        try:
            # Minimal sync: just record the order with its items
            order = Order(
                restaurant_id=restaurant.id,
                created_by=current_user.id,
                order_number=raw_order.get("order_number", _order_number(restaurant.id)),
                order_type=raw_order.get("order_type", "dine_in"),
                subtotal=raw_order.get("subtotal", 0.0),
                tax_amount=raw_order.get("tax_amount", 0.0),
                total=raw_order.get("total", 0.0),
                status="completed",
                source=raw_order.get("source", "pos"),
                notes="[OFFLINE SYNC] " + (raw_order.get("notes") or ""),
            )
            db.add(order)
            await db.flush()
            results.append({"offline_id": raw_order.get("id"), "server_id": order.id, "status": "synced"})
        except Exception as e:
            results.append({"offline_id": raw_order.get("id"), "status": "failed", "error": str(e)})

    await db.commit()
    return {"synced": len([r for r in results if r["status"] == "synced"]), "results": results}
