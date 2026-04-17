from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "restaurant_os",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.inventory",
        "app.tasks.notifications",
        "app.tasks.reports",
        "app.tasks.scheduling",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
)

celery_app.conf.beat_schedule = {
    "check-low-stock-every-hour": {
        "task": "app.tasks.inventory.check_low_stock_all_restaurants",
        "schedule": crontab(minute=0),  # every hour
    },
    "send-reservation-reminders": {
        "task": "app.tasks.notifications.send_reservation_reminders",
        "schedule": crontab(minute="*/15"),  # every 15 min
    },
    "birthday-campaigns": {
        "task": "app.tasks.notifications.send_birthday_campaigns",
        "schedule": crontab(hour=9, minute=0),  # every day at 9am
    },
    "daily-analytics-snapshot": {
        "task": "app.tasks.reports.daily_analytics_snapshot",
        "schedule": crontab(hour=1, minute=0),  # 1am daily
    },
}
