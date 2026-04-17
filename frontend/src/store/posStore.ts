import { create } from 'zustand'

export interface POSModifier {
  modifier_option_id: string
  name: string
  price: number
}

export interface POSItem {
  menu_item_id: string
  name: string
  unit_price: number
  quantity: number
  special_instructions?: string
  modifiers: POSModifier[]
  line_total: number
}

export interface POSState {
  order_type: 'dine_in' | 'takeout' | 'delivery' | 'online'
  table_id: string | null
  customer_id: string | null
  customer_name: string | null
  items: POSItem[]
  notes: string | null
  discount_amount: number

  setOrderType: (type: POSState['order_type']) => void
  setTable: (table_id: string | null) => void
  setCustomer: (customer_id: string | null, name: string | null) => void
  addItem: (item: Omit<POSItem, 'line_total'>) => void
  updateQuantity: (menu_item_id: string, quantity: number) => void
  removeItem: (menu_item_id: string) => void
  setNotes: (notes: string) => void
  setDiscount: (amount: number) => void
  clearOrder: () => void

  subtotal: () => number
  itemCount: () => number
}

export const usePOSStore = create<POSState>((set, get) => ({
  order_type: 'dine_in',
  table_id: null,
  customer_id: null,
  customer_name: null,
  items: [],
  notes: null,
  discount_amount: 0,

  setOrderType: (type) => set({ order_type: type }),
  setTable: (table_id) => set({ table_id }),
  setCustomer: (customer_id, customer_name) => set({ customer_id, customer_name }),
  setNotes: (notes) => set({ notes }),
  setDiscount: (discount_amount) => set({ discount_amount }),

  addItem: (item) => {
    const { items } = get()
    const existing = items.find(
      (i) => i.menu_item_id === item.menu_item_id && JSON.stringify(i.modifiers) === JSON.stringify(item.modifiers),
    )
    if (existing) {
      set({
        items: items.map((i) =>
          i === existing
            ? { ...i, quantity: i.quantity + item.quantity, line_total: (i.quantity + item.quantity) * (i.unit_price + i.modifiers.reduce((s, m) => s + m.price, 0)) }
            : i,
        ),
      })
    } else {
      const modifier_total = item.modifiers.reduce((s, m) => s + m.price, 0)
      set({
        items: [...items, { ...item, line_total: (item.unit_price + modifier_total) * item.quantity }],
      })
    }
  },

  updateQuantity: (menu_item_id, quantity) => {
    if (quantity <= 0) {
      get().removeItem(menu_item_id)
      return
    }
    set({
      items: get().items.map((i) =>
        i.menu_item_id === menu_item_id
          ? { ...i, quantity, line_total: quantity * (i.unit_price + i.modifiers.reduce((s, m) => s + m.price, 0)) }
          : i,
      ),
    })
  },

  removeItem: (menu_item_id) => set({ items: get().items.filter((i) => i.menu_item_id !== menu_item_id) }),

  clearOrder: () => set({ items: [], table_id: null, customer_id: null, customer_name: null, notes: null, discount_amount: 0 }),

  subtotal: () => get().items.reduce((s, i) => s + i.line_total, 0),
  itemCount: () => get().items.reduce((s, i) => s + i.quantity, 0),
}))
