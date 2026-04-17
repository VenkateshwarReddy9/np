import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Plus, Star, Mail, Phone, Gift, Megaphone, Search } from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'customers' | 'loyalty' | 'campaigns' | 'feedback'

interface Customer {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  loyalty_points: number
  total_visits: number
  total_spent: number
  last_visit_at?: string
  birthday?: string
  dietary_restrictions?: string
  source?: string
}

interface Campaign {
  id: string
  name: string
  type: 'email' | 'sms' | 'push'
  status: 'draft' | 'scheduled' | 'sent' | 'failed'
  sent_count: number
  open_count: number
  send_at?: string
}

interface Feedback {
  id: string
  customer_id?: string
  customer_name?: string
  rating: number
  comment?: string
  created_at: string
  responded_at?: string
}

function CustomerDetailModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const qc = useQueryClient()
  const { mutate: addPoints } = useMutation({
    mutationFn: ({ points, description }: { points: number; description: string }) =>
      api.post(`/customers/${customer.id}/loyalty/add`, { points, description }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Points added') },
    onError: () => toast.error('Failed to add points'),
  })
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">{customer.first_name} {customer.last_name}</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{customer.loyalty_points}</p>
            <p className="text-xs text-muted-foreground">Loyalty Points</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{customer.total_visits}</p>
            <p className="text-xs text-muted-foreground">Total Visits</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center col-span-2">
            <p className="text-2xl font-bold text-purple-600">{formatCurrency(customer.total_spent)}</p>
            <p className="text-xs text-muted-foreground">Lifetime Spend</p>
          </div>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground mb-6">
          {customer.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{customer.email}</p>}
          {customer.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{customer.phone}</p>}
          {customer.birthday && <p className="flex items-center gap-2"><Gift className="h-4 w-4" />Birthday: {formatDate(customer.birthday)}</p>}
          {customer.last_visit_at && <p>Last visit: {formatDate(customer.last_visit_at)}</p>}
          {customer.dietary_restrictions && <p>Diet: {customer.dietary_restrictions}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => addPoints({ points: 50, description: 'Manual bonus' })}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
            +50 Points
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">Close</button>
        </div>
      </div>
    </div>
  )
}

function AddCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', birthday: '', dietary_restrictions: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/customers', form)
      toast.success('Customer added')
      onSaved()
    } catch {
      toast.error('Failed to add customer')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-5">Add Customer</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">First Name</label>
              <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Last Name</label>
              <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Birthday</label>
              <input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Dietary Restrictions</label>
              <input value={form.dietary_restrictions} onChange={(e) => setForm({ ...form, dietary_restrictions: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Gluten-free, vegan..." />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {loading ? 'Saving...' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CreateCampaignModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', type: 'email' as const, subject: '', message: '', send_at: '' })
  const [loading, setLoading] = useState(false)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/marketing/campaigns', form)
      toast.success('Campaign created')
      onSaved()
    } catch {
      toast.error('Failed to create campaign')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <h2 className="text-xl font-bold mb-5">Create Campaign</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Campaign Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Send At</label>
              <input type="datetime-local" value={form.send_at} onChange={(e) => setForm({ ...form, send_at: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {form.type === 'email' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Subject</label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">Message</label>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required rows={4}
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {loading ? 'Saving...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CustomersPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('customers')
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showAddCampaign, setShowAddCampaign] = useState(false)

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers').then((r) => r.data),
  })

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/marketing/campaigns').then((r) => r.data),
    enabled: tab === 'campaigns',
  })

  const { data: feedback = [] } = useQuery<Feedback[]>({
    queryKey: ['feedback'],
    queryFn: () => api.get('/feedback').then((r) => r.data),
    enabled: tab === 'feedback',
  })

  const { mutate: sendCampaign } = useMutation({
    mutationFn: (id: string) => api.post(`/marketing/campaigns/${id}/send`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Campaign sent!') },
    onError: () => toast.error('Failed to send campaign'),
  })

  const filtered = customers.filter((c) => {
    if (!search) return true
    const name = `${c.first_name} ${c.last_name}`.toLowerCase()
    return name.includes(search.toLowerCase()) || c.email?.includes(search) || c.phone?.includes(search)
  })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'customers', label: 'Customers' },
    { key: 'loyalty', label: 'Loyalty' },
    { key: 'campaigns', label: 'Campaigns' },
    { key: 'feedback', label: 'Feedback' },
  ]

  const loyaltyTiers = [
    { name: 'Bronze', min: 0, max: 499, color: 'text-amber-700', bg: 'bg-amber-50' },
    { name: 'Silver', min: 500, max: 999, color: 'text-gray-600', bg: 'bg-gray-100' },
    { name: 'Gold', min: 1000, max: 1999, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { name: 'Platinum', min: 2000, max: Infinity, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Customer CRM</h1>
            <p className="text-sm text-muted-foreground">{customers.length} customers</p>
          </div>
          <div className="flex gap-2">
            {tab === 'campaigns' && (
              <button onClick={() => setShowAddCampaign(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
                <Plus className="h-4 w-4" /> Campaign
              </button>
            )}
            {tab === 'customers' && (
              <button onClick={() => setShowAddCustomer(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
                <Plus className="h-4 w-4" /> Add Customer
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', tab === t.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'customers' && (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..."
                className="w-full max-w-sm pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Contact</th>
                    <th className="pb-3 font-medium">Points</th>
                    <th className="pb-3 font-medium">Visits</th>
                    <th className="pb-3 font-medium">Total Spent</th>
                    <th className="pb-3 font-medium">Last Visit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((c) => {
                    const tier = loyaltyTiers.find((t) => c.loyalty_points >= t.min && c.loyalty_points <= t.max)
                    return (
                      <tr key={c.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedCustomer(c)}>
                        <td className="py-3">
                          <p className="font-medium">{c.first_name} {c.last_name}</p>
                          {tier && <span className={cn('text-xs px-1.5 py-0.5 rounded', tier.bg, tier.color)}>{tier.name}</span>}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {c.email && <div className="flex items-center gap-1 text-xs"><Mail className="h-3 w-3" />{c.email}</div>}
                          {c.phone && <div className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{c.phone}</div>}
                        </td>
                        <td className="py-3">
                          <span className="flex items-center gap-1 font-medium text-amber-600">
                            <Star className="h-3.5 w-3.5" />{c.loyalty_points}
                          </span>
                        </td>
                        <td className="py-3">{c.total_visits}</td>
                        <td className="py-3 font-medium">{formatCurrency(c.total_spent)}</td>
                        <td className="py-3 text-muted-foreground text-xs">{c.last_visit_at ? formatDate(c.last_visit_at) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">No customers found</div>
              )}
            </div>
          </>
        )}

        {tab === 'loyalty' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {loyaltyTiers.map((tier) => {
                const count = customers.filter((c) => c.loyalty_points >= tier.min && c.loyalty_points <= tier.max).length
                return (
                  <div key={tier.name} className={cn('rounded-xl p-4 text-center', tier.bg)}>
                    <p className={cn('text-2xl font-bold', tier.color)}>{count}</p>
                    <p className="text-sm font-medium mt-1">{tier.name}</p>
                    <p className="text-xs text-muted-foreground">{tier.min}–{tier.max === Infinity ? '∞' : tier.max} pts</p>
                  </div>
                )
              })}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Tier</th>
                    <th className="pb-3 font-medium">Points</th>
                    <th className="pb-3 font-medium">Value (~{formatCurrency(0.01)}/pt)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...customers].sort((a, b) => b.loyalty_points - a.loyalty_points).slice(0, 20).map((c) => {
                    const tier = loyaltyTiers.find((t) => c.loyalty_points >= t.min && c.loyalty_points <= t.max)
                    return (
                      <tr key={c.id}>
                        <td className="py-3 font-medium">{c.first_name} {c.last_name}</td>
                        <td className="py-3"><span className={cn('text-xs px-2 py-0.5 rounded-full', tier?.bg, tier?.color)}>{tier?.name}</span></td>
                        <td className="py-3"><span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" />{c.loyalty_points}</span></td>
                        <td className="py-3">{formatCurrency(c.loyalty_points * 0.01)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'campaigns' && (
          <div className="space-y-4">
            {campaigns.map((camp) => {
              const statusColor = { draft: 'text-gray-600 bg-gray-50', scheduled: 'text-blue-600 bg-blue-50', sent: 'text-green-600 bg-green-50', failed: 'text-red-600 bg-red-50' }[camp.status]
              const openRate = camp.sent_count > 0 ? Math.round((camp.open_count / camp.sent_count) * 100) : 0
              return (
                <div key={camp.id} className="bg-card border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Megaphone className="h-4 w-4 text-muted-foreground" />
                        <p className="font-semibold">{camp.name}</p>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', statusColor)}>{camp.status}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted uppercase font-medium">{camp.type}</span>
                      </div>
                      {camp.send_at && <p className="text-xs text-muted-foreground mt-1">Scheduled: {new Date(camp.send_at).toLocaleString()}</p>}
                      {camp.status === 'sent' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Sent to {camp.sent_count} · {openRate}% open rate
                        </p>
                      )}
                    </div>
                    {camp.status === 'draft' && (
                      <button onClick={() => sendCampaign(camp.id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shrink-0">
                        Send Now
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {campaigns.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No campaigns yet</p>
              </div>
            )}
          </div>
        )}

        {tab === 'feedback' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-6">
              {[5, 4, 3, 2, 1].map((r) => {
                const count = feedback.filter((f) => f.rating === r).length
                return (
                  <div key={r} className="flex items-center gap-1.5">
                    <div className="flex">{Array.from({ length: r }, (_, i) => <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}</div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                )
              })}
            </div>
            {feedback.map((fb) => (
              <div key={fb.id} className="bg-card border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex">{Array.from({ length: fb.rating }, (_, i) => <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}</div>
                      <span className="text-xs text-muted-foreground">{fb.customer_name || 'Anonymous'}</span>
                    </div>
                    {fb.comment && <p className="text-sm text-muted-foreground">{fb.comment}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">{formatDate(fb.created_at)}</p>
                </div>
              </div>
            ))}
            {feedback.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Star className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No feedback yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedCustomer && <CustomerDetailModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />}
      {showAddCustomer && <AddCustomerModal onClose={() => setShowAddCustomer(false)} onSaved={() => { setShowAddCustomer(false); qc.invalidateQueries({ queryKey: ['customers'] }) }} />}
      {showAddCampaign && <CreateCampaignModal onClose={() => setShowAddCampaign(false)} onSaved={() => { setShowAddCampaign(false); qc.invalidateQueries({ queryKey: ['campaigns'] }) }} />}
    </div>
  )
}
