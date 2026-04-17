from typing import Optional
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from pydantic import BaseModel
from app.dependencies import CurrentRestaurant, DB
from app.models.table import TableSection, RestaurantTable
from app.websocket.manager import ws_manager

router = APIRouter(prefix="/tables", tags=["tables"])


class SectionCreate(BaseModel):
    name: str
    color: str = "#3B82F6"


class TableCreate(BaseModel):
    section_id: Optional[str] = None
    name: str
    capacity: int = 4
    pos_x: float = 0.0
    pos_y: float = 0.0
    width: float = 80.0
    height: float = 80.0
    shape: str = "rectangle"


class TableUpdate(TableCreate):
    is_active: bool = True


class TableStatusUpdate(BaseModel):
    status: str  # available|occupied|reserved|cleaning|inactive


@router.get("/sections")
async def list_sections(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(TableSection).where(TableSection.restaurant_id == restaurant.id))
    return result.scalars().all()


@router.post("/sections", status_code=201)
async def create_section(body: SectionCreate, restaurant: CurrentRestaurant, db: DB):
    section = TableSection(restaurant_id=restaurant.id, **body.model_dump())
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return section


@router.get("")
async def list_tables(restaurant: CurrentRestaurant, db: DB, section_id: Optional[str] = None):
    query = select(RestaurantTable).where(RestaurantTable.restaurant_id == restaurant.id)
    if section_id:
        query = query.where(RestaurantTable.section_id == section_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", status_code=201)
async def create_table(body: TableCreate, restaurant: CurrentRestaurant, db: DB):
    table = RestaurantTable(restaurant_id=restaurant.id, **body.model_dump())
    db.add(table)
    await db.commit()
    await db.refresh(table)
    return table


@router.put("/{table_id}")
async def update_table(table_id: str, body: TableUpdate, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(RestaurantTable).where(RestaurantTable.id == table_id, RestaurantTable.restaurant_id == restaurant.id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    for k, v in body.model_dump().items():
        setattr(table, k, v)
    await db.commit()
    await db.refresh(table)
    return table


@router.patch("/{table_id}/status")
async def update_table_status(table_id: str, body: TableStatusUpdate, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(RestaurantTable).where(RestaurantTable.id == table_id, RestaurantTable.restaurant_id == restaurant.id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    table.status = body.status
    await db.commit()
    await ws_manager.broadcast_to_restaurant(restaurant.id, {
        "event": "table.status",
        "data": {"table_id": table_id, "status": body.status},
    })
    return {"table_id": table_id, "status": body.status}


@router.delete("/{table_id}", status_code=204)
async def delete_table(table_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(RestaurantTable).where(RestaurantTable.id == table_id, RestaurantTable.restaurant_id == restaurant.id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    await db.delete(table)
    await db.commit()
