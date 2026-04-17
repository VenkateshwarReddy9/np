"""Scheduled report generation tasks."""
import asyncio
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.reports.daily_analytics_snapshot")
def daily_analytics_snapshot():
    """Generate yesterday's analytics snapshot for fast dashboard loading."""
    async def _run():
        from app.database import AsyncSessionLocal
        from app.models.restaurant import Restaurant
        from sqlalchemy import select
        async with AsyncSessionLocal() as db:
            restaurants = (await db.execute(select(Restaurant).where(Restaurant.is_active == True))).scalars().all()
            for r in restaurants:
                print(f"[REPORT] Generating daily snapshot for {r.name}")
                # In production: compute and cache analytics to Redis
    asyncio.run(_run())
