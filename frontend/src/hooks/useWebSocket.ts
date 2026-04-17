import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'

type WSMessage = { event: string; data: unknown }
type Handler = (data: unknown) => void

export function useWebSocket(restaurantId: string | null | undefined) {
  const ws = useRef<WebSocket | null>(null)
  const handlers = useRef<Map<string, Handler[]>>(new Map())
  const { access_token } = useAuthStore()

  const connect = useCallback(() => {
    if (!restaurantId || !access_token) return
    const wsBase = import.meta.env.VITE_WS_URL || `ws://${window.location.host}`
    ws.current = new WebSocket(`${wsBase}/ws/${restaurantId}?token=${access_token}`)

    ws.current.onmessage = (e) => {
      try {
        const msg: WSMessage = JSON.parse(e.data)
        const eventHandlers = handlers.current.get(msg.event) || []
        eventHandlers.forEach((h) => h(msg.data))
        // Wildcard handlers
        const wildcards = handlers.current.get('*') || []
        wildcards.forEach((h) => h(msg))
      } catch {
        // ignore parse errors
      }
    }

    ws.current.onclose = () => {
      setTimeout(connect, 3000) // reconnect
    }
  }, [restaurantId, access_token])

  useEffect(() => {
    connect()
    return () => {
      ws.current?.close()
    }
  }, [connect])

  const on = useCallback((event: string, handler: Handler) => {
    const existing = handlers.current.get(event) || []
    handlers.current.set(event, [...existing, handler])
    return () => {
      const filtered = (handlers.current.get(event) || []).filter((h) => h !== handler)
      handlers.current.set(event, filtered)
    }
  }, [])

  const send = useCallback((event: string, data: unknown = {}) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ event, data }))
    }
  }, [])

  return { on, send }
}
