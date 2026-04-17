import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Plus, Calendar, Users, Phone, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Reservation {
  id: string
  customer_name?: string
  customer_id?: string
  table_id?: string | null
  party_size: number
  date: string
  time_slot: string
  duration_min: number
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show'
  notes?: string
  confirmation_code: string
  phone?: string
}

interface WaitlistEntry {
  id: string
  customer_name: string
  party_size: number
  phone: string
  notes?: string
  added_at: string
  estimated_wait_min: number
  seated_at?: string | null
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  confirmed: { label: 'Confirmed', icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
  seated: { label: 'Seated', icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-gray-600', bg: 'bg-gray-50' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  no_show: { label: 'No Show', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
}

function ReservationCard({ res, onAction }: { res: Reservation; onAction: (id: string, action: string) => void }) {
  const cfg = STATUS_CONFIG[res.status]
  const Icon = cfg.icon
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{res.customer_name || 'Walk-in'}</h3>
            <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', cfg.bg, cfg.color)}>
              <Icon className="h-3 w-3" />
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(res.date)}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{res.time_slot}</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{res.party_size} guests</span>
          </div>
          {res.phone && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />{res.phone}
            </div>
          )}
          {res.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{res.notes}</p>}
          <p className="text-xs text-muted-foreground mt-1">Code: {res.confirmation_code}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          {res.status === 'pending' && (
            <button onClick={() => onAction(res.id, 'confirm')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium">Confirm</button>
          )}
          {(res.status === 'pending' || res.status === 'confirmed') && (
            <>
              <button onClick={() => onAction(res.id, 'seat')} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium">Seat</button>
              <button onClick={() => onAction(res.id, 'no-show')} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium">No Show</button>
              <button onClick={() => onAction(res.id, 'cancel')} className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-xs font-medium">Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AddReservationModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    party_size: 2,
    date: new Date().toISOString().split('T')[0],
    time_slot: '19:00',
    duration_min: 90,
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/reservations', form)
      toast.success('Reservation created')
      onSaved()
    } catch {
      toast.error('Failed to create reservation')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-5">New Reservation</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Guest Name</label>
              <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Party Size</label>
              <input type="number" min={1} value={form.party_size} onChange={(e) => setForm({ ...form, party_size: parseInt(e.target.value) })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Time</label>
              <input type="time" value={form.time_slot} onChange={(e) => setForm({ ...form, time_slot: e.target.value })} required
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Duration (min)</label>
              <select value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: parseInt(e.target.value) })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                {[60, 90, 120, 150, 180].map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Allergies, occasion, special requests..." />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {loading ? 'Saving...' : 'Create Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddWaitlistModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ customer_name: '', party_size: 2, phone: '', estimated_wait_min: 20, notes: '' })
  const [loading, setLoading] = useState(false)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/waitlist', form)
      toast.success('Added to waitlist')
      onSaved()
    } catch {
      toast.error('Failed to add to waitlist')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-xl font-bold mb-5">Add to Waitlist</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name</label>
            <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Party Size</label>
              <input type="number" min={1} value={form.party_size} onChange={(e) => setForm({ ...form, party_size: parseInt(e.target.value) })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Est. Wait (min)</label>
              <input type="number" min={5} value={form.estimated_wait_min} onChange={(e) => setForm({ ...form, estimated_wait_min: parseInt(e.target.value) })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {loading ? 'Adding...' : 'Add to List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ReservationsPage() {
  const qc = useQueryClient()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showAddRes, setShowAddRes] = useState(false)
  const [showAddWaitlist, setShowAddWaitlist] = useState(false)

  const { data: reservations = [] } = useQuery<Reservation[]>({
    queryKey: ['reservations', date],
    queryFn: () => api.get(`/reservations?date=${date}`).then((r) => r.data),
    refetchInterval: 60000,
  })

  const { data: waitlist = [] } = useQuery<WaitlistEntry[]>({
    queryKey: ['waitlist'],
    queryFn: () => api.get('/waitlist').then((r) => r.data),
    refetchInterval: 30000,
  })

  const { mutate: doAction } = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => {
      if (action === 'confirm') return api.patch(`/reservations/${id}`, { status: 'confirmed' })
      if (action === 'seat') return api.post(`/reservations/${id}/seat`)
      if (action === 'no-show') return api.post(`/reservations/${id}/no-show`)
      return api.patch(`/reservations/${id}`, { status: 'cancelled' })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
      toast.success('Reservation updated')
    },
    onError: () => toast.error('Failed to update reservation'),
  })

  const { mutate: seatWaitlist } = useMutation({
    mutationFn: (id: string) => api.post(`/waitlist/${id}/seat`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waitlist'] })
      toast.success('Guest seated')
    },
  })

  const { mutate: removeWaitlist } = useMutation({
    mutationFn: (id: string) => api.delete(`/waitlist/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['waitlist'] }),
  })

  const filtered = statusFilter === 'all' ? reservations : reservations.filter((r) => r.status === statusFilter)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main reservations panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold shrink-0">Reservations</h1>
          <div className="flex items-center gap-3 flex-1 justify-end flex-wrap">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button
              onClick={() => setShowAddRes(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> Reservation
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filtered.map((res) => (
            <ReservationCard key={res.id} res={res} onAction={(id, action) => doAction({ id, action })} />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-lg">No reservations for {formatDate(date)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Waitlist sidebar */}
      <div className="w-72 border-l flex flex-col bg-card">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Waitlist
            {waitlist.filter((w) => !w.seated_at).length > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {waitlist.filter((w) => !w.seated_at).length}
              </span>
            )}
          </h2>
          <button onClick={() => setShowAddWaitlist(true)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {waitlist.filter((w) => !w.seated_at).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No guests waiting</div>
          ) : (
            waitlist.filter((w) => !w.seated_at).map((entry) => (
              <div key={entry.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{entry.customer_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{entry.party_size}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{entry.estimated_wait_min}m wait</span>
                    </div>
                    {entry.phone && <p className="text-xs text-muted-foreground mt-0.5">{entry.phone}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => seatWaitlist(entry.id)} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg">Seat</button>
                    <button onClick={() => removeWaitlist(entry.id)} className="px-2 py-1 bg-muted hover:bg-muted/80 text-xs rounded-lg">Remove</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showAddRes && <AddReservationModal onClose={() => setShowAddRes(false)} onSaved={() => { setShowAddRes(false); qc.invalidateQueries({ queryKey: ['reservations'] }) }} />}
      {showAddWaitlist && <AddWaitlistModal onClose={() => setShowAddWaitlist(false)} onSaved={() => { setShowAddWaitlist(false); qc.invalidateQueries({ queryKey: ['waitlist'] }) }} />}
    </div>
  )
}
