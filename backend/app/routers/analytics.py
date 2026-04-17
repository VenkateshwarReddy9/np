from datetime import datetime, date, timedelta, timezone
from typing import Optional
from fastapi import APIRouter
from sqlalchemy import select, func, and_
from app.dependencies import CurrentRestaurant, DB
from app.models.order import Order, OrderItem, Payment
from app.models.staff import TimeEntry, Employee
from app.models.inventory import WasteLog, Ingredient

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _date_range(period: str):
    now = datetime.now(timezone.utc)
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "week":
        start = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "month":
        start = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "year":
        start = (now - timedelta(days=365)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    else:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    return start, end


@router.get("/dashboard")
async def dashboard_kpis(restaurant: CurrentRestaurant, db: DB, period: str = "today"):
    start, end = _date_range(period)

    # Revenue
    revenue_result = await db.execute(
        select(func.sum(Order.total)).where(
            Order.restaurant_id == restaurant.id,
            Order.status == "completed",
            Order.created_at.between(start, end),
        )
    )
    revenue = revenue_result.scalar() or 0.0

    # Orders count
    orders_result = await db.execute(
        select(func.count(Order.id)).where(
            Order.restaurant_id == restaurant.id,
            Order.status == "completed",
            Order.created_at.between(start, end),
        )
    )
    order_count = orders_result.scalar() or 0

    avg_ticket = revenue / order_count if order_count > 0 else 0.0

    # Total covers (party sizes)
    covers_result = await db.execute(
        select(func.sum(func.coalesce(Order.notes, "0"))).where(
            Order.restaurant_id == restaurant.id,
            Order.status == "completed",
            Order.created_at.between(start, end),
        )
    )

    # Labor cost
    labor_result = await db.execute(
        select(func.sum(TimeEntry.total_hours)).where(
            TimeEntry.restaurant_id == restaurant.id,
            TimeEntry.clock_in.between(start, end),
        )
    )
    total_hours = labor_result.scalar() or 0.0

    # Waste cost
    waste_result = await db.execute(
        select(func.sum(WasteLog.estimated_cost)).where(
            WasteLog.restaurant_id == restaurant.id,
            WasteLog.logged_at.between(start, end),
        )
    )
    waste_cost = waste_result.scalar() or 0.0

    # Order type breakdown
    type_result = await db.execute(
        select(Order.order_type, func.count(Order.id), func.sum(Order.total)).where(
            Order.restaurant_id == restaurant.id,
            Order.status == "completed",
            Order.created_at.between(start, end),
        ).group_by(Order.order_type)
    )
    order_types = [{"type": row[0], "count": row[1], "revenue": row[2] or 0} for row in type_result]

    return {
        "period": period,
        "revenue": round(revenue, 2),
        "order_count": order_count,
        "avg_ticket": round(avg_ticket, 2),
        "total_labor_hours": round(total_hours, 2),
        "waste_cost": round(waste_cost, 2),
        "order_types": order_types,
    }


@router.get("/sales")
async def sales_report(
    restaurant: CurrentRestaurant,
    db: DB,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    group_by: str = "day",
):
    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).date()
    if not end_date:
        end_date = datetime.now().date()

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    result = await db.execute(
        select(
            func.date(Order.created_at).label("date"),
            func.count(Order.id).label("order_count"),
            func.sum(Order.total).label("revenue"),
            func.sum(Order.tax_amount).label("tax"),
            func.sum(Order.tip_amount).label("tips"),
        ).where(
            Order.restaurant_id == restaurant.id,
            Order.status == "completed",
            Order.created_at.between(start_dt, end_dt),
        ).group_by(func.date(Order.created_at)).order_by(func.date(Order.created_at))
    )
    rows = result.all()
    return [{"date": str(r.date), "order_count": r.order_count, "revenue": float(r.revenue or 0), "tax": float(r.tax or 0), "tips": float(r.tips or 0)} for r in rows]


