"""Inventory background tasks."""
import asyncio
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.inventory.deduct_for_order")
def deduct_for_order(order_id: str):
    """Deduct ingredients used by an order from inventory stock."""
    async def _run():
        from app.database import AsyncSessionLocal
        from app.models.order import Order, OrderItem
        from app.models.menu import MenuItemIngredient
        from app.models.inventory import Ingredient, InventoryTransaction
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            order_result = await db.execute(select(Order).where(Order.id == order_id))
            order = order_result.scalar_one_or_none()
            if not order:
                return

            items_result = await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))
            items = items_result.scalars().all()

            for item in items:
                recipes_result = await db.execute(
                    select(MenuItemIngredient).where(MenuItemIngredient.menu_item_id == item.menu_item_id)
                )
                recipes = recipes_result.scalars().all()

                for recipe in recipes:
                    qty_used = recipe.quantity * item.quantity
                    ing_result = await db.execute(select(Ingredient).where(Ingredient.id == recipe.ingredient_id))
                    ing = ing_result.scalar_one_or_none()
                    if ing:
                        ing.current_stock = max(0, ing.current_stock - qty_used)
                        txn = InventoryTransaction(
                            restaurant_id=order.restaurant_id,
                            ingredient_id=ing.id,
                            type="usage",
                            quantity=-qty_used,
                            reference_id=order_id,
                            reason="Order fulfillment",
                            cost=qty_used * ing.cost_per_unit,
                        )
                        db.add(txn)

            await db.commit()

    asyncio.run(_run())


@celery_app.task(name="app.tasks.inventory.check_low_stock_all_restaurants")
def check_low_stock_all_restaurants():
    """Check all restaurants for low stock and fire WS alerts."""
    async def _run():
        from app.database import AsyncSessionLocal
        from app.models.restaurant import Restaurant
        from app.models.inventory import Ingredient
        from app.websocket.manager import ws_manager
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            restaurants = (await db.execute(select(Restaurant).where(Restaurant.is_active == True))).scalars().all()
            for restaurant in restaurants:
                ings = (await db.execute(select(Ingredient).where(Ingredient.restaurant_id == restaurant.id, Ingredient.is_active == True))).scalars().all()
                for ing in ings:
                    if ing.is_low_stock:
                        await ws_manager.broadcast_to_restaurant(restaurant.id, {
                            "event": "inventory.low_stock",
                            "data": {"ingredient_id": ing.id, "name": ing.name, "current": ing.current_stock, "par": ing.par_level, "unit": ing.unit},
                        })

    asyncio.run(_run())
