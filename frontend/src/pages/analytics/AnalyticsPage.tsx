import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { TrendingUp, DollarSign, Users, ShoppingBag, AlertTriangle, Target } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

type Period = 'today' | 'week' | 'month' | '3months'

function KPICard({ title, value, subtitle, icon: Icon, color = 'blue', trend }: {
  title: string; value: string; subtitle?: string; icon: any; color?: string; trend?: number
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
    purple: 'bg-purple-500/10 text-purple-500',
  }
  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <p className={cn('text-xs font-medium mt-1 flex items-center gap-0.5', trend >= 0 ? 'text-green-600' : 'text-red-600')}>
              <TrendingUp className="h-3 w-3" />
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% vs prior period
            </p>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', colorMap[color] || colorMap.blue)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('week')
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  })

  const { data: kpis } = useQuery({
    queryKey: ['analytics-kpis', period],
    queryFn: () => api.get(`/analytics/dashboard?period=${period}`).then((r) => r.data),
    refetchInterval: 60000,
  })

  const { data: salesData = [] } = useQuery({
    queryKey: ['analytics-sales', dateRange],
    queryFn: () => api.get(`/analytics/sales?start=${dateRange.start}&end=${dateRange.end}`).then((r) => r.data),
  })

  const { data: topItems = [] } = useQuery({
    queryKey: ['analytics-menu'],
    queryFn: () => api.get('/analytics/menu-performance?limit=10').then((r) => r.data),
  })

  const { data: laborData } = useQuery({
    queryKey: ['analytics-labor', period],
    queryFn: () => api.get(`/analytics/labor-cost?period=${period}`).then((r) => r.data),
  })

  const { data: foodCostData } = useQuery({
    queryKey: ['analytics-food-cost', period],
    queryFn: () => api.get(`/analytics/food-cost?period=${period}`).then((r) => r.data),
  })

  const { data: customerInsights } = useQuery({
    queryKey: ['analytics-customers'],
    queryFn: () => api.get('/analytics/customer-insights').then((r) => r.data),
  })

  const foodCostPct = foodCostData?.food_cost_percentage ?? 0
  const laborCostPct = laborData?.labor_cost_percentage ?? 0
  const primeCostPct = foodCostPct + laborCostPct

  const periods: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: '3months', label: '3 Months' },
  ]

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {periods.map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', period === p.key ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80')}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 text-sm">
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-muted-foreground">—</span>
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Revenue" value={formatCurrency(kpis?.revenue ?? 0)} icon={DollarSign} color="green" trend={kpis?.revenue_trend} />
        <KPICard title="Orders" value={(kpis?.order_count ?? 0).toString()} icon={ShoppingBag} color="blue" />
        <KPICard title="Avg Ticket" value={formatCurrency(kpis?.avg_ticket ?? 0)} icon={TrendingUp} color="purple" />
        <KPICard title="Covers" value={(kpis?.cover_count ?? 0).toString()} subtitle="Guests served" icon={Users} color="amber" />
      </div>

      {/* Prime Cost Banner */}
      <div className={cn('rounded-xl p-4 flex items-center gap-6', primeCostPct > 65 ? 'bg-red-50 border border-red-200' : primeCostPct > 55 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200')}>
        <Target className={cn('h-6 w-6 shrink-0', primeCostPct > 65 ? 'text-red-500' : primeCostPct > 55 ? 'text-amber-500' : 'text-green-500')} />
        <div className="grid grid-cols-3 gap-6 w-full text-center">
          <div>
            <p className="text-sm text-muted-foreground">Food Cost %</p>
            <p className={cn('text-2xl font-bold', foodCostPct > 35 ? 'text-red-600' : foodCostPct > 30 ? 'text-amber-600' : 'text-green-600')}>{foodCostPct.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Target: &lt;30%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Labor Cost %</p>
            <p className={cn('text-2xl font-bold', laborCostPct > 35 ? 'text-red-600' : laborCostPct > 30 ? 'text-amber-600' : 'text-green-600')}>{laborCostPct.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Target: &lt;30%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Prime Cost</p>
            <p className={cn('text-2xl font-bold', primeCostPct > 65 ? 'text-red-600' : primeCostPct > 55 ? 'text-amber-600' : 'text-green-600')}>{primeCostPct.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Target: &lt;60%</p>
          </div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} dot={false} name="Revenue" />
              <Line type="monotone" dataKey="cogs" stroke="#EF4444" strokeWidth={2} dot={false} name="COGS" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Order Types</h3>
          {kpis?.order_types?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={kpis.order_types} dataKey="revenue" nameKey="type" cx="50%" cy="50%" outerRadius={70} label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}>
                  {kpis.order_types.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Top Menu Items by Revenue</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topItems.slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Menu Item Profitability</h3>
          <div className="space-y-3">
            {topItems.slice(0, 8).map((item: any) => {
              const margin = item.avg_margin ?? 0
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm truncate">{item.name}</span>
                      <span className={cn('text-xs font-medium ml-2', margin > 60 ? 'text-green-600' : margin > 40 ? 'text-amber-600' : 'text-red-600')}>
                        {margin.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', margin > 60 ? 'bg-green-500' : margin > 40 ? 'bg-amber-500' : 'bg-red-500')}
                        style={{ width: `${Math.min(margin, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{item.orders_count ?? 0} sold</span>
                </div>
              )
            })}
            {topItems.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">No data yet</div>}
          </div>
        </div>
      </div>

      {/* Customer insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Customer Insights</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Customers</span>
              <span className="font-bold">{customerInsights?.total_customers ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">New This Month</span>
              <span className="font-bold text-green-600">+{customerInsights?.new_customers_month ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Returning Rate</span>
              <span className="font-bold">{(customerInsights?.returning_rate ?? 0).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Avg Lifetime Value</span>
              <span className="font-bold">{formatCurrency(customerInsights?.avg_ltv ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Avg Rating</span>
              <span className="font-bold text-amber-500">{(customerInsights?.avg_rating ?? 0).toFixed(1)} ★</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-card border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Hourly Sales Heatmap</h3>
          {kpis?.hourly_sales?.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={kpis.hourly_sales}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}:00`} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(h) => `${h}:00`} />
                <Bar dataKey="revenue" fill="#3B82F6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-36 flex items-center justify-center text-muted-foreground text-sm">No hourly data for this period</div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-muted-foreground">Peak Hour</p>
              <p className="font-bold">{kpis?.peak_hour ? `${kpis.peak_hour}:00` : '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Busiest Day</p>
              <p className="font-bold">{kpis?.busiest_day ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Avg Daily Revenue</p>
              <p className="font-bold">{formatCurrency(kpis?.avg_daily_revenue ?? 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory usage */}
      {foodCostData?.top_ingredients?.length > 0 && (
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Top Ingredient Costs</h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {foodCostData.top_ingredients.map((ing: any) => (
              <div key={ing.id} className="text-center p-3 bg-muted rounded-xl">
                <p className="font-bold text-red-600">{formatCurrency(ing.total_cost)}</p>
                <p className="text-sm font-medium mt-0.5 truncate">{ing.name}</p>
                <p className="text-xs text-muted-foreground">{ing.quantity_used} {ing.unit}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
