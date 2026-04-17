import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import { Save, Globe, DollarSign, Bell, Shield, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'general' | 'tax' | 'notifications' | 'users'

interface RestaurantSettings {
  name: string
  slug: string
  address?: string
  phone?: string
  email?: string
  timezone: string
  currency: string
  tax_rate: number
  logo_url?: string
}

interface NotificationSettings {
  email_new_order: boolean
  email_low_stock: boolean
  email_reservation: boolean
  sms_new_reservation: boolean
  sms_low_stock: boolean
}

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai', 'Australia/Sydney',
]

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

export default function SettingsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('general')
  const [generalSaving, setGeneralSaving] = useState(false)
  const [notifSaving, setNotifSaving] = useState(false)

  const { data: restaurantData } = useQuery<RestaurantSettings>({
    queryKey: ['restaurant-settings'],
    queryFn: () => api.get('/settings/restaurant').then((r) => r.data),
  })

  const { data: notifData } = useQuery<NotificationSettings>({
    queryKey: ['notification-settings'],
    queryFn: () => api.get('/settings/notifications').then((r) => r.data),
    enabled: tab === 'notifications',
  })

  const [general, setGeneral] = useState<RestaurantSettings>({
    name: '', slug: '', timezone: 'America/New_York', currency: 'USD', tax_rate: 8.5
  })

  const [notif, setNotif] = useState<NotificationSettings>({
    email_new_order: true, email_low_stock: true, email_reservation: true,
    sms_new_reservation: false, sms_low_stock: false,
  })

  useEffect(() => {
    if (restaurantData) setGeneral(restaurantData)
  }, [restaurantData])

  useEffect(() => {
    if (notifData) setNotif(notifData)
  }, [notifData])

  const saveGeneral = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralSaving(true)
    try {
      await api.put('/settings/restaurant', general)
      qc.invalidateQueries({ queryKey: ['restaurant-settings'] })
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setGeneralSaving(false)
    }
  }

  const saveNotif = async () => {
    setNotifSaving(true)
    try {
      await api.put('/settings/notifications', notif)
      toast.success('Notification settings saved')
    } catch {
      toast.error('Failed to save notification settings')
    } finally {
      setNotifSaving(false)
    }
  }

  const qrMenuUrl = `${window.location.origin}/menu/${general.slug}`

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'general', label: 'General', icon: Globe },
    { key: 'tax', label: 'Tax & Pricing', icon: DollarSign },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'users', label: 'Users & Access', icon: Shield },
  ]

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 border-r bg-muted/30 p-4 space-y-1">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Settings</h2>
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2', tab === t.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl">
          {tab === 'general' && (
            <form onSubmit={saveGeneral} className="space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-1">General Settings</h2>
                <p className="text-sm text-muted-foreground">Basic restaurant information</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Restaurant Name</label>
                  <input value={general.name} onChange={(e) => setGeneral({ ...general, name: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">URL Slug</label>
                  <div className="flex items-center gap-2">
                    <input value={general.slug} onChange={(e) => setGeneral({ ...general, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                      className="flex-1 px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">Used for QR menu: /menu/{general.slug}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Phone</label>
                  <input value={general.phone || ''} onChange={(e) => setGeneral({ ...general, phone: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Address</label>
                  <input value={general.address || ''} onChange={(e) => setGeneral({ ...general, address: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Timezone</label>
                    <select value={general.timezone} onChange={(e) => setGeneral({ ...general, timezone: e.target.value })}
                      className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Currency</label>
                    <select value={general.currency} onChange={(e) => setGeneral({ ...general, currency: e.target.value })}
                      className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.symbol} {c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* QR Menu Link */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <h3 className="font-semibold text-sm text-blue-800 mb-2">QR Menu URL</h3>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white px-3 py-2 rounded-lg border font-mono truncate">{qrMenuUrl}</code>
                  <CopyButton text={qrMenuUrl} />
                </div>
                <p className="text-xs text-blue-600 mt-2">Share this link or generate a QR code for table cards</p>
              </div>

              <button type="submit" disabled={generalSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm">
                <Save className="h-4 w-4" />
                {generalSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {tab === 'tax' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-1">Tax & Pricing</h2>
                <p className="text-sm text-muted-foreground">Configure tax rates and pricing rules</p>
              </div>
              <div className="bg-card border rounded-xl p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Default Tax Rate (%)</label>
                  <div className="flex items-center gap-3">
                    <input type="number" step="0.1" min={0} max={100}
                      value={general.tax_rate}
                      onChange={(e) => setGeneral({ ...general, tax_rate: parseFloat(e.target.value) })}
                      className="w-32 px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="text-sm text-muted-foreground">Applied to all taxable items</span>
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-xl text-sm">
                  <p className="font-medium mb-2">Example on a $50 order:</p>
                  <div className="space-y-1 text-muted-foreground">
                    <div className="flex justify-between"><span>Subtotal</span><span>$50.00</span></div>
                    <div className="flex justify-between"><span>Tax ({general.tax_rate}%)</span><span>${(50 * general.tax_rate / 100).toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold text-foreground pt-1 border-t"><span>Total</span><span>${(50 + 50 * general.tax_rate / 100).toFixed(2)}</span></div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await api.put('/settings/restaurant', { ...general })
                      toast.success('Tax rate saved')
                    } catch {
                      toast.error('Failed to save')
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm">
                  <Save className="h-4 w-4" /> Save Tax Rate
                </button>
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-1">Notifications</h2>
                <p className="text-sm text-muted-foreground">Control when and how you receive alerts</p>
              </div>
              <div className="bg-card border rounded-xl p-6 space-y-5">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Email Notifications</h3>
                {[
                  { key: 'email_new_order', label: 'New online order received', desc: 'Notify when an online order comes in' },
                  { key: 'email_low_stock', label: 'Low stock alert', desc: 'Notify when an ingredient falls below par level' },
                  { key: 'email_reservation', label: 'New reservation', desc: 'Notify when a reservation is made' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={notif[item.key as keyof NotificationSettings] as boolean}
                        onChange={(e) => setNotif({ ...notif, [item.key]: e.target.checked })}
                        className="sr-only peer" />
                      <div className="w-10 h-5 bg-muted rounded-full peer peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                    </label>
                  </div>
                ))}

                <hr className="border-border" />
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">SMS Notifications</h3>
                {[
                  { key: 'sms_new_reservation', label: 'Reservation confirmations', desc: 'Send SMS to guests when reservation is confirmed' },
                  { key: 'sms_low_stock', label: 'Low stock SMS', desc: 'Send SMS alert to manager when stock is critical' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={notif[item.key as keyof NotificationSettings] as boolean}
                        onChange={(e) => setNotif({ ...notif, [item.key]: e.target.checked })}
                        className="sr-only peer" />
                      <div className="w-10 h-5 bg-muted rounded-full peer peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                    </label>
                  </div>
                ))}

                <button onClick={saveNotif} disabled={notifSaving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm">
                  <Save className="h-4 w-4" />
                  {notifSaving ? 'Saving...' : 'Save Notifications'}
                </button>
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-1">Users & Access</h2>
                <p className="text-sm text-muted-foreground">Manage who can access the system and their roles</p>
              </div>
              <div className="bg-card border rounded-xl p-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Role Permissions</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium text-muted-foreground">Role</th>
                          <th className="pb-2 font-medium text-muted-foreground">Access Level</th>
                          <th className="pb-2 font-medium text-muted-foreground">Modules</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {[
                          { role: 'owner', level: 'Full Access', modules: 'Everything + billing' },
                          { role: 'manager', level: 'High', modules: 'All except billing' },
                          { role: 'cashier', level: 'Medium', modules: 'POS, Orders, Customers' },
                          { role: 'waiter', level: 'Medium', modules: 'POS, Tables, Reservations' },
                          { role: 'kitchen', level: 'Low', modules: 'KDS only' },
                        ].map((r) => (
                          <tr key={r.role}>
                            <td className="py-3 font-medium capitalize">{r.role}</td>
                            <td className="py-3 text-muted-foreground">{r.level}</td>
                            <td className="py-3 text-muted-foreground text-xs">{r.modules}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-amber-50 rounded-xl">
                  <p className="text-sm text-amber-700">
                    <span className="font-semibold">Note:</span> To add or remove users, go to Staff → Add Employee and assign them a login email. Users sign in at the regular login page with their credentials.
                  </p>
                </div>
              </div>

              <div className="bg-card border rounded-xl p-6">
                <h3 className="font-semibold mb-4">Your Account</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{user?.first_name} {user?.last_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{user?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium capitalize">{user?.role}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
