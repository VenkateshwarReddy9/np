import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.config import settings
from app.models.user import User, RefreshToken
from app.models.restaurant import Restaurant
from app.dependencies import CurrentUser, DB

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PINLoginRequest(BaseModel):
    restaurant_id: str
    pin: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: str | None = None


class SetupRequest(BaseModel):
    restaurant_name: str
    restaurant_slug: str
    owner_email: EmailStr
    owner_password: str
    owner_first_name: str
    owner_last_name: str
    timezone: str = "America/New_York"
    currency: str = "USD"
    tax_rate: float = 0.0


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


def create_access_token(user_id: str, restaurant_id: str | None, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "restaurant_id": restaurant_id,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token() -> str:
    return str(uuid.uuid4())


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


@router.post("/setup", status_code=201)
async def setup_restaurant(body: SetupRequest, db: DB):
    """First-run wizard: create restaurant + owner account."""
    existing = await db.execute(select(Restaurant).limit(1))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Restaurant already configured")

    restaurant = Restaurant(
        name=body.restaurant_name,
        slug=body.restaurant_slug,
        timezone=body.timezone,
        currency=body.currency,
        tax_rate=body.tax_rate,
        is_configured=True,
    )
    db.add(restaurant)
    await db.flush()

    user = User(
        restaurant_id=restaurant.id,
        email=body.owner_email,
        password_hash=hash_password(body.owner_password),
        role="owner",
        first_name=body.owner_first_name,
        last_name=body.owner_last_name,
    )
    db.add(user)
    await db.commit()
    return {"message": "Restaurant created", "restaurant_id": restaurant.id}


@router.get("/setup/status")
async def setup_status(db: DB):
    result = await db.execute(select(Restaurant).limit(1))
    restaurant = result.scalar_one_or_none()
    return {"configured": restaurant is not None}


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: DB):
    result = await db.execute(select(User).where(User.email == body.email, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(user.id, user.restaurant_id, user.role)
    raw_refresh = create_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_password(raw_refresh),
        expires_at=expires,
    )
    db.add(rt)
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        user={
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "restaurant_id": user.restaurant_id,
        },
    )


@router.post("/login/pin", response_model=TokenResponse)
async def login_pin(body: PINLoginRequest, db: DB):
    """Quick PIN login for POS terminals."""
    result = await db.execute(
        select(User).where(
            User.restaurant_id == body.restaurant_id,
            User.is_active == True,
            User.pin.is_not(None),
        )
    )
    users = result.scalars().all()
    matched = next((u for u in users if u.pin and verify_password(body.pin, u.pin)), None)
    if not matched:
        raise HTTPException(status_code=401, detail="Invalid PIN")

    access_token = create_access_token(matched.id, matched.restaurant_id, matched.role)
    raw_refresh = create_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(hours=4)  # Short-lived for POS

    rt = RefreshToken(user_id=matched.id, token_hash=hash_password(raw_refresh), expires_at=expires)
    db.add(rt)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        user={
            "id": matched.id,
            "email": matched.email,
            "first_name": matched.first_name,
            "last_name": matched.last_name,
            "role": matched.role,
            "restaurant_id": matched.restaurant_id,
        },
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, db: DB):
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.revoked == False)
    )
    tokens = result.scalars().all()
    matched_token = next((t for t in tokens if verify_password(body.refresh_token, t.token_hash)), None)

    if not matched_token or matched_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    result = await db.execute(select(User).where(User.id == matched_token.user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    matched_token.revoked = True

    access_token = create_access_token(user.id, user.restaurant_id, user.role)
    raw_refresh = create_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    new_rt = RefreshToken(user_id=user.id, token_hash=hash_password(raw_refresh), expires_at=expires)
    db.add(new_rt)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        user={
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "restaurant_id": user.restaurant_id,
        },
    )


@router.post("/logout")
async def logout(current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.user_id == current_user.id, RefreshToken.revoked == False)
    )
    tokens = result.scalars().all()
    for t in tokens:
        t.revoked = True
    await db.commit()
    return {"message": "Logged out"}


@router.get("/me")
async def me(current_user: CurrentUser):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "role": current_user.role,
        "restaurant_id": current_user.restaurant_id,
        "phone": current_user.phone,
    }
