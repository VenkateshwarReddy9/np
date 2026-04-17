from datetime import datetime, timezone, date
from typing import Optional
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, func
from pydantic import BaseModel
from app.dependencies import CurrentRestaurant, CurrentUser, DB
from app.models.staff import Employee, Shift, TimeEntry, PayrollPeriod, PayrollEntry

router = APIRouter(prefix="/staff", tags=["staff"])


class EmployeeCreate(BaseModel):
    user_id: Optional[str] = None
    position: str
    role: str
    hourly_rate: float = 0.0
    overtime_rate: Optional[float] = None
    hire_date: Optional[date] = None
    emergency_name: Optional[str] = None
    emergency_phone: Optional[str] = None
    notes: Optional[str] = None


class ShiftCreate(BaseModel):
    employee_id: str
    role: str
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None


class ClockInRequest(BaseModel):
    employee_id: str
    shift_id: Optional[str] = None


class ClockOutRequest(BaseModel):
    employee_id: str
    break_minutes: int = 0
    notes: Optional[str] = None


class PayrollProcessRequest(BaseModel):
    period_start: date
    period_end: date


# ─── Employees ───────────────────────────────────────────────────────────────

@router.get("/employees")
async def list_employees(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Employee).where(Employee.restaurant_id == restaurant.id, Employee.status == "active"))
    return result.scalars().all()


@router.post("/employees", status_code=201)
async def create_employee(body: EmployeeCreate, restaurant: CurrentRestaurant, db: DB):
    emp = Employee(restaurant_id=restaurant.id, **body.model_dump())
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return emp


