import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from pydantic import BaseModel
from app.dependencies import CurrentRestaurant, CurrentUser, DB
from app.models.inventory import (
    Ingredient, IngredientCategory, Supplier,
    PurchaseOrder, PurchaseOrderItem, InventoryTransaction, WasteLog,
)
from app.websocket.manager import ws_manager

router = APIRouter(prefix="/inventory", tags=["inventory"])


class IngredientCreate(BaseModel):
    category_id: Optional[str] = None
    supplier_id: Optional[str] = None
    name: str
    unit: str = "each"
    current_stock: float = 0.0
    par_level: float = 0.0
    reorder_qty: float = 0.0
    cost_per_unit: float = 0.0
    barcode: Optional[str] = None
    location: Optional[str] = None


class StockAdjustment(BaseModel):
    quantity: float  # positive = add, negative = subtract
    reason: str
    type: str = "adjustment"


class WasteLogCreate(BaseModel):
    ingredient_id: str
    quantity: float
    unit: str
    reason: str  # spoilage|overproduction|drop|trimming|other
    notes: Optional[str] = None


class SupplierCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None


class POItemCreate(BaseModel):
    ingredient_id: str
    quantity_ordered: float
    unit_price: float
    notes: Optional[str] = None


class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    notes: Optional[str] = None
    expected_at: Optional[datetime] = None
    items: list[POItemCreate] = []


class POReceive(BaseModel):
    items: list[dict]  # [{id, quantity_received}]


# ─── Ingredient Categories ────────────────────────────────────────────────────

@router.get("/categories")
async def list_categories(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(IngredientCategory).where(IngredientCategory.restaurant_id == restaurant.id))
    return result.scalars().all()


@router.post("/categories", status_code=201)
async def create_category(name: str, restaurant: CurrentRestaurant, db: DB):
    cat = IngredientCategory(restaurant_id=restaurant.id, name=name)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


# ─── Ingredients ─────────────────────────────────────────────────────────────

@router.get("/ingredients")
async def list_ingredients(restaurant: CurrentRestaurant, db: DB, low_stock_only: bool = False):
    query = select(Ingredient).where(Ingredient.restaurant_id == restaurant.id, Ingredient.is_active == True)
    result = await db.execute(query)
    ingredients = result.scalars().all()
    if low_stock_only:
        ingredients = [i for i in ingredients if i.is_low_stock]
    return [
        {
            "id": i.id,
            "name": i.name,
            "unit": i.unit,
            "current_stock": i.current_stock,
            "par_level": i.par_level,
            "reorder_qty": i.reorder_qty,
            "cost_per_unit": i.cost_per_unit,
            "is_low_stock": i.is_low_stock,
            "category_id": i.category_id,
            "supplier_id": i.supplier_id,
            "barcode": i.barcode,
            "location": i.location,
        }
        for i in ingredients
    ]


@router.post("/ingredients", status_code=201)
async def create_ingredient(body: IngredientCreate, restaurant: CurrentRestaurant, db: DB):
    ingredient = Ingredient(restaurant_id=restaurant.id, **body.model_dump())
    db.add(ingredient)
    await db.commit()
    await db.refresh(ingredient)
    return ingredient


@router.put("/ingredients/{ingredient_id}")
async def update_ingredient(ingredient_id: str, body: IngredientCreate, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Ingredient).where(Ingredient.id == ingredient_id, Ingredient.restaurant_id == restaurant.id))
    ing = result.scalar_one_or_none()
    if not ing:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(ing, k, v)
    await db.commit()
    return ing


@router.post("/ingredients/{ingredient_id}/adjust")
async def adjust_stock(ingredient_id: str, body: StockAdjustment, current_user: CurrentUser, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Ingredient).where(Ingredient.id == ingredient_id, Ingredient.restaurant_id == restaurant.id))
    ing = result.scalar_one_or_none()
    if not ing:
        raise HTTPException(status_code=404, detail="Not found")

    ing.current_stock += body.quantity
    txn = InventoryTransaction(
        restaurant_id=restaurant.id,
        ingredient_id=ingredient_id,
        type=body.type,
        quantity=body.quantity,
        reason=body.reason,
        created_by=current_user.id,
        cost=abs(body.quantity) * ing.cost_per_unit,
    )
    db.add(txn)
    await db.commit()

    if ing.is_low_stock:
        await ws_manager.broadcast_to_restaurant(restaurant.id, {
            "event": "inventory.low_stock",
            "data": {"ingredient_id": ing.id, "name": ing.name, "current": ing.current_stock, "par": ing.par_level},
        })

    return {"ingredient_id": ingredient_id, "new_stock": ing.current_stock}


