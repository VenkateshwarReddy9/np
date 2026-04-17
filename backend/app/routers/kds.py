from typing import Optional
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from pydantic import BaseModel
from app.dependencies import CurrentRestaurant, DB
from app.models.kds import KDSStation, KDSTicket
from app.models.order import OrderItem
from app.websocket.manager import ws_manager

router = APIRouter(prefix="/kds", tags=["kds"])


class StationCreate(BaseModel):
    name: str
    display_order: int = 0
    color: str = "#1E40AF"
    auto_route_categories: Optional[str] = None


class TicketStatusUpdate(BaseModel):
    status: str  # waiting|in_progress|ready|bumped


@router.get("/stations")
async def list_stations(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(
        select(KDSStation)
        .where(KDSStation.restaurant_id == restaurant.id, KDSStation.is_active == True)
        .order_by(KDSStation.display_order)
    )
    return result.scalars().all()


@router.post("/stations", status_code=201)
async def create_station(body: StationCreate, restaurant: CurrentRestaurant, db: DB):
    station = KDSStation(restaurant_id=restaurant.id, **body.model_dump())
    db.add(station)
    await db.commit()
    await db.refresh(station)
    return station


@router.get("/tickets")
async def list_tickets(
    restaurant: CurrentRestaurant,
    db: DB,
    station_id: Optional[str] = None,
    status: Optional[str] = None,
):
    query = (
        select(KDSTicket)
        .join(KDSTicket.order)
        .where(KDSTicket.order.has(restaurant_id=restaurant.id))
    )
    if station_id:
        query = query.where(KDSTicket.station_id == station_id)
    if status:
        query = query.where(KDSTicket.status == status)
    else:
        query = query.where(KDSTicket.status.in_(["waiting", "in_progress"]))
    query = query.order_by(KDSTicket.priority.desc(), KDSTicket.displayed_at)
    result = await db.execute(query)
    tickets = result.scalars().all()
    return [
        {
            "id": t.id,
            "order_id": t.order_id,
            "order_item_id": t.order_item_id,
            "station_id": t.station_id,
            "status": t.status,
            "priority": t.priority,
            "displayed_at": t.displayed_at.isoformat(),
            "started_at": t.started_at.isoformat() if t.started_at else None,
        }
        for t in tickets
    ]


@router.patch("/tickets/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, body: TicketStatusUpdate, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(KDSTicket).where(KDSTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    from datetime import datetime, timezone
    ticket.status = body.status
    if body.status == "in_progress" and not ticket.started_at:
        ticket.started_at = datetime.now(timezone.utc)
    elif body.status in ("ready", "bumped"):
        ticket.completed_at = datetime.now(timezone.utc)
        if body.status == "bumped":
            ticket.bumped_at = datetime.now(timezone.utc)

    # Update corresponding order item status
    if ticket.order_item_id:
        oi_result = await db.execute(select(OrderItem).where(OrderItem.id == ticket.order_item_id))
        oi = oi_result.scalar_one_or_none()
        if oi:
            oi.status = "ready" if body.status == "ready" else "preparing"

    await db.commit()

    await ws_manager.broadcast_to_restaurant(restaurant.id, {
        "event": "kds.ticket.updated",
        "data": {"ticket_id": ticket_id, "status": body.status, "order_id": ticket.order_id},
    })
    return {"ticket_id": ticket_id, "status": body.status}


@router.post("/orders/{order_id}/bump")
async def bump_order(order_id: str, restaurant: CurrentRestaurant, db: DB):
    """Bump all tickets for an order."""
    from datetime import datetime, timezone
    result = await db.execute(select(KDSTicket).where(KDSTicket.order_id == order_id))
    tickets = result.scalars().all()
    for t in tickets:
        t.status = "bumped"
        t.bumped_at = datetime.now(timezone.utc)
    await db.commit()
    await ws_manager.broadcast_to_restaurant(restaurant.id, {
        "event": "kds.order.bumped",
        "data": {"order_id": order_id},
    })
    return {"order_id": order_id, "bumped": len(tickets)}
