import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { usePOSStore } from '@/store/posStore'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { useWebSocket } from '@/hooks/useWebSocket'
import { formatCurrency } from '@/lib/utils'
import { Plus, Minus, Trash2, CreditCard, Banknote, ShoppingCart, Search, WifiOff } from 'lucide-react'
import toast from 'react-hot-toast'

function CategoryTab({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-muted hover:bg-muted/80'}`}
    >
      {name}
    </button>
  )
}

function ItemButton({ item, onAdd }: { item: any; onAdd: (item: any) => void }) {
  return (
    <button
      onClick={() => onAdd(item)}
      className="pos-item-btn bg-card border hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left w-full"
    >
      <div className="text-sm font-semibold line-clamp-2">{item.name}</div>
      <div className="text-blue-600 font-bold text-sm">{formatCurrency(item.base_price)}</div>
      {item.calories && <div className="text-xs text-muted-foreground">{item.calories} cal</div>}
    </button>
  )
}

export default function POSPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const pos = usePOSStore()
  const { saveOfflineOrder, cacheMenu, getCachedMenu, isOnline } = useOfflineQueue(user?.restaurant_id)
  const { on } = useWebSocket(user?.restaurant_id)
  const [activeCat, setActiveCat] = useState<string>('')
  const [search, setSearch] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash')
  const [cashTendered, setCashTendered] = useState('')

  const { data: menuData } = useQuery({
    queryKey: ['pos-menu'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/menu/categories')
        const { data: items } = await api.get('/menu/items?available_only=true')
        const result = { categories: data, items }
        await cacheMenu(user?.restaurant_id || '', result)
        return result
      } catch {
        // Fallback to offline cache
        const cached = await getCachedMenu(user?.restaurant_id || '')
        return cached?.data as { categories: any[]; items: any[] }
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: tables } = useQuery({
    queryKey: ['tables'],
    queryFn: () => api.get('/tables').then((r) => r.data),
  })

  const categories = menuData?.categories ?? []
  const allItems = menuData?.items ?? []

  useEffect(() => {
    if (categories.length && !activeCat) setActiveCat(categories[0]?.id)
  }, [categories])

  const filteredItems = allItems.filter((i: any) => {
    if (search) return i.name.toLowerCase().includes(search.toLowerCase())
    return !activeCat || i.category_id === activeCat
  })

  const { mutate: placeOrder, isPending } = useMutation({
    mutationFn: async (paymentData: { method: string; amount: number; tip_amount: number; change_given: number }) => {
      const orderPayload = {
        table_id: pos.table_id,
        customer_id: pos.customer_id,
        order_type: pos.order_type,
        notes: pos.notes,
        items: pos.items.map((i) => ({
          menu_item_id: i.menu_item_id,
          quantity: i.quantity,
          special_instructions: i.special_instructions,
          modifiers: i.modifiers.map((m) => ({ modifier_option_id: m.modifier_option_id })),
        })),
      }

      if (!isOnline) {
        await saveOfflineOrder({
          id: `offline-${Date.now()}`,
          restaurant_id: user?.restaurant_id || '',
          order_type: pos.order_type,
          items: pos.items,
          subtotal: pos.subtotal(),
          tax_amount: 0,
          total: pos.subtotal(),
          notes: pos.notes || undefined,
        })
        return { offline: true }
      }

      const { data: order } = await api.post('/orders', orderPayload)
      await api.post(`/orders/${order.id}/payments`, paymentData)
      return order
    },
    onSuccess: (data) => {
      if ((data as any).offline) {
        toast.success('Order saved offline — will sync when online', { icon: '📱' })
      } else {
        toast.success('Order placed successfully!')
      }
      pos.clearOrder()
      setShowPayment(false)
      qc.invalidateQueries({ queryKey: ['tables'] })
    },
    onError: () => toast.error('Failed to place order'),
  })

  const handleAddItem = (item: any) => {
    pos.addItem({
      menu_item_id: item.id,
      name: item.name,
      unit_price: item.base_price,
      quantity: 1,
      modifiers: [],
    })
  }

  const subtotal = pos.subtotal()
  const tax = subtotal * 0.085  // TODO: get from restaurant settings
  const total = subtotal + tax - pos.discount_amount

  const handlePay = () => {
    if (pos.items.length === 0) { toast.error('Add items to the order'); return }
    const amount = paymentMethod === 'cash' ? total : total
    const tendered = paymentMethod === 'cash' ? parseFloat(cashTendered) || total : total
    const change = Math.max(0, tendered - total)
    placeOrder({ method: paymentMethod, amount: total, tip_amount: 0, change_given: change })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {!isOnline && (
        <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-center text-xs py-1.5 z-50 flex items-center justify-center gap-2">
          <WifiOff className="h-3 w-3" />
          Offline mode — orders will sync when connection is restored
        </div>
      )}

      {/* Menu grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search & categories */}
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu items..."
              className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-muted focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat: any) => (
              <CategoryTab key={cat.id} name={cat.name} active={activeCat === cat.id && !search} onClick={() => { setActiveCat(cat.id); setSearch('') }} />
            ))}
          </div>
        </div>

        {/* Order type + table selector */}
        <div className="px-4 py-2 border-b flex items-center gap-3 bg-muted/40">
          <select
            value={pos.order_type}
            onChange={(e) => pos.setOrderType(e.target.value as any)}
            className="text-sm border rounded-lg px-3 py-1.5 bg-background"
          >
            <option value="dine_in">Dine In</option>
            <option value="takeout">Takeout</option>
            <option value="delivery">Delivery</option>
          </select>
          {pos.order_type === 'dine_in' && (
            <select
              value={pos.table_id || ''}
              onChange={(e) => pos.setTable(e.target.value || null)}
              className="text-sm border rounded-lg px-3 py-1.5 bg-background"
            >
              <option value="">Select table...</option>
              {(tables ?? []).filter((t: any) => t.status === 'available' || t.id === pos.table_id).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name} (seats {t.capacity})</option>
              ))}
            </select>
          )}
        </div>

        {/* Items grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredItems.map((item: any) => (
              <ItemButton key={item.id} item={item} onAdd={handleAddItem} />
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-12">No items found</div>
            )}
          </div>
        </div>
      </div>

      {/* Order panel */}
      <div className="w-80 xl:w-96 border-l flex flex-col bg-card">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Current Order
          </h2>
          {pos.items.length > 0 && (
            <button onClick={pos.clearOrder} className="text-sm text-destructive hover:underline">Clear</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {pos.items.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-12">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-20" />
              Tap items to add to the order
            </div>
          ) : (
            pos.items.map((item) => (
              <div key={item.menu_item_id} className="flex items-start gap-3 p-3 bg-muted rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  {item.modifiers.length > 0 && (
                    <p className="text-xs text-muted-foreground">{item.modifiers.map((m) => m.name).join(', ')}</p>
                  )}
                  <p className="text-sm font-bold text-blue-600 mt-1">{formatCurrency(item.line_total)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => pos.updateQuantity(item.menu_item_id, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-background border hover:bg-destructive hover:text-white hover:border-destructive transition-colors">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                  <button onClick={() => pos.updateQuantity(item.menu_item_id, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals + payment */}
        <div className="border-t p-4 space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{formatCurrency(tax)}</span></div>
            {pos.discount_amount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatCurrency(pos.discount_amount)}</span></div>}
            <div className="flex justify-between font-bold text-lg pt-1 border-t"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>

          {!showPayment ? (
            <button
              onClick={() => setShowPayment(true)}
              disabled={pos.items.length === 0}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
            >
              Charge {formatCurrency(total)}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPaymentMethod('cash')} className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${paymentMethod === 'cash' ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/20' : 'border-border'}`}>
                  <Banknote className="h-4 w-4" /> Cash
                </button>
                <button onClick={() => setPaymentMethod('card')} className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${paymentMethod === 'card' ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/20' : 'border-border'}`}>
                  <CreditCard className="h-4 w-4" /> Card
                </button>
              </div>
              {paymentMethod === 'cash' && (
                <div>
                  <label className="text-xs text-muted-foreground">Cash tendered</label>
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder={total.toFixed(2)}
                    className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {cashTendered && parseFloat(cashTendered) >= total && (
                    <p className="text-xs text-green-600 mt-1">Change: {formatCurrency(parseFloat(cashTendered) - total)}</p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setShowPayment(false)} className="flex-1 py-3 border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
                <button onClick={handlePay} disabled={isPending} className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm">
                  {isPending ? 'Processing...' : 'Complete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
