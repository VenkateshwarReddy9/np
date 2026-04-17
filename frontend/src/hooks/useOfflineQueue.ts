import Dexie, { Table } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import api from '@/api/client'

interface OfflineOrder {
  id: string
  restaurant_id: string
  order_type: string
  items: unknown[]
  subtotal: number
  tax_amount: number
  total: number
  notes?: string
  created_at: string
  synced: boolean
}

interface CachedMenu {
  id: string // restaurant_id
  data: unknown
  cached_at: number
}

class RestaurantDB extends Dexie {
  offlineOrders!: Table<OfflineOrder>
  menuCache!: Table<CachedMenu>

  constructor() {
    super('RestaurantOS')
    this.version(1).stores({
      offlineOrders: 'id, restaurant_id, synced, created_at',
      menuCache: 'id',
    })
  }
}

export const db = new RestaurantDB()

export function useOfflineQueue(restaurantId: string | null | undefined) {
  const pendingOrders = useLiveQuery(
    () => restaurantId ? db.offlineOrders.where({ restaurant_id: restaurantId, synced: 0 as any }).toArray() : [],
    [restaurantId],
  )

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

  useEffect(() => {
    if (!isOnline || !restaurantId) return
    const pending = pendingOrders ?? []
    if (pending.length === 0) return

    const sync = async () => {
      try {
        const { data } = await api.post('/orders/sync', { orders: pending })
        const syncedIds = data.results.filter((r: { status: string }) => r.status === 'synced').map((r: { offline_id: string }) => r.offline_id)
        await db.offlineOrders.where('id').anyOf(syncedIds).modify({ synced: true })
      } catch {
        // Will retry next time online
      }
    }
    sync()
  }, [isOnline, pendingOrders, restaurantId])

  const saveOfflineOrder = async (order: Omit<OfflineOrder, 'synced' | 'created_at'>) => {
    await db.offlineOrders.add({ ...order, synced: false, created_at: new Date().toISOString() })
  }

  const cacheMenu = async (restaurantId: string, menuData: unknown) => {
    await db.menuCache.put({ id: restaurantId, data: menuData, cached_at: Date.now() })
  }

  const getCachedMenu = async (restaurantId: string) => {
    return db.menuCache.get(restaurantId)
  }

  return { pendingOrders: pendingOrders ?? [], saveOfflineOrder, cacheMenu, getCachedMenu, isOnline }
}
