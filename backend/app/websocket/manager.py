"""
WebSocket connection manager.
Rooms are per-restaurant — all connected clients in a restaurant receive broadcasts.
"""
import json
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # restaurant_id -> list of WebSocket connections
        self._connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, restaurant_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(restaurant_id, []).append(websocket)

    def disconnect(self, restaurant_id: str, websocket: WebSocket) -> None:
        if restaurant_id in self._connections:
            try:
                self._connections[restaurant_id].remove(websocket)
            except ValueError:
                pass
            if not self._connections[restaurant_id]:
                del self._connections[restaurant_id]

    async def broadcast_to_restaurant(self, restaurant_id: str, message: dict) -> None:
        if restaurant_id not in self._connections:
            return
        dead = []
        payload = json.dumps(message)
        for ws in self._connections[restaurant_id]:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(restaurant_id, ws)

    async def send_to_socket(self, websocket: WebSocket, message: dict) -> None:
        try:
            await websocket.send_text(json.dumps(message))
        except Exception:
            pass

    @property
    def active_connections_count(self) -> int:
        return sum(len(v) for v in self._connections.values())


ws_manager = ConnectionManager()
