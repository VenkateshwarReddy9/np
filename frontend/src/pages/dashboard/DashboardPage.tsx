import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, ShoppingBag, Users, DollarSign, AlertTriangle, Clock } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

function KPICard({ title, value, subtitle, icon: Icon, color = 'blue' }: { title: string; value: string; subtitle?: string; icon: any; color?: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
    purple: 'bg-purple-500/10 text-purple-500',
  }
  return (
    <div className="bg-card border rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${colorMap[color] || colorMap.blue}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')

  const { data: kpis } = useQuery({
    queryKey: ['dashboard-kpis', period],
    queryFn: () => api.get(`/analytics/dashboard?period=${period}`).then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: salesData } = useQuery({
    queryKey: ['sales-chart'],
    queryFn: () => api.get('/analytics/sales').then((r) => r.data),
  })

  const { data: topItems } = useQuery({
    queryKey: ['top-items'],
    queryFn: () => api.get('/analytics/menu-performance?limit=8').then((r) => r.data),
  })

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => api.get('/inventory/low-stock-alerts').then((r) => r.data),
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Good morning, {user?.first_name}!</p>
        </div>
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Revenue" value={formatCurrency(kpis?.revenue ?? 0)} icon={DollarSign} color="green" />
        <KPICard title="Orders" value={(kpis?.order_count ?? 0).toString()} icon={ShoppingBag} color="blue" />
        <KPICard title="Avg Ticket" value={formatCurrency(kpis?.avg_ticket ?? 0)} icon={TrendingUp} color="purple" />
        <KPICard title="Waste Cost" value={formatCurrency(kpis?.waste_cost ?? 0)} subtitle="Today's waste" icon={AlertTriangle} color="amber" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales trend */}
        <div className="lg:col-span-2 bg-card border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Sales Trend (30 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={salesData ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Order type pie */}
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Order Types</h3>
          {kpis?.order_types?.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={kpis.order_types} dataKey="revenue" nameKey="type" cx="50%" cy="50%" outerRadius={70} label={(e) => e.type}>
                  {kpis.order_types.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top menu items */}
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Top Menu Items</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={(topItems ?? []).slice(0, 6)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Low stock alerts */}
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Low Stock Alerts
          </h3>
          {(lowStock ?? []).length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">All stock levels are healthy ✓</div>
          ) : (
            <div className="space-y-3">
              {(lowStock ?? []).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Par: {item.par_level} {item.unit}</p>
                  </div>
                  <span className="text-sm font-bold text-amber-600">{item.current_stock} {item.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