@router.get("/low-stock-alerts")
async def low_stock_alerts(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Ingredient).where(Ingredient.restaurant_id == restaurant.id, Ingredient.is_active == True))
    ingredients = result.scalars().all()
    return [
        {"id": i.id, "name": i.name, "current_stock": i.current_stock, "par_level": i.par_level, "unit": i.unit}
        for i in ingredients if i.is_low_stock
    ]


@router.get("/transactions")
async def list_transactions(restaurant: CurrentRestaurant, db: DB, ingredient_id: Optional[str] = None, limit: int = 100):
    query = select(InventoryTransaction).where(InventoryTransaction.restaurant_id == restaurant.id)
    if ingredient_id:
        query = query.where(InventoryTransaction.ingredient_id == ingredient_id)
    query = query.order_by(InventoryTransaction.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# ─── Waste Logs ───────────────────────────────────────────────────────────────

@router.get("/waste-logs")
async def list_waste_logs(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(
        select(WasteLog).where(WasteLog.restaurant_id == restaurant.id).order_by(WasteLog.logged_at.desc())
    )
    return result.scalars().all()


@router.post("/waste-logs", status_code=201)
async def log_waste(body: WasteLogCreate, current_user: CurrentUser, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Ingredient).where(Ingredient.id == body.ingredient_id, Ingredient.restaurant_id == restaurant.id))
    ing = result.scalar_one_or_none()
    if not ing:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    estimated_cost = abs(body.quantity) * ing.cost_per_unit
    waste = WasteLog(
        restaurant_id=restaurant.id,
        ingredient_id=body.ingredient_id,
        quantity=body.quantity,
        unit=body.unit,
        reason=body.reason,
        estimated_cost=estimated_cost,
        notes=body.notes,
        logged_by=current_user.id,
    )
    db.add(waste)
    ing.current_stock = max(0, ing.current_stock - body.quantity)

    txn = InventoryTransaction(
        restaurant_id=restaurant.id,
        ingredient_id=body.ingredient_id,
        type="waste",
        quantity=-body.quantity,
        reason=body.reason,
        created_by=current_user.id,
        cost=estimated_cost,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(waste)
    return waste


# ─── Suppliers ───────────────────────────────────────────────────────────────

@router.get("/suppliers")
async def list_suppliers(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Supplier).where(Supplier.restaurant_id == restaurant.id, Supplier.is_active == True))
    return result.scalars().all()


@router.post("/suppliers", status_code=201)
async def create_supplier(body: SupplierCreate, restaurant: CurrentRestaurant, db: DB):
    supplier = Supplier(restaurant_id=restaurant.id, **body.model_dump())
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, body: SupplierCreate, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id, Supplier.restaurant_id == restaurant.id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(supplier, k, v)
    await db.commit()
    return supplier


# ─── Purchase Orders ──────────────────────────────────────────────────────────

@router.get("/purchase-orders")
async def list_purchase_orders(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.restaurant_id == restaurant.id).order_by(PurchaseOrder.created_at.desc())
    )
    return result.scalars().all()


@router.post("/purchase-orders", status_code=201)
async def create_purchase_order(body: PurchaseOrderCreate, current_user: CurrentUser, restaurant: CurrentRestaurant, db: DB):
    import random
    po_number = f"PO-{random.randint(10000, 99999)}"
    subtotal = sum(i.quantity_ordered * i.unit_price for i in body.items)

    po = PurchaseOrder(
        restaurant_id=restaurant.id,
        supplier_id=body.supplier_id,
        po_number=po_number,
        notes=body.notes,
        expected_at=body.expected_at,
        subtotal=subtotal,
        total=subtotal,
        created_by=current_user.id,
        status="draft",
    )
    db.add(po)
    await db.flush()

    for item_data in body.items:
        poi = PurchaseOrderItem(
            purchase_order_id=po.id,
            **item_data.model_dump(),
        )
        db.add(poi)

    await db.commit()
    await db.refresh(po)
    return po


@router.post("/purchase-orders/{po_id}/receive")
async def receive_purchase_order(po_id: str, body: POReceive, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id, PurchaseOrder.restaurant_id == restaurant.id))
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    for item_update in body.items:
        poi_result = await db.execute(select(PurchaseOrderItem).where(PurchaseOrderItem.id == item_update["id"]))
        poi = poi_result.scalar_one_or_none()
        if poi:
            received = item_update.get("quantity_received", poi.quantity_ordered)
            poi.quantity_received = received

            ing_result = await db.execute(select(Ingredient).where(Ingredient.id == poi.ingredient_id))
            ing = ing_result.scalar_one_or_none()
            if ing:
                ing.current_stock += received
                txn = InventoryTransaction(
                    restaurant_id=restaurant.id,
                    ingredient_id=ing.id,
                    type="purchase",
                    quantity=received,
                    cost=received * poi.unit_price,
                    reference_id=po_id,
                )
                db.add(txn)

    po.status = "received"
    po.received_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "received", "po_id": po_id}
