import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/api/client'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, Plus, Minus, Trash2, ChefHat, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface PublicMenuItem {
  id: string
  name: string
  description: string
  base_price: number
  calories?: number
  is_available: boolean
  category_id: string
  allergens?: { name: string; icon: string }[]
}

interface PublicCategory {
  id: string
  name: string
  items: PublicMenuItem[]
}

interface CartItem {
  menu_item_id: string
  name: string
  unit_price: number
  quantity: number
  special_instructions: string
}

export default function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>()
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'info' | 'done'>('cart')
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', phone: '', notes: '' })

  const { data: menuData, isLoading, error } = useQuery({
    queryKey: ['public-menu', slug],
    queryFn: () => api.get(`/menu/public/${slug}`).then((r) => r.data),
  })

  const { mutate: placeOrder, isPending } = useMutation({
    mutationFn: () => api.post('/online/orders', {
      restaurant_slug: slug,
      customer_name: customerInfo.name,
      customer_email: customerInfo.email,
      customer_phone: customerInfo.phone,
      notes: customerInfo.notes,
      items: cart.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity, special_instructions: i.special_instructions })),
    }),
    onSuccess: () => {
      setCheckoutStep('done')
      setCart([])
    },
    onError: () => toast.error('Failed to place order. Please try again.'),
  })

  const addToCart = (item: PublicMenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item.id)
      if (existing) return prev.map((c) => c.menu_item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { menu_item_id: item.id, name: item.name, unit_price: item.base_price, quantity: 1, special_instructions: '' }]
    })
  }

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.menu_item_id !== id))
    } else {
      setCart((prev) => prev.map((c) => c.menu_item_id === id ? { ...c, quantity: qty } : c))
    }
  }

  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const tax = subtotal * (menuData?.tax_rate || 8.5) / 100
  const total = subtotal + tax
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <ChefHat className="h-12 w-12 mx-auto mb-3 text-blue-600 animate-pulse" />
          <p className="text-muted-foreground">Loading menu...</p>
        </div>
      </div>
    )
  }

  if (error || !menuData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <ChefHat className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <h1 className="text-xl font-bold">Menu not found</h1>
          <p className="text-muted-foreground text-sm mt-1">This restaurant's online menu isn't available.</p>
        </div>
      </div>
    )
  }

  const restaurant = menuData.restaurant
  const categories: PublicCategory[] = menuData.categories

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Restaurant header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <ChefHat className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold">{restaurant.name}</h1>
              <p className="text-xs text-muted-foreground">Online Order</p>
            </div>
          </div>
          <button
            onClick={() => setShowCart(true)}
            className="relative flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium"
          >
            <ShoppingCart className="h-4 w-4" />
            {itemCount > 0 ? (
              <>
                <span>{itemCount} items</span>
                <span className="font-bold">{formatCurrency(subtotal)}</span>
              </>
            ) : 'Cart'}
          </button>
        </div>
      </div>

      {/* Menu */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {categories.map((category) => (
          <div key={category.id}>
            <h2 className="text-lg font-bold mb-4">{category.name}</h2>
            <div className="space-y-3">
              {category.items.filter((i) => i.is_available).map((item) => {
                const cartItem = cart.find((c) => c.menu_item_id === item.id)
                return (
                  <div key={item.id} className="bg-white border rounded-xl p-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{item.name}</h3>
                      {item.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="font-bold text-blue-600">{formatCurrency(item.base_price)}</span>
                        {item.calories && <span className="text-xs text-muted-foreground">{item.calories} cal</span>}
                      </div>
                      {item.allergens && item.allergens.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {item.allergens.map((a) => (
                            <span key={a.name} className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">{a.icon} {a.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {cartItem ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item.id, cartItem.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-red-50 hover:text-red-600 transition-colors">
                            {cartItem.quantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                          </button>
                          <span className="font-bold text-sm w-4 text-center">{cartItem.quantity}</span>
                          <button onClick={() => updateQty(item.id, cartItem.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(item)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Cart modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {checkoutStep === 'cart' ? 'Your Order' : checkoutStep === 'info' ? 'Your Details' : 'Order Placed!'}
              </h2>
              {checkoutStep !== 'done' && (
                <button onClick={() => setShowCart(false)} className="p-1.5 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {checkoutStep === 'done' ? (
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ChefHat className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold">Order Received!</h3>
                <p className="text-muted-foreground mt-2 text-sm">We've received your order and will begin preparing it shortly. You'll receive a confirmation at {customerInfo.email}.</p>
                <button onClick={() => { setShowCart(false); setCheckoutStep('cart') }}
                  className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors">
                  Back to Menu
                </button>
              </div>
            ) : checkoutStep === 'info' ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Your Name *</label>
                  <input value={customerInfo.name} onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })} required
                    className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email *</label>
                  <input type="email" value={customerInfo.email} onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })} required
                    className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Phone</label>
                  <input value={customerInfo.phone} onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Special Instructions</label>
                  <textarea value={customerInfo.notes} onChange={(e) => setCustomerInfo({ ...customerInfo, notes: e.target.value })} rows={3}
                    className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Allergies, pickup time, etc." />
                </div>
                <div className="pt-3 border-t space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{formatCurrency(tax)}</span></div>
                  <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span>{formatCurrency(total)}</span></div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setCheckoutStep('cart')} className="flex-1 py-3 border rounded-xl font-medium text-sm hover:bg-muted">Back</button>
                  <button
                    onClick={() => placeOrder()}
                    disabled={isPending || !customerInfo.name || !customerInfo.email}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm"
                  >
                    {isPending ? 'Placing Order...' : `Place Order · ${formatCurrency(total)}`}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {cart.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>Your cart is empty</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.menu_item_id} className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-blue-600">{formatCurrency(item.unit_price)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item.menu_item_id, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-muted hover:bg-red-50 transition-colors">
                            {item.quantity === 1 ? <Trash2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          </button>
                          <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateQty(item.menu_item_id, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="w-16 text-right font-medium text-sm">{formatCurrency(item.unit_price * item.quantity)}</span>
                      </div>
                    ))
                  )}
                </div>
                {cart.length > 0 && (
                  <div className="p-5 border-t space-y-3">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{formatCurrency(tax)}</span></div>
                      <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span>{formatCurrency(total)}</span></div>
                    </div>
                    <button onClick={() => setCheckoutStep('info')}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors">
                      Proceed to Checkout
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
