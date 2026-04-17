import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { formatCurrency } from '@/lib/utils'
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

interface MenuItem {
  id: string
  name: string
  description: string
  base_price: number
  cost_price: number
  profit_margin: number
  calories: number | null
  is_available: boolean
  category_id: string
  station: string | null
}

interface Category {
  id: string
  name: string
  display_order: number
  is_active: boolean
}

export default function MenuPage() {
  const qc = useQueryClient()
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['menu-categories'],
    queryFn: () => api.get('/menu/categories').then((r) => r.data),
  })

  const { data: items = [] } = useQuery<MenuItem[]>({
    queryKey: ['menu-items', selectedCat],
    queryFn: () => {
      const params = selectedCat ? `?category_id=${selectedCat}` : ''
      return api.get(`/menu/items${params}`).then((r) => r.data)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (itemId: string) => api.patch(`/menu/items/${itemId}/toggle`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-items'] }); toast.success('Availability updated') },
  })

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => api.delete(`/menu/items/${itemId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-items'] }); toast.success('Item deleted') },
    onError: () => toast.error('Cannot delete item with existing orders'),
  })

  return (
    <div className="flex h-full overflow-hidden">
      {/* Category sidebar */}
      <div className="w-56 border-r bg-muted/30 p-4 space-y-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Categories</h2>
        </div>
        <button
          onClick={() => setSelectedCat(null)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!selectedCat ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          All Items
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedCat === cat.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between">
          <h1 className="text-2xl font-bold">Menu Management</h1>
          <button
            onClick={() => { setEditItem(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {items.map((item) => (
              <div key={item.id} className={`bg-card border rounded-xl p-4 ${!item.is_available ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{item.name}</h3>
                      {!item.is_available && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">86'd</span>}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="font-bold text-blue-600">{formatCurrency(item.base_price)}</span>
                      <span className="text-xs text-muted-foreground">Cost: {formatCurrency(item.cost_price)}</span>
                      <span className={`flex items-center gap-1 text-xs font-medium ${item.profit_margin > 60 ? 'text-green-600' : item.profit_margin > 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        <TrendingUp className="h-3 w-3" />{item.profit_margin.toFixed(1)}% margin
                      </span>
                    </div>
                    {item.calories && <p className="text-xs text-muted-foreground mt-1">{item.calories} cal • {item.station || 'No station'}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleMutation.mutate(item.id)} className="p-2 hover:bg-muted rounded-lg transition-colors" title={item.is_available ? '86 item' : 'Make available'}>
                      {item.is_available ? <ToggleRight className="h-5 w-5 text-green-600" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    <button onClick={() => { setEditItem(item); setShowForm(true) }} className="p-2 hover:bg-muted rounded-lg transition-colors">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this item?')) deleteMutation.mutate(item.id) }}
                      className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {items.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">No menu items yet</p>
              <p className="text-sm mt-1">Click "Add Item" to create your first menu item</p>
            </div>
          )}
        </div>
      </div>

      {/* Item form modal */}
      {showForm && (
        <ItemFormModal
          item={editItem}
          categories={categories}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['menu-items'] }) }}
        />
      )}
    </div>
  )
}

function ItemFormModal({ item, categories, onClose, onSaved }: { item: MenuItem | null; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    description: '',
    category_id: item?.category_id || categories[0]?.id || '',
    base_price: item?.base_price || 0,
    cost_price: item?.cost_price || 0,
    calories: item?.calories || '',
    prep_time_min: 10,
    station: item?.station || '',
    is_available: item?.is_available ?? true,
  })
  const [loading, setLoading] = useState(false)

  const margin = form.base_price > 0 ? ((form.base_price - form.cost_price) / form.base_price * 100) : 0

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (item) {
        await api.put(`/menu/items/${item.id}`, form)
        toast.success('Item updated')
      } else {
        await api.post('/menu/items', form)
        toast.success('Item created')
      }
      onSaved()
    } catch {
      toast.error('Failed to save item')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-6">{item ? 'Edit Item' : 'Add Menu Item'}</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Category</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Price ($)</label>
              <input type="number" step="0.01" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: parseFloat(e.target.value) })} required className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Cost ($)</label>
              <input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) })} className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {/* Live margin calculator */}
          <div className={`p-3 rounded-xl text-sm font-medium ${margin > 60 ? 'bg-green-50 text-green-700' : margin > 40 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
            Profit Margin: {margin.toFixed(1)}% — {margin > 60 ? 'Excellent' : margin > 40 ? 'Good' : 'Low — consider adjusting price or cost'}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Calories</label>
              <input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Prep Time (min)</label>
              <input type="number" value={form.prep_time_min} onChange={(e) => setForm({ ...form, prep_time_min: parseInt(e.target.value) })} className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">KDS Station</label>
            <select value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">None</option>
              {['grill', 'fry', 'salad', 'bar', 'expo'].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
