import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { ticketColorClass, elapsedMinutes } from '@/lib/utils'
import { CheckCheck, Clock, ChefHat, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KDSTicket {
  id: string
  order_id: string
  order_item_id: string
  station_id: string | null
  status: string
  priority: number
  displayed_at: string
  started_at: string | null
}

interface Station {
  id: string
  name: string
  color: string
}

function TicketCard({ ticket, onStart, onReady, onBump }: {
  ticket: KDSTicket & { order?: any; item?: any }
  onStart: (id: string) => void
  onReady: (id: string) => void
  onBump: (orderId: string) => void
}) {
  const [elapsed, setElapsed] = useState(elapsedMinutes(ticket.displayed_at))

  useEffect(() => {
    const interval = setInterval(() => setElapsed(elapsedMinutes(ticket.displayed_at)), 30000)
    return () => clearInterval(interval)
  }, [ticket.displayed_at])

  const colorClass = ticketColorClass(ticket.displayed_at)

  return (
    <div className={cn('bg-slate-800 rounded-xl border border-slate-700 overflow-hidden', colorClass)}>
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-lg">#{ticket.order_id.slice(-4).toUpperCase()}</span>
          {ticket.priority > 0 && <AlertTriangle className="h-4 w-4 text-red-400" />}
        </div>
        <div className="flex items-center gap-1.5 text-slate-300 text-sm">
          <Clock className="h-3.5 w-3.5" />
          <span className={cn(elapsed >= 10 ? 'text-red-400 font-bold' : elapsed >= 5 ? 'text-yellow-400' : 'text-green-400')}>{elapsed}m</span>
        </div>
      </div>

      <div className="p-4 space-y-2">
        <div className="text-white font-semibold">Table item order</div>
        <div className="text-slate-400 text-sm">Ticket ID: {ticket.id.slice(-8)}</div>
        {ticket.status === 'waiting' && (
          <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full">
            Waiting
          </span>
        )}
        {ticket.status === 'in_progress' && (
          <span className="inline-flex items-center gap-1 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
            <ChefHat className="h-3 w-3" /> Cooking
          </span>
        )}
      </div>

      <div className="px-4 pb-4 flex gap-2">
        {ticket.status === 'waiting' && (
          <button onClick={() => onStart(ticket.id)} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            Start
          </button>
        )}
        {ticket.status === 'in_progress' && (
          <button onClick={() => onReady(ticket.id)} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
            Ready ✓
          </button>
        )}
        <button onClick={() => onBump(ticket.order_id)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors">
          <CheckCheck className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function KDSPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const { on, send } = useWebSocket(user?.restaurant_id)
  const [selectedStation, setSelectedStation] = useState<string | null>(null)
  const [ticks, setTicks] = useState(0)

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => setTicks((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  // Listen for new orders
  useEffect(() => {
    const off = on('order.created', () => {
      qc.invalidateQueries({ queryKey: ['kds-tickets'] })
    })
    const off2 = on('kds.ticket.updated', () => {
      qc.invalidateQueries({ queryKey: ['kds-tickets'] })
    })
    return () => { off(); off2() }
  }, [on, qc])

  const { data: stations = [] } = useQuery<Station[]>({
    queryKey: ['kds-stations'],
    queryFn: () => api.get('/kds/stations').then((r) => r.data),
  })

  const { data: tickets = [] } = useQuery<KDSTicket[]>({
    queryKey: ['kds-tickets', selectedStation, ticks],
    queryFn: () => {
      const params = new URLSearchParams()
      if (selectedStation) params.set('station_id', selectedStation)
      return api.get(`/kds/tickets?${params}`).then((r) => r.data)
    },
    refetchInterval: 15000,
  })

  const { mutate: updateTicket } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/kds/tickets/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds-tickets'] }),
  })

  const { mutate: bumpOrder } = useMutation({
    mutationFn: (orderId: string) => api.post(`/kds/orders/${orderId}/bump`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kds-tickets'] })
      send('kds.ticket.bump', {})
    },
  })

  const waitingTickets = tickets.filter((t) => t.status === 'waiting')
  const inProgressTickets = tickets.filter((t) => t.status === 'in_progress')

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat className="h-7 w-7 text-blue-400" />
          <h1 className="text-xl font-bold">Kitchen Display</h1>
          <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
            {waitingTickets.length} waiting
          </span>
          <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
            {inProgressTickets.length} cooking
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedStation(null)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', !selectedStation ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600')}
          >
            All
          </button>
          {stations.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStation(s.id)}
              style={{ borderColor: selectedStation === s.id ? s.color : undefined }}
              className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors border-2', selectedStation === s.id ? 'text-white' : 'border-transparent bg-slate-700 hover:bg-slate-600')}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket columns */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-2 gap-6">
          {/* Waiting column */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Waiting ({waitingTickets.length})
            </h2>
            <div className="space-y-4">
              {waitingTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onStart={(id) => updateTicket({ id, status: 'in_progress' })}
                  onReady={(id) => updateTicket({ id, status: 'ready' })}
                  onBump={bumpOrder}
                />
              ))}
              {waitingTickets.length === 0 && (
                <div className="text-slate-500 text-center py-12 border border-dashed border-slate-700 rounded-xl">
                  No tickets waiting
                </div>
              )}
            </div>
          </div>

          {/* In Progress column */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Cooking ({inProgressTickets.length})
            </h2>
            <div className="space-y-4">
              {inProgressTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onStart={(id) => updateTicket({ id, status: 'in_progress' })}
                  onReady={(id) => updateTicket({ id, status: 'ready' })}
                  onBump={bumpOrder}
                />
              ))}
              {inProgressTickets.length === 0 && (
                <div className="text-slate-500 text-center py-12 border border-dashed border-slate-700 rounded-xl">
                  No orders cooking
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
