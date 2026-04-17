import random
import string
from datetime import date, time
from typing import Optional
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from pydantic import BaseModel
from app.dependencies import CurrentRestaurant, DB
from app.models.reservation import Reservation, Waitlist

router = APIRouter(tags=["reservations"])


def generate_confirmation_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


class ReservationCreate(BaseModel):
    table_id: Optional[str] = None
    customer_id: Optional[str] = None
    guest_name: str
    guest_phone: Optional[str] = None
    guest_email: Optional[str] = None
    party_size: int
    reservation_date: date
    time_slot: time
    duration_min: int = 90
    notes: Optional[str] = None
    occasion: Optional[str] = None


class ReservationUpdate(BaseModel):
    table_id: Optional[str] = None
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    guest_email: Optional[str] = None
    party_size: Optional[int] = None
    reservation_date: Optional[date] = None
    time_slot: Optional[time] = None
    duration_min: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class WaitlistCreate(BaseModel):
    guest_name: str
    guest_phone: Optional[str] = None
    party_size: int
    notes: Optional[str] = None
    estimated_wait_min: Optional[int] = None


@router.get("/reservations")
async def list_reservations(
    restaurant: CurrentRestaurant,
    db: DB,
    reservation_date: Optional[date] = None,
    status: Optional[str] = None,
):
    query = select(Reservation).where(Reservation.restaurant_id == restaurant.id)
    if reservation_date:
        query = query.where(Reservation.reservation_date == reservation_date)
    if status:
        query = query.where(Reservation.status == status)
    query = query.order_by(Reservation.reservation_date, Reservation.time_slot)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/reservations", status_code=201)
async def create_reservation(body: ReservationCreate, restaurant: CurrentRestaurant, db: DB):
    reservation = Reservation(
        restaurant_id=restaurant.id,
        confirmation_code=generate_confirmation_code(),
        **body.model_dump(),
    )
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)

    from app.tasks.celery_app import celery_app
    celery_app.send_task("app.tasks.notifications.send_reservation_confirmation", args=[reservation.id])
    return reservation


@router.get("/reservations/{reservation_id}")
async def get_reservation(reservation_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id, Reservation.restaurant_id == restaurant.id))
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(status_code=404, detail="Reservation not found")
    return res


@router.patch("/reservations/{reservation_id}")
async def update_reservation(reservation_id: str, body: ReservationUpdate, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id, Reservation.restaurant_id == restaurant.id))
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(status_code=404, detail="Reservation not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(res, k, v)
    await db.commit()
    await db.refresh(res)
    return res


@router.post("/reservations/{reservation_id}/seat")
async def seat_reservation(reservation_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id, Reservation.restaurant_id == restaurant.id))
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(status_code=404, detail="Reservation not found")
    res.status = "seated"
    if res.table_id:
        from app.models.table import RestaurantTable
        tbl_result = await db.execute(select(RestaurantTable).where(RestaurantTable.id == res.table_id))
        tbl = tbl_result.scalar_one_or_none()
        if tbl:
            tbl.status = "occupied"
    await db.commit()
    return {"status": "seated"}


@router.delete("/reservations/{reservation_id}", status_code=204)
async def cancel_reservation(reservation_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id, Reservation.restaurant_id == restaurant.id))
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(status_code=404, detail="Not found")
    res.status = "cancelled"
    await db.commit()


# ─── Waitlist ─────────────────────────────────────────────────────────────────

@router.get("/waitlist")
async def list_waitlist(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(
        select(Waitlist).where(Waitlist.restaurant_id == restaurant.id, Waitlist.status == "waiting")
        .order_by(Waitlist.added_at)
    )
    return result.scalars().all()


@router.post("/waitlist", status_code=201)
async def add_to_waitlist(body: WaitlistCreate, restaurant: CurrentRestaurant, db: DB):
    entry = Waitlist(restaurant_id=restaurant.id, **body.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.patch("/waitlist/{entry_id}")
async def update_waitlist(entry_id: str, status: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Waitlist).where(Waitlist.id == entry_id, Waitlist.restaurant_id == restaurant.id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    from datetime import datetime, timezone
    entry.status = status
    if status == "notified":
        entry.notified_at = datetime.now(timezone.utc)
    elif status == "seated":
        entry.seated_at = datetime.now(timezone.utc)
    await db.commit()
    return entry
