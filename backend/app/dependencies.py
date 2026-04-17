from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt, JWTError
from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.restaurant import Restaurant

security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_current_restaurant(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Restaurant:
    if not current_user.restaurant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No restaurant associated")
    result = await db.execute(select(Restaurant).where(Restaurant.id == current_user.restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    return restaurant


def require_roles(*roles: str):
    async def _check(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not permitted. Required: {roles}",
            )
        return current_user
    return _check


# Convenience role guards
require_owner = require_roles("owner")
require_manager = require_roles("owner", "manager")
require_staff = require_roles("owner", "manager", "cashier", "waiter", "kitchen")

CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentRestaurant = Annotated[Restaurant, Depends(get_current_restaurant)]
DB = Annotated[AsyncSession, Depends(get_db)]
