"""Notification background tasks — email, SMS, campaigns, reminders."""
import asyncio
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.notifications.send_reservation_confirmation")
def send_reservation_confirmation(reservation_id: str):
    async def _run():
        from app.database import AsyncSessionLocal
        from app.models.reservation import Reservation
        from sqlalchemy import select
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
            res = result.scalar_one_or_none()
            if res and res.guest_email:
                # Email sending logic would go here (aiosmtplib + Jinja2 template)
                print(f"[NOTIFY] Reservation confirmation to {res.guest_email} — code {res.confirmation_code}")
    asyncio.run(_run())


@celery_app.task(name="app.tasks.notifications.send_reservation_reminders")
def send_reservation_reminders():
    """Send SMS reminders 24h before reservation."""
    async def _run():
        from app.database import AsyncSessionLocal
        from app.models.reservation import Reservation
        from sqlalchemy import select
        from datetime import datetime, timezone, timedelta
        async with AsyncSessionLocal() as db:
            tomorrow_start = (datetime.now(timezone.utc) + timedelta(hours=23)).date()
            tomorrow_end = (datetime.now(timezone.utc) + timedelta(hours=25)).date()
            result = await db.execute(
                select(Reservation).where(
                    Reservation.reservation_date.between(tomorrow_start, tomorrow_end),
                    Reservation.status == "confirmed",
                    Reservation.reminder_sent_at.is_(None),
                )
            )
            reservations = result.scalars().all()
            for res in reservations:
                if res.guest_phone:
                    print(f"[SMS] Reminder to {res.guest_phone} for reservation {res.id} at {res.time_slot}")
                    res.reminder_sent_at = datetime.now(timezone.utc)
            await db.commit()
    asyncio.run(_run())


@celery_app.task(name="app.tasks.notifications.award_loyalty_points")
def award_loyalty_points(customer_id: str, order_total: float):
    async def _run():
        from app.database import AsyncSessionLocal
        from app.models.customer import Customer, LoyaltyTransaction, LoyaltyProgram
        from sqlalchemy import select
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Customer).where(Customer.id == customer_id))
            customer = result.scalar_one_or_none()
            if not customer:
                return

            program_result = await db.execute(select(LoyaltyProgram).where(LoyaltyProgram.restaurant_id == customer.restaurant_id, LoyaltyProgram.is_active == True))
            program = program_result.scalar_one_or_none()
            if not program:
                return

            points = int(order_total * program.points_per_dollar)
            if points > 0:
                customer.loyalty_points += points
                txn = LoyaltyTransaction(
                    customer_id=customer_id,
                    type="earned",
                    points=points,
                    balance_after=customer.loyalty_points,
                    description=f"Earned from ${order_total:.2f} order",
                )
                db.add(txn)
                await db.commit()
    asyncio.run(_run())


@celery_app.task(name="app.tasks.notifications.send_campaign")
def send_campaign(campaign_id: str):
    async def _run():
        from app.database import AsyncSessionLocal
        from app.models.customer import MarketingCampaign, Customer, CampaignRecipient
        from sqlalchemy import select
        from datetime import datetime, timezone
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(MarketingCampaign).where(MarketingCampaign.id == campaign_id))
            campaign = result.scalar_one_or_none()
            if not campaign:
                return

            # Get opted-in customers
            customers_result = await db.execute(
                select(Customer).where(
                    Customer.restaurant_id == campaign.restaurant_id,
                    Customer.is_opted_in_marketing == True,
                    Customer.is_active == True,
                )
            )
            customers = customers_result.scalars().all()

            sent = 0
            for customer in customers:
                # Email/SMS sending logic here
                if campaign.type in ("email", "both") and customer.email:
                    print(f"[EMAIL] Campaign '{campaign.name}' to {customer.email}")
                    sent += 1
                if campaign.type in ("sms", "both") and customer.phone:
                    print(f"[SMS] Campaign '{campaign.name}' to {customer.phone}")

                recipient = CampaignRecipient(
                    campaign_id=campaign_id,
                    customer_id=customer.id,
                    status="sent",
                    sent_at=datetime.now(timezone.utc),
                )
                db.add(recipient)

            campaign.status = "sent"
            campaign.sent_at = datetime.now(timezone.utc)
            campaign.recipient_count = sent
            await db.commit()
    asyncio.run(_run())


@celery_app.task(name="app.tasks.notifications.send_birthday_campaigns")
def send_birthday_campaigns():
    async def _run():
        from app.database import AsyncSessionLocal
        from app.models.customer import Customer
        from sqlalchemy import select, func
        from datetime import datetime
        today = datetime.now()
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Customer).where(
                    func.extract("month", Customer.birthday) == today.month,
                    func.extract("day", Customer.birthday) == today.day,
                    Customer.is_opted_in_marketing == True,
                    Customer.is_active == True,
                )
            )
            customers = result.scalars().all()
            for c in customers:
                print(f"[BIRTHDAY] Happy Birthday to {c.full_name}! (email: {c.email})")
    asyncio.run(_run())
