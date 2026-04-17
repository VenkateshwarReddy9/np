import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ShoppingBag, Clock, CheckCircle, XCircle, Truck, Globe, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface OnlineOrder {
  id: string
  order_number: string
  source: 'online' | 'doordash' | 'ubereats' | 'grubhub'
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'completed' | 'cancelled'
  total: number
  items: { name: string; quantity: number; unit_price: number }[]
  notes?: string
  created_at: string
}

const SOURCE_CONFIG = {
  online: { label: 'Direct Online', color: 'text-blue-600', bg: 'bg-blue-50', icon: Globe },
  doordash: { label: 'DoorDash', color: 'text-red-600', bg: 'bg-red-50', icon: Truck },
  ubereats: { label: 'Uber Eats', color: 'text-green-600', bg: 'bg-green-50', icon: Truck },
  grubhub: { label: 'Grubhub', color: 'text-orange-600', bg: 'bg-orange-50', icon: Truck },
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50', next: 'confirmed' },
  confirmed: { label: 'Confirmed', color: 'text-blue-600', bg: 'bg-blue-50', next: 'preparing' },
  preparing: { label: 'Preparing', color: 'text-purple-600', bg: 'bg-purple-50', next: 'ready' },
  ready: { label: 'Ready', color: 'text-green-600', bg: 'bg-green-50', next: 'picked_up' },
  picked_up: { label: 'Picked Up', color: 'text-gray-600', bg: 'bg-gray-100', next: 'completed' },
  completed: { label: 'Completed', color: 'text-gray-600', bg: 'bg-gray-100', next: null },
  cancelled: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-50', next: null },
}

function OrderCard({ order, onAdvance, onCancel }: {
  order: OnlineOrder
  onAdvance: (id: string, status: string) => void
  onCancel: (id: string) => void
}) {
  const src = SOURCE_CONFIG[order.source] || SOURCE_CONFIG.online
  const sts = STATUS_CONFIG[order.status]
  const SrcIcon = src.icon
  const minutesAgo = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold">#{order.order_number}</span>
            <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', src.bg, src.color)}>
              <SrcIcon className="h-3 w-3" />{src.label}
            </span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', sts.bg, sts.color)}>{sts.label}</span>
          </div>
          {order.customer_name && <p className="text-sm text-muted-foreground mt-0.5">{order.customer_name}</p>}
          <p className="text-xs text-muted-foreground">{minutesAgo}m ago · {new Date(order.created_at).toLocaleTimeString()}</p>
        </div>
        <span className="font-bold text-lg">{formatCurrency(order.total)}</span>
      </div>

      <div className="space-y-1 mb-3">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{item.quantity}× {item.name}</span>
            <span>{formatCurrency(item.unit_price * item.quantity)}</span>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-700 mb-3">
          Note: {order.notes}
        </div>
      )}

      <div className="flex gap-2">
        {sts.next && (
          <button onClick={() => onAdvance(order.id, sts.next!)}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            Mark {STATUS_CONFIG[sts.next as keyof typeof STATUS_CONFIG]?.label}
          </button>
        )}
        {order.status !== 'completed' && order.status !== 'cancelled' && (
          <button onClick={() => onCancel(order.id)}
            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm rounded-lg transition-colors">
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function OnlineOrderingPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [sourceFilter, setSourceFilter] = useState<string>('all')

  const { data: orders = [], isLoading } = useQuery<OnlineOrder[]>({
    queryKey: ['online-orders', statusFilter, sourceFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFilter === 'active') {
        params.set('exclude_status', 'completed,cancelled')
      } else if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      if (sourceFilter !== 'all') params.set('source', sourceFilter)
      return api.get(`/orders?order_type=online&${params}`).then((r) => r.data)
    },
    refetchInterval: 15000,
  })

  const { mutate: advanceOrder } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['online-orders'] }); toast.success('Order updated') },
    onError: () => toast.error('Failed to update order'),
  })

  const { mutate: cancelOrder } = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['online-orders'] }); toast.success('Order cancelled') },
    onError: () => toast.error('Failed to cancel order'),
  })

  const pending = orders.filter((o) => o.status === 'pending')
  const inProgress = orders.filter((o) => ['confirmed', 'preparing'].includes(o.status))
  const ready = orders.filter((o) => o.status === 'ready')

  const stats = {
    today_count: orders.length,
    today_revenue: orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0),
    pending: pending.length,
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Online Orders</h1>
            <p className="text-sm text-muted-foreground">
              {stats.today_count} orders · {formatCurrency(stats.today_revenue)} revenue
              {stats.pending > 0 && <span className="text-amber-600 font-medium"> · {stats.pending} pending action</span>}
            </p>
          </div>
          <button onClick={() => qc.invalidateQueries({ queryKey: ['online-orders'] })}
            className="p-2 border rounded-xl hover:bg-muted transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1">
            {[
              { key: 'active', label: 'Active' },
              { key: 'all', label: 'All' },
              { key: 'completed', label: 'Completed' },
              { key: 'cancelled', label: 'Cancelled' },
            ].map((f) => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', statusFilter === f.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                {f.label}
              </button>
            ))}
          </div>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-1.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Sources</option>
            <option value="online">Direct Online</option>
            <option value="doordash">DoorDash</option>
            <option value="ubereats">Uber Eats</option>
            <option value="grubhub">Grubhub</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {statusFilter === 'active' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((o) => (
                  <OrderCard key={o.id} order={o}
                    onAdvance={(id, status) => advanceOrder({ id, status })}
                    onCancel={cancelOrder} />
                ))}
                {pending.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-xl">No pending orders</div>}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                In Progress ({inProgress.length})
              </h2>
              <div className="space-y-3">
                {inProgress.map((o) => (
                  <OrderCard key={o.id} order={o}
                    onAdvance={(id, status) => advanceOrder({ id, status })}
                    onCancel={cancelOrder} />
                ))}
                {inProgress.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-xl">None in progress</div>}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-green-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Ready ({ready.length})
              </h2>
              <div className="space-y-3">
                {ready.map((o) => (
                  <OrderCard key={o.id} order={o}
                    onAdvance={(id, status) => advanceOrder({ id, status })}
                    onCancel={cancelOrder} />
                ))}
                {ready.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-xl">None ready</div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-16 text-muted-foreground">Loading orders...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No orders found</p>
              </div>
            ) : (
              orders.map((o) => (
                <OrderCard key={o.id} order={o}
                  onAdvance={(id, status) => advanceOrder({ id, status })}
                  onCancel={cancelOrder} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
