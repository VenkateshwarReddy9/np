import uuid
from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, Float, Integer, Boolean, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(30), index=True)
    birthday: Mapped[date | None] = mapped_column(Date)
    dietary_restrictions: Mapped[str | None] = mapped_column(Text)  # JSON list
    allergens: Mapped[str | None] = mapped_column(Text)  # JSON list
    preferences: Mapped[str | None] = mapped_column(Text)  # JSON object
    notes: Mapped[str | None] = mapped_column(Text)
    loyalty_points: Mapped[int] = mapped_column(Integer, default=0)
    total_visits: Mapped[int] = mapped_column(Integer, default=0)
    total_spent: Mapped[float] = mapped_column(Float, default=0.0)
    last_visit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # source: walk_in|online|reservation|import
    source: Mapped[str] = mapped_column(String(30), default="walk_in")
    is_opted_in_marketing: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    loyalty_transactions: Mapped[list["LoyaltyTransaction"]] = relationship("LoyaltyTransaction", back_populates="customer", cascade="all, delete-orphan")
    feedback: Mapped[list["CustomerFeedback"]] = relationship("CustomerFeedback", back_populates="customer")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class LoyaltyProgram(Base):
    __tablename__ = "loyalty_programs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(100), default="Loyalty Rewards")
    points_per_dollar: Mapped[float] = mapped_column(Float, default=1.0)
    redemption_value: Mapped[float] = mapped_column(Float, default=0.01)  # $ per point
    min_redemption_points: Mapped[int] = mapped_column(Integer, default=100)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LoyaltyTransaction(Base):
    __tablename__ = "loyalty_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    order_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("orders.id", ondelete="SET NULL"))
    # type: earned|redeemed|bonus|adjusted|expired
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    customer: Mapped["Customer"] = relationship("Customer", back_populates="loyalty_transactions")


class MarketingCampaign(Base):
    __tablename__ = "marketing_campaigns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # type: email|sms|both
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # target_segment: JSON — e.g. {"inactive_days": 30, "min_visits": 2}
    target_segment: Mapped[str | None] = mapped_column(Text)
    # status: draft|scheduled|sending|sent|cancelled
    status: Mapped[str] = mapped_column(String(20), default="draft")
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recipient_count: Mapped[int] = mapped_column(Integer, default=0)
    open_count: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    recipients: Mapped[list["CampaignRecipient"]] = relationship("CampaignRecipient", back_populates="campaign", cascade="all, delete-orphan")


class CampaignRecipient(Base):
    __tablename__ = "campaign_recipients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id: Mapped[str] = mapped_column(String(36), ForeignKey("marketing_campaigns.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    # status: pending|sent|failed|bounced
    status: Mapped[str] = mapped_column(String(20), default="pending")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(String(500))

    campaign: Mapped["MarketingCampaign"] = relationship("MarketingCampaign", back_populates="recipients")


class CustomerFeedback(Base):
    __tablename__ = "customer_feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("customers.id", ondelete="SET NULL"))
    order_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("orders.id", ondelete="SET NULL"))
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    comment: Mapped[str | None] = mapped_column(Text)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    response: Mapped[str | None] = mapped_column(Text)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    customer: Mapped["Customer | None"] = relationship("Customer", back_populates="feedback")