@router.get("/employees/{employee_id}")
async def get_employee(employee_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Employee).where(Employee.id == employee_id, Employee.restaurant_id == restaurant.id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


@router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, body: EmployeeCreate, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Employee).where(Employee.id == employee_id, Employee.restaurant_id == restaurant.id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(emp, k, v)
    await db.commit()
    return emp


@router.delete("/employees/{employee_id}", status_code=204)
async def deactivate_employee(employee_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Employee).where(Employee.id == employee_id, Employee.restaurant_id == restaurant.id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Not found")
    emp.status = "inactive"
    await db.commit()


# ─── Shifts ──────────────────────────────────────────────────────────────────

@router.get("/shifts")
async def list_shifts(
    restaurant: CurrentRestaurant,
    db: DB,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    employee_id: Optional[str] = None,
):
    query = select(Shift).where(Shift.restaurant_id == restaurant.id)
    if start_date:
        query = query.where(Shift.start_time >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.where(Shift.end_time <= datetime.combine(end_date, datetime.max.time()))
    if employee_id:
        query = query.where(Shift.employee_id == employee_id)
    query = query.order_by(Shift.start_time)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/shifts", status_code=201)
async def create_shift(body: ShiftCreate, current_user: CurrentUser, restaurant: CurrentRestaurant, db: DB):
    shift = Shift(restaurant_id=restaurant.id, created_by=current_user.id, **body.model_dump())
    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    return shift


@router.post("/shifts/bulk", status_code=201)
async def create_shifts_bulk(shifts: list[ShiftCreate], current_user: CurrentUser, restaurant: CurrentRestaurant, db: DB):
    created = []
    for s in shifts:
        shift = Shift(restaurant_id=restaurant.id, created_by=current_user.id, **s.model_dump())
        db.add(shift)
        created.append(shift)
    await db.commit()
    return {"created": len(created)}


@router.put("/shifts/{shift_id}")
async def update_shift(shift_id: str, body: ShiftCreate, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Shift).where(Shift.id == shift_id, Shift.restaurant_id == restaurant.id))
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(shift, k, v)
    await db.commit()
    return shift


@router.delete("/shifts/{shift_id}", status_code=204)
async def delete_shift(shift_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Shift).where(Shift.id == shift_id, Shift.restaurant_id == restaurant.id))
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(shift)
    await db.commit()


# ─── Time Clock ───────────────────────────────────────────────────────────────

@router.post("/clock-in", status_code=201)
async def clock_in(body: ClockInRequest, restaurant: CurrentRestaurant, db: DB):
    # Check not already clocked in
    existing = await db.execute(
        select(TimeEntry).where(
            TimeEntry.employee_id == body.employee_id,
            TimeEntry.clock_out.is_(None),
            TimeEntry.restaurant_id == restaurant.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already clocked in")

    entry = TimeEntry(
        restaurant_id=restaurant.id,
        employee_id=body.employee_id,
        shift_id=body.shift_id,
        clock_in=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.post("/clock-out")
async def clock_out(body: ClockOutRequest, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(
        select(TimeEntry).where(
            TimeEntry.employee_id == body.employee_id,
            TimeEntry.clock_out.is_(None),
            TimeEntry.restaurant_id == restaurant.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=400, detail="Not clocked in")

    entry.clock_out = datetime.now(timezone.utc)
    entry.break_minutes = body.break_minutes
    entry.notes = body.notes

    duration = (entry.clock_out - entry.clock_in).total_seconds() / 3600
    work_hours = duration - (body.break_minutes / 60)
    entry.total_hours = round(max(0, work_hours), 2)
    entry.overtime_hours = round(max(0, work_hours - 8), 2)

    await db.commit()
    return entry


@router.get("/time-entries")
async def list_time_entries(
    restaurant: CurrentRestaurant,
    db: DB,
    employee_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    query = select(TimeEntry).where(TimeEntry.restaurant_id == restaurant.id)
    if employee_id:
        query = query.where(TimeEntry.employee_id == employee_id)
    if start_date:
        query = query.where(TimeEntry.clock_in >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.where(TimeEntry.clock_in <= datetime.combine(end_date, datetime.max.time()))
    query = query.order_by(TimeEntry.clock_in.desc())
    result = await db.execute(query)
    return result.scalars().all()


# ─── Payroll ─────────────────────────────────────────────────────────────────

@router.post("/payroll/process")
async def process_payroll(body: PayrollProcessRequest, current_user: CurrentUser, restaurant: CurrentRestaurant, db: DB):
    period = PayrollPeriod(
        restaurant_id=restaurant.id,
        period_start=body.period_start,
        period_end=body.period_end,
        run_by=current_user.id,
    )
    db.add(period)
    await db.flush()

    employees_result = await db.execute(select(Employee).where(Employee.restaurant_id == restaurant.id, Employee.status == "active"))
    employees = employees_result.scalars().all()

    total = 0.0
    for emp in employees:
        entries_result = await db.execute(
            select(TimeEntry).where(
                TimeEntry.employee_id == emp.id,
                TimeEntry.clock_in >= datetime.combine(body.period_start, datetime.min.time()),
                TimeEntry.clock_in <= datetime.combine(body.period_end, datetime.max.time()),
                TimeEntry.clock_out.is_not(None),
            )
        )
        entries = entries_result.scalars().all()
        regular_hours = sum(max(0, (e.total_hours or 0) - (e.overtime_hours or 0)) for e in entries)
        overtime_hours = sum(e.overtime_hours or 0 for e in entries)
        regular_pay = regular_hours * emp.hourly_rate
        overtime_rate = emp.overtime_rate or (emp.hourly_rate * 1.5)
        overtime_pay = overtime_hours * overtime_rate
        gross_pay = regular_pay + overtime_pay
        net_pay = gross_pay  # Simplified; tax calculations would go here

        entry = PayrollEntry(
            period_id=period.id,
            employee_id=emp.id,
            regular_hours=round(regular_hours, 2),
            overtime_hours=round(overtime_hours, 2),
            regular_pay=round(regular_pay, 2),
            overtime_pay=round(overtime_pay, 2),
            gross_pay=round(gross_pay, 2),
            net_pay=round(net_pay, 2),
        )
        db.add(entry)
        total += gross_pay

    period.total_amount = round(total, 2)
    period.status = "draft"
    period.processed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"period_id": period.id, "total_amount": period.total_amount, "employees_processed": len(employees)}


@router.get("/payroll/periods")
async def list_payroll_periods(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(
        select(PayrollPeriod).where(PayrollPeriod.restaurant_id == restaurant.id).order_by(PayrollPeriod.period_start.desc())
    )
    return result.scalars().all()