@router.get("/menu-performance")
async def menu_performance(restaurant: CurrentRestaurant, db: DB, limit: int = 20):
    """Top selling items with profitability."""
    result = await db.execute(
        select(
            OrderItem.menu_item_id,
            func.sum(OrderItem.quantity).label("qty_sold"),
            func.sum(OrderItem.line_total).label("revenue"),
        ).join(Order, OrderItem.order_id == Order.id).where(
            Order.restaurant_id == restaurant.id,
            Order.status == "completed",
        ).group_by(OrderItem.menu_item_id).order_by(func.sum(OrderItem.line_total).desc()).limit(limit)
    )
    rows = result.all()

    from app.models.menu import MenuItem
    items = []
    for row in rows:
        mi_result = await db.execute(select(MenuItem).where(MenuItem.id == row.menu_item_id))
        mi = mi_result.scalar_one_or_none()
        if mi:
            revenue = float(row.revenue or 0)
            cost = float(row.qty_sold or 0) * mi.cost_price
            items.append({
                "menu_item_id": row.menu_item_id,
                "name": mi.name,
                "qty_sold": int(row.qty_sold or 0),
                "revenue": round(revenue, 2),
                "cost": round(cost, 2),
                "profit": round(revenue - cost, 2),
                "margin": mi.profit_margin,
            })
    return items


@router.get("/labor-cost")
async def labor_cost_report(restaurant: CurrentRestaurant, db: DB, start_date: Optional[date] = None, end_date: Optional[date] = None):
    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).date()
    if not end_date:
        end_date = datetime.now().date()

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    result = await db.execute(
        select(TimeEntry, Employee).join(Employee, TimeEntry.employee_id == Employee.id).where(
            TimeEntry.restaurant_id == restaurant.id,
            TimeEntry.clock_in.between(start_dt, end_dt),
            TimeEntry.clock_out.is_not(None),
        )
    )
    rows = result.all()

    total_hours = 0.0
    total_cost = 0.0
    by_employee = {}

    for entry, emp in rows:
        hours = entry.total_hours or 0
        cost = hours * emp.hourly_rate + (entry.overtime_hours or 0) * (emp.overtime_rate or emp.hourly_rate * 1.5)
        total_hours += hours
        total_cost += cost
        if emp.id not in by_employee:
            by_employee[emp.id] = {"employee_id": emp.id, "position": emp.position, "hours": 0.0, "cost": 0.0}
        by_employee[emp.id]["hours"] += hours
        by_employee[emp.id]["cost"] += cost

    return {
        "total_hours": round(total_hours, 2),
        "total_cost": round(total_cost, 2),
        "by_employee": list(by_employee.values()),
    }


@router.get("/food-cost")
async def food_cost_report(restaurant: CurrentRestaurant, db: DB, start_date: Optional[date] = None, end_date: Optional[date] = None):
    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).date()
    if not end_date:
        end_date = datetime.now().date()

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    revenue_result = await db.execute(
        select(func.sum(Order.total)).where(
            Order.restaurant_id == restaurant.id,
            Order.status == "completed",
            Order.created_at.between(start_dt, end_dt),
        )
    )
    revenue = float(revenue_result.scalar() or 0)

    waste_result = await db.execute(
        select(func.sum(WasteLog.estimated_cost)).where(
            WasteLog.restaurant_id == restaurant.id,
            WasteLog.logged_at.between(start_dt, end_dt),
        )
    )
    waste_cost = float(waste_result.scalar() or 0)

    # Approximate COGS from order items using menu_item.cost_price
    cogs_result = await db.execute(
        select(
            func.sum(OrderItem.quantity * 0).label("cogs")  # placeholder — actual joins below
        ).join(Order, OrderItem.order_id == Order.id).where(
            Order.restaurant_id == restaurant.id,
            Order.status == "completed",
            Order.created_at.between(start_dt, end_dt),
        )
    )

    from app.models.menu import MenuItem
    cogs_rows = await db.execute(
        select(OrderItem.menu_item_id, func.sum(OrderItem.quantity).label("qty"))
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.restaurant_id == restaurant.id, Order.status == "completed", Order.created_at.between(start_dt, end_dt))
        .group_by(OrderItem.menu_item_id)
    )
    total_cogs = 0.0
    for row in cogs_rows.all():
        mi_res = await db.execute(select(MenuItem.cost_price).where(MenuItem.id == row.menu_item_id))
        cost = mi_res.scalar() or 0
        total_cogs += cost * (row.qty or 0)

    food_cost_pct = (total_cogs / revenue * 100) if revenue > 0 else 0

    return {
        "revenue": round(revenue, 2),
        "cogs": round(total_cogs, 2),
        "waste_cost": round(waste_cost, 2),
        "food_cost_percentage": round(food_cost_pct, 2),
        "target_food_cost_pct": 30.0,
        "variance": round(food_cost_pct - 30.0, 2),
    }
