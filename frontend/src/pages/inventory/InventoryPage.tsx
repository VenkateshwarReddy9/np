import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Plus, AlertTriangle, Package, Trash2, Edit2, TrendingDown, ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'ingredients' | 'waste' | 'purchase-orders' | 'suppliers'

interface Ingredient {
  id: string
  name: string
  unit: string
  current_stock: number
  par_level: number
  reorder_qty: number
  cost_per_unit: number
  supplier_id?: string
  is_active: boolean
  category_id?: string
}

interface WasteLog {
  id: string
  ingredient_id: string
  ingredient_name?: string
  quantity: number
  unit: string
  reason: string
  estimated_cost: number
  logged_at: string
}

interface PurchaseOrder {
  id: string
  po_number: string
  status: 'draft' | 'sent' | 'partial' | 'received' | 'cancelled'
  supplier_id: string
  supplier_name?: string
  total: number
  ordered_at: string
  expected_at?: string
}

interface Supplier {
  id: string
  name: string
  contact_name?: string
  email?: string
  phone?: string
  payment_terms?: string
}

function StockBadge({ item }: { item: Ingredient }) {
  const pct = item.par_level > 0 ? (item.current_stock / item.par_level) * 100 : 100
  if (pct <= 25) return <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Critical</span>
  if (pct <= 60) return <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Low</span>
  return <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">OK</span>
}

