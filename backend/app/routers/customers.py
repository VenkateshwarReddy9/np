from typing import Optional
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, or_
from pydantic import BaseModel
from datetime import date
from app.dependencies import CurrentRestaurant, DB
from app.models.customer import Customer, LoyaltyTransaction, LoyaltyProgram, MarketingCampaign, CustomerFeedback
from app.models.order import Order

router = APIRouter(tags=["customers"])


class CustomerCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    birthday: Optional[date] = None
    dietary_restrictions: Optional[str] = None
    allergens: Optional[str] = None
    notes: Optional[str] = None
    is_opted_in_marketing: bool = False


class LoyaltyRedeem(BaseModel):
    points: int
    order_id: Optional[str] = None


class CampaignCreate(BaseModel):
    name: str
    type: str  # email|sms|both
    subject: Optional[str] = None
    message: str
    target_segment: Optional[str] = None  # JSON
    scheduled_at: Optional[str] = None


class FeedbackCreate(BaseModel):
    customer_id: Optional[str] = None
    order_id: Optional[str] = None
    rating: int
    comment: Optional[str] = None


# ─── Customers ────────────────────────────────────────────────────────────────

@router.get("/customers")
async def list_customers(
    restaurant: CurrentRestaurant,
    db: DB,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    query = select(Customer).where(Customer.restaurant_id == restaurant.id, Customer.is_active == True)
    if search:
        query = query.where(
            or_(
                Customer.first_name.ilike(f"%{search}%"),
                Customer.last_name.ilike(f"%{search}%"),
                Customer.email.ilike(f"%{search}%"),
                Customer.phone.ilike(f"%{search}%"),
            )
        )
    query = query.order_by(Customer.last_visit_at.desc().nullslast()).limit(limit).offset(offset)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/customers", status_code=201)
async def create_customer(body: CustomerCreate, restaurant: CurrentRestaurant, db: DB):
    customer = Customer(restaurant_id=restaurant.id, **body.model_dump())
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.post("/customers/lookup")
async def lookup_customer(phone: str, restaurant: CurrentRestaurant, db: DB):
    """Find customer by phone for POS quick-add."""
    result = await db.execute(select(Customer).where(Customer.phone == phone, Customer.restaurant_id == restaurant.id))
    customer = result.scalar_one_or_none()
    return customer


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Customer).where(Customer.id == customer_id, Customer.restaurant_id == restaurant.id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, body: CustomerCreate, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Customer).where(Customer.id == customer_id, Customer.restaurant_id == restaurant.id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(customer, k, v)
    await db.commit()
    return customer


@router.get("/customers/{customer_id}/orders")
async def customer_order_history(customer_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(
        select(Order).where(Order.customer_id == customer_id, Order.restaurant_id == restaurant.id)
        .order_by(Order.created_at.desc()).limit(20)
    )
    return result.scalars().all()


# ─── Loyalty ──────────────────────────────────────────────────────────────────

@router.get("/loyalty/program")
async def get_loyalty_program(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(LoyaltyProgram).where(LoyaltyProgram.restaurant_id == restaurant.id))
    program = result.scalar_one_or_none()
    if not program:
        # Auto-create if missing
        program = LoyaltyProgram(restaurant_id=restaurant.id)
        db.add(program)
        await db.commit()
        await db.refresh(program)
    return program


@router.get("/customers/{customer_id}/loyalty")
async def customer_loyalty(customer_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Customer).where(Customer.id == customer_id, Customer.restaurant_id == restaurant.id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Not found")

    txns_result = await db.execute(
        select(LoyaltyTransaction).where(LoyaltyTransaction.customer_id == customer_id).order_by(LoyaltyTransaction.created_at.desc()).limit(20)
    )
    return {
        "points": customer.loyalty_points,
        "total_visits": customer.total_visits,
        "total_spent": customer.total_spent,
        "transactions": txns_result.scalars().all(),
    }


@router.post("/customers/{customer_id}/loyalty/redeem")
async def redeem_points(customer_id: str, body: LoyaltyRedeem, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Customer).where(Customer.id == customer_id, Customer.restaurant_id == restaurant.id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Not found")

    program_result = await db.execute(select(LoyaltyProgram).where(LoyaltyProgram.restaurant_id == restaurant.id))
    program = program_result.scalar_one_or_none()
    if not program or not program.is_active:
        raise HTTPException(status_code=400, detail="Loyalty program not active")

    if customer.loyalty_points < body.points:
        raise HTTPException(status_code=400, detail="Insufficient points")
    if body.points < program.min_redemption_points:
        raise HTTPException(status_code=400, detail=f"Minimum redemption is {program.min_redemption_points} points")

    customer.loyalty_points -= body.points
    dollar_value = body.points * program.redemption_value

    txn = LoyaltyTransaction(
        customer_id=customer_id,
        order_id=body.order_id,
        type="redeemed",
        points=-body.points,
        balance_after=customer.loyalty_points,
        description=f"Redeemed {body.points} points for ${dollar_value:.2f}",
    )
    db.add(txn)
    await db.commit()
    return {"redeemed_points": body.points, "dollar_value": dollar_value, "remaining_points": customer.loyalty_points}


# ─── Marketing Campaigns ──────────────────────────────────────────────────────

@router.get("/marketing/campaigns")
async def list_campaigns(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(MarketingCampaign).where(MarketingCampaign.restaurant_id == restaurant.id).order_by(MarketingCampaign.created_at.desc()))
    return result.scalars().all()


@router.post("/marketing/campaigns", status_code=201)
async def create_campaign(body: CampaignCreate, restaurant: CurrentRestaurant, db: DB):
    campaign = MarketingCampaign(restaurant_id=restaurant.id, **body.model_dump())
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.post("/marketing/campaigns/{campaign_id}/send")
async def send_campaign(campaign_id: str, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(MarketingCampaign).where(MarketingCampaign.id == campaign_id, MarketingCampaign.restaurant_id == restaurant.id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.status = "sending"
    await db.commit()
    from app.tasks.celery_app import celery_app
    celery_app.send_task("app.tasks.notifications.send_campaign", args=[campaign_id])
    return {"status": "queued", "campaign_id": campaign_id}


# ─── Feedback ─────────────────────────────────────────────────────────────────

@router.get("/feedback")
async def list_feedback(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(
        select(CustomerFeedback).where(CustomerFeedback.restaurant_id == restaurant.id).order_by(CustomerFeedback.created_at.desc()).limit(100)
    )
    return result.scalars().all()


@router.post("/feedback", status_code=201)
async def submit_feedback(body: FeedbackCreate, restaurant: CurrentRestaurant, db: DB):
    feedback = CustomerFeedback(restaurant_id=restaurant.id, **body.model_dump())
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return feedback
