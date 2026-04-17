import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Plus, DollarSign, TrendingUp, TrendingDown, FileText, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'pl' | 'expenses' | 'invoices' | 'accounts'

interface Expense {
  id: string
  category: string
  amount: number
  description: string
  date: string
  vendor?: string
  status: 'pending' | 'approved' | 'paid' | 'rejected'
}

interface Invoice {
  id: string
  invoice_number: string
  amount: number
  due_date: string
  status: 'unpaid' | 'partial' | 'paid' | 'overdue'
  paid_amount: number
  vendor_name?: string
}

interface Account {
  id: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  code: string
  is_active: boolean
}

interface PLReport {
  period: string
  revenue: number
  cogs: number
  gross_profit: number
  gross_margin: number
  operating_expenses: number
  ebitda: number
  net_income: number
  net_margin: number
  by_category: { category: string; amount: number }[]
}

function AddExpenseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ category: 'food_supplies', amount: 0, description: '', date: new Date().toISOString().split('T')[0], vendor: '' })
  const [loading, setLoading] = useState(false)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/accounting/expenses', form)
      toast.success('Expense logged')
      onSaved()
    } catch {
      toast.error('Failed to log expense')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-xl font-bold mb-5">Log Expense</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['food_supplies', 'beverages', 'labor', 'utilities', 'rent', 'equipment', 'marketing', 'repairs', 'insurance', 'other'].map((c) => (
                <option key={c} value={c} className="capitalize">{c.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Amount ($)</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })} required
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Vendor</label>
            <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {loading ? 'Saving...' : 'Log Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AccountingPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('pl')
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [plPeriod, setPlPeriod] = useState<'month' | 'quarter' | 'year'>('month')

  const { data: pl } = useQuery<PLReport>({
    queryKey: ['pl-report', plPeriod],
    queryFn: () => api.get(`/accounting/pl-report?period=${plPeriod}`).then((r) => r.data),
    enabled: tab === 'pl',
  })

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: () => api.get('/accounting/expenses').then((r) => r.data),
    enabled: tab === 'expenses',
  })

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => api.get('/accounting/invoices').then((r) => r.data),
    enabled: tab === 'invoices',
  })

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounting/accounts').then((r) => r.data),
    enabled: tab === 'accounts',
  })

  const { mutate: approveExpense } = useMutation({
    mutationFn: (id: string) => api.patch(`/accounting/expenses/${id}`, { status: 'approved' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense approved') },
  })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pl', label: 'P&L Report' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'accounts', label: 'Chart of Accounts' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Accounting</h1>
          <div className="flex gap-2">
            {tab === 'expenses' && (
              <button onClick={() => setShowAddExpense(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
                <Plus className="h-4 w-4" /> Log Expense
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
        {tab === 'pl' && pl && (
          <div className="max-w-2xl space-y-6">
            <div className="flex items-center gap-3">
              <select value={plPeriod} onChange={(e) => setPlPeriod(e.target.value as any)}
                className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
              </select>
              <span className="text-sm text-muted-foreground">{pl.period}</span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(pl.revenue)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground">Gross Profit</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(pl.gross_profit)}</p>
                <p className="text-xs text-muted-foreground">{pl.gross_margin.toFixed(1)}% margin</p>
              </div>
              <div className={cn('rounded-xl p-4 text-center border', pl.net_income >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100')}>
                <p className="text-xs text-muted-foreground">Net Income</p>
                <p className={cn('text-2xl font-bold', pl.net_income >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(pl.net_income)}</p>
                <p className="text-xs text-muted-foreground">{pl.net_margin.toFixed(1)}% margin</p>
              </div>
            </div>

            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="p-4 bg-muted/30 border-b flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="font-semibold">Income Statement</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="px-4 py-3 text-muted-foreground">Revenue</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(pl.revenue)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-3 text-muted-foreground pl-8">Cost of Goods Sold</td>
                    <td className="px-4 py-3 text-right text-red-500">({formatCurrency(pl.cogs)})</td>
                  </tr>
                  <tr className="border-b bg-muted/20">
                    <td className="px-4 py-3 font-semibold">Gross Profit</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(pl.gross_profit)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-3 text-muted-foreground pl-8">Operating Expenses</td>
                    <td className="px-4 py-3 text-right text-red-500">({formatCurrency(pl.operating_expenses)})</td>
                  </tr>
                  <tr className="border-b bg-muted/20">
                    <td className="px-4 py-3 font-semibold">EBITDA</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(pl.ebitda)}</td>
                  </tr>
                  <tr className="bg-primary/5">
                    <td className="px-4 py-3 font-bold">Net Income</td>
                    <td className={cn('px-4 py-3 text-right font-bold text-lg', pl.net_income >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(pl.net_income)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {pl.by_category?.length > 0 && (
              <div className="bg-card border rounded-xl p-5">
                <h3 className="font-semibold mb-4">Expenses by Category</h3>
                <div className="space-y-3">
                  {pl.by_category.map((cat) => (
                    <div key={cat.category} className="flex items-center gap-3">
                      <span className="text-sm capitalize text-muted-foreground w-32 shrink-0">{cat.category.replace('_', ' ')}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${pl.operating_expenses > 0 ? (cat.amount / pl.operating_expenses) * 100 : 0}%` }} />
                      </div>
                      <span className="text-sm font-medium text-right w-24">{formatCurrency(cat.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'pl' && !pl && (
          <div className="text-center py-16 text-muted-foreground">Loading P&L report...</div>
        )}

        {tab === 'expenses' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {(['pending', 'approved', 'paid', 'rejected'] as const).map((s) => {
                const count = expenses.filter((e) => e.status === s).length
                const total = expenses.filter((e) => e.status === s).reduce((sum, e) => sum + e.amount, 0)
                const colors = { pending: 'text-amber-600 bg-amber-50', approved: 'text-blue-600 bg-blue-50', paid: 'text-green-600 bg-green-50', rejected: 'text-red-600 bg-red-50' }
                return (
                  <div key={s} className={cn('rounded-xl p-4', colors[s])}>
                    <p className="text-xs font-medium uppercase tracking-wider capitalize">{s}</p>
                    <p className="text-2xl font-bold mt-1">{count}</p>
                    <p className="text-xs mt-0.5">{formatCurrency(total)}</p>
                  </div>
                )
              })}
            </div>
            {expenses.map((exp) => {
              const statusColor = { pending: 'text-amber-600 bg-amber-50', approved: 'text-blue-600 bg-blue-50', paid: 'text-green-600 bg-green-50', rejected: 'text-red-600 bg-red-50' }[exp.status]
              return (
                <div key={exp.id} className="bg-card border rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{exp.description}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', statusColor)}>{exp.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground capitalize">{exp.category.replace('_', ' ')} {exp.vendor ? `· ${exp.vendor}` : ''}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(exp.date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-red-600">{formatCurrency(exp.amount)}</span>
                    {exp.status === 'pending' && (
                      <button onClick={() => approveExpense(exp.id)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {expenses.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No expenses yet</p>
              </div>
            )}
          </div>
        )}

        {tab === 'invoices' && (
          <div className="space-y-3">
            {invoices.map((inv) => {
              const isOverdue = inv.status === 'unpaid' && new Date(inv.due_date) < new Date()
              const statusLabel = isOverdue ? 'Overdue' : inv.status
              const statusColor = { unpaid: isOverdue ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50', partial: 'text-blue-600 bg-blue-50', paid: 'text-green-600 bg-green-50', overdue: 'text-red-600 bg-red-50' }[isOverdue ? 'overdue' : inv.status]
              return (
                <div key={inv.id} className="bg-card border rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">#{inv.invoice_number}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', statusColor)}>{statusLabel}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{inv.vendor_name || 'Vendor'}</p>
                    <p className="text-xs text-muted-foreground">Due: {formatDate(inv.due_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(inv.amount)}</p>
                    {inv.paid_amount > 0 && inv.paid_amount < inv.amount && (
                      <p className="text-xs text-muted-foreground">Paid: {formatCurrency(inv.paid_amount)}</p>
                    )}
                  </div>
                </div>
              )
            })}
            {invoices.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No invoices yet</p>
              </div>
            )}
          </div>
        )}

        {tab === 'accounts' && (
          <div className="space-y-6">
            {(['asset', 'liability', 'equity', 'revenue', 'expense'] as const).map((type) => {
              const typeAccounts = accounts.filter((a) => a.type === type && a.is_active)
              if (typeAccounts.length === 0) return null
              const colors = { asset: 'text-blue-600', liability: 'text-red-600', equity: 'text-purple-600', revenue: 'text-green-600', expense: 'text-amber-600' }
              return (
                <div key={type}>
                  <h3 className={cn('font-semibold capitalize mb-3', colors[type])}>{type} Accounts</h3>
                  <div className="bg-card border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 border-b">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Code</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Account Name</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {typeAccounts.map((acc) => (
                          <tr key={acc.id}>
                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{acc.code}</td>
                            <td className="px-4 py-3 font-medium">{acc.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
            {accounts.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">No accounts configured</div>
            )}
          </div>
        )}
      </div>

      {showAddExpense && (
        <AddExpenseModal onClose={() => setShowAddExpense(false)} onSaved={() => { setShowAddExpense(false); qc.invalidateQueries({ queryKey: ['expenses'] }) }} />
      )}
    </div>
  )
}