function AdjustStockModal({ item, onClose, onSaved }: { item: Ingredient; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ quantity: 0, type: 'adjustment' as const, reason: '' })
  const [loading, setLoading] = useState(false)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post(`/inventory/ingredients/${item.id}/adjust`, form)
      toast.success('Stock adjusted')
      onSaved()
    } catch {
      toast.error('Failed to adjust stock')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-xl font-bold mb-1">Adjust Stock</h2>
        <p className="text-sm text-muted-foreground mb-5">{item.name} — Current: {item.current_stock} {item.unit}</p>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Adjustment Quantity</label>
            <input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) })}
              required className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Use negative to reduce" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="adjustment">Manual Adjustment</option>
              <option value="purchase">Purchase</option>
              <option value="waste">Waste</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Reason</label>
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {loading ? 'Saving...' : 'Adjust'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddIngredientModal({ onClose, onSaved, suppliers }: { onClose: () => void; onSaved: () => void; suppliers: Supplier[] }) {
  const [form, setForm] = useState({ name: '', unit: 'kg', current_stock: 0, par_level: 0, reorder_qty: 0, cost_per_unit: 0, supplier_id: '' })
  const [loading, setLoading] = useState(false)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/inventory/ingredients', form)
      toast.success('Ingredient added')
      onSaved()
    } catch {
      toast.error('Failed to add ingredient')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-5">Add Ingredient</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Unit</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['kg', 'g', 'lb', 'oz', 'L', 'mL', 'gal', 'qt', 'unit', 'dozen', 'case', 'bag'].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Current Stock</label>
              <input type="number" step="0.01" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: parseFloat(e.target.value) })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Par Level</label>
              <input type="number" step="0.01" value={form.par_level} onChange={(e) => setForm({ ...form, par_level: parseFloat(e.target.value) })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Reorder Qty</label>
              <input type="number" step="0.01" value={form.reorder_qty} onChange={(e) => setForm({ ...form, reorder_qty: parseFloat(e.target.value) })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Cost per Unit ($)</label>
              <input type="number" step="0.01" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: parseFloat(e.target.value) })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Supplier</label>
              <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">None</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {loading ? 'Saving...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LogWasteModal({ ingredients, onClose, onSaved }: { ingredients: Ingredient[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ ingredient_id: ingredients[0]?.id || '', quantity: 0, unit: '', reason: 'spoilage' })
  const [loading, setLoading] = useState(false)
  const selectedIng = ingredients.find((i) => i.id === form.ingredient_id)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/inventory/waste-logs', { ...form, unit: selectedIng?.unit || form.unit })
      toast.success('Waste logged')
      onSaved()
    } catch {
      toast.error('Failed to log waste')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-xl font-bold mb-5">Log Waste</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Ingredient</label>
            <select value={form.ingredient_id} onChange={(e) => setForm({ ...form, ingredient_id: e.target.value })}
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Quantity ({selectedIng?.unit})</label>
            <input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) })} required
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Reason</label>
            <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['spoilage', 'overproduction', 'dropped', 'expired', 'contamination', 'other'].map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
          </div>
          {selectedIng && (
            <div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-700">
              Est. Cost: {formatCurrency(form.quantity * selectedIng.cost_per_unit)}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {loading ? 'Logging...' : 'Log Waste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('ingredients')
  const [adjustItem, setAdjustItem] = useState<Ingredient | null>(null)
  const [showAddIng, setShowAddIng] = useState(false)
  const [showWaste, setShowWaste] = useState(false)
  const [search, setSearch] = useState('')

  const { data: ingredients = [] } = useQuery<Ingredient[]>({
    queryKey: ['ingredients'],
    queryFn: () => api.get('/inventory/ingredients').then((r) => r.data),
  })

  const { data: wasteLogs = [] } = useQuery<WasteLog[]>({
    queryKey: ['waste-logs'],
    queryFn: () => api.get('/inventory/waste-logs').then((r) => r.data),
    enabled: tab === 'waste',
  })

  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders'],
    queryFn: () => api.get('/inventory/purchase-orders').then((r) => r.data),
    enabled: tab === 'purchase-orders',
  })

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/inventory/suppliers').then((r) => r.data),
  })

  const lowStockCount = ingredients.filter((i) => i.par_level > 0 && i.current_stock <= i.par_level * 0.6).length

  const filteredIngredients = ingredients.filter((i) =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ingredients', label: 'Ingredients' },
    { key: 'waste', label: 'Waste Log' },
    { key: 'purchase-orders', label: 'Purchase Orders' },
    { key: 'suppliers', label: 'Suppliers' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Inventory</h1>
            {lowStockCount > 0 && (
              <p className="text-sm text-amber-600 flex items-center gap-1 mt-0.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {lowStockCount} ingredient{lowStockCount > 1 ? 's' : ''} running low
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowWaste(true)} className="flex items-center gap-2 px-3 py-2 border hover:bg-muted rounded-xl text-sm font-medium">
              <TrendingDown className="h-4 w-4" /> Log Waste
            </button>
            <button onClick={() => setShowAddIng(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
              <Plus className="h-4 w-4" /> Add Ingredient
            </button>
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'ingredients' && (
          <>
            <div className="mb-4">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ingredients..."
                className="w-full max-w-sm px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Stock</th>
                    <th className="pb-3 font-medium">Par Level</th>
                    <th className="pb-3 font-medium">Unit Cost</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredIngredients.map((ing) => (
                    <tr key={ing.id} className="group">
                      <td className="py-3 font-medium">{ing.name}</td>
                      <td className="py-3">
                        <span className={cn(ing.current_stock <= ing.par_level * 0.6 ? 'text-red-600 font-semibold' : '')}>
                          {ing.current_stock} {ing.unit}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">{ing.par_level} {ing.unit}</td>
                      <td className="py-3">{formatCurrency(ing.cost_per_unit)}</td>
                      <td className="py-3"><StockBadge item={ing} /></td>
                      <td className="py-3">
                        <button onClick={() => setAdjustItem(ing)}
                          className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-opacity">
                          Adjust Stock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredIngredients.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No ingredients found</p>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'waste' && (
          <div className="space-y-3">
            {wasteLogs.map((log) => (
              <div key={log.id} className="bg-card border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{log.ingredient_name || 'Ingredient'}</p>
                  <p className="text-sm text-muted-foreground capitalize">{log.reason} · {log.quantity} {log.unit}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(log.logged_at)}</p>
                </div>
                <span className="text-red-600 font-bold">{formatCurrency(log.estimated_cost)}</span>
              </div>
            ))}
            {wasteLogs.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No waste logs yet</p>
              </div>
            )}
          </div>
        )}

        {tab === 'purchase-orders' && (
          <div className="space-y-3">
            {purchaseOrders.map((po) => {
              const statusColor = { draft: 'text-gray-600 bg-gray-50', sent: 'text-blue-600 bg-blue-50', partial: 'text-amber-600 bg-amber-50', received: 'text-green-600 bg-green-50', cancelled: 'text-red-600 bg-red-50' }[po.status]
              return (
                <div key={po.id} className="bg-card border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">PO #{po.po_number}</p>
                    <p className="text-sm text-muted-foreground">{po.supplier_name || 'Supplier'}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(po.ordered_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(po.total)}</p>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', statusColor)}>{po.status}</span>
                  </div>
                </div>
              )
            })}
            {purchaseOrders.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No purchase orders yet</p>
              </div>
            )}
          </div>
        )}

        {tab === 'suppliers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {suppliers.map((s) => (
              <div key={s.id} className="bg-card border rounded-xl p-4">
                <p className="font-semibold">{s.name}</p>
                {s.contact_name && <p className="text-sm text-muted-foreground mt-0.5">{s.contact_name}</p>}
                {s.email && <p className="text-sm text-muted-foreground">{s.email}</p>}
                {s.phone && <p className="text-sm text-muted-foreground">{s.phone}</p>}
                {s.payment_terms && <p className="text-xs text-muted-foreground mt-2">Terms: {s.payment_terms}</p>}
              </div>
            ))}
            {suppliers.length === 0 && <div className="text-muted-foreground text-sm">No suppliers yet</div>}
          </div>
        )}
      </div>

      {adjustItem && (
        <AdjustStockModal item={adjustItem} onClose={() => setAdjustItem(null)}
          onSaved={() => { setAdjustItem(null); qc.invalidateQueries({ queryKey: ['ingredients'] }) }} />
      )}
      {showAddIng && (
        <AddIngredientModal suppliers={suppliers} onClose={() => setShowAddIng(false)}
          onSaved={() => { setShowAddIng(false); qc.invalidateQueries({ queryKey: ['ingredients'] }) }} />
      )}
      {showWaste && (
        <LogWasteModal ingredients={ingredients} onClose={() => setShowWaste(false)}
          onSaved={() => { setShowWaste(false); qc.invalidateQueries({ queryKey: ['waste-logs'] }) }} />
      )}
    </div>
  )
}
