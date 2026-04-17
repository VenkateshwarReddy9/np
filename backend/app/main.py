"""
Restaurant Operations Management System — FastAPI Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from jose import jwt, JWTError

from app.config import settings
from app.database import engine, Base
from app.websocket.manager import ws_manager

# Import all routers
from app.routers.auth import router as auth_router
from app.routers.menu import router as menu_router
from app.routers.orders import router as orders_router
from app.routers.tables import router as tables_router
from app.routers.reservations import router as reservations_router
from app.routers.kds import router as kds_router
from app.routers.inventory import router as inventory_router
from app.routers.staff import router as staff_router
from app.routers.customers import router as customers_router
from app.routers.analytics import router as analytics_router
from app.routers.accounting import router as accounting_router
from app.routers.online_ordering import router as online_ordering_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="Restaurant OS API",
    description="Full-stack restaurant operations management — the affordable alternative to Toast & Square",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API Routes ──────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(menu_router, prefix=API_PREFIX)
app.include_router(orders_router, prefix=API_PREFIX)
app.include_router(tables_router, prefix=API_PREFIX)
app.include_router(reservations_router, prefix=API_PREFIX)
app.include_router(kds_router, prefix=API_PREFIX)
app.include_router(inventory_router, prefix=API_PREFIX)
app.include_router(staff_router, prefix=API_PREFIX)
app.include_router(customers_router, prefix=API_PREFIX)
app.include_router(analytics_router, prefix=API_PREFIX)
app.include_router(accounting_router, prefix=API_PREFIX)
app.include_router(online_ordering_router, prefix=API_PREFIX)


# ─── WebSocket ───────────────────────────────────────────────────────────────
@app.websocket("/ws/{restaurant_id}")
async def websocket_endpoint(websocket: WebSocket, restaurant_id: str, token: str = Query(None)):
    # Validate JWT if provided
    if token:
        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            if payload.get("restaurant_id") != restaurant_id and payload.get("role") != "owner":
                await websocket.close(code=4001)
                return
        except JWTError:
            await websocket.close(code=4001)
            return

    await ws_manager.connect(restaurant_id, websocket)
    try:
        # Send welcome
        await ws_manager.send_to_socket(websocket, {
            "event": "connected",
            "data": {"restaurant_id": restaurant_id, "connections": ws_manager.active_connections_count},
        })
        while True:
            data = await websocket.receive_json()
            event = data.get("event")

            # Handle client → server events
            if event == "kds.ticket.start":
                await ws_manager.broadcast_to_restaurant(restaurant_id, {
                    "event": "kds.ticket.updated",
                    "data": {**data.get("data", {}), "status": "in_progress"},
                })
            elif event == "kds.ticket.bump":
                await ws_manager.broadcast_to_restaurant(restaurant_id, {
                    "event": "kds.order.bumped",
                    "data": data.get("data", {}),
                })
            elif event == "ping":
                await ws_manager.send_to_socket(websocket, {"event": "pong"})

    except WebSocketDisconnect:
        ws_manager.disconnect(restaurant_id, websocket)
    except Exception:
        ws_manager.disconnect(restaurant_id, websocket)


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "ws_connections": ws_manager.active_connections_count,
        "deployment_mode": settings.DEPLOYMENT_MODE,
    }


@app.get("/")
async def root():
    return {
        "name": "Restaurant OS API",
        "docs": "/docs",
        "health": "/health",
    }
