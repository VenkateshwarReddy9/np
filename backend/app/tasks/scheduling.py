"""Staff scheduling background tasks."""
import asyncio
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.scheduling.check_overtime_risks")
def check_overtime_risks():
    """Alert managers when a staff member is approaching 40h/week."""
    async def _run():
        from app.database import AsyncSessionLocal
        from app.models.staff import TimeEntry, Employee
        from app.websocket.manager import ws_manager
        from sqlalchemy import select, func
        from datetime import datetime, timedelta
        week_start = datetime.now() - timedelta(days=7)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(TimeEntry.employee_id, func.sum(TimeEntry.total_hours).label("hours"))
                .where(TimeEntry.clock_in >= week_start, TimeEntry.clock_out.is_not(None))
                .group_by(TimeEntry.employee_id)
                .having(func.sum(TimeEntry.total_hours) >= 35)  # within 5h of OT
            )
            for row in result.all():
                emp_result = await db.execute(select(Employee).where(Employee.id == row.employee_id))
                emp = emp_result.scalar_one_or_none()
                if emp:
                    await ws_manager.broadcast_to_restaurant(emp.restaurant_id, {
                        "event": "alert.overtime",
                        "data": {"employee_id": emp.id, "hours": float(row.hours or 0), "threshold": 40},
                    })
    asyncio.run(_run())
