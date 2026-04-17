import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  LayoutDashboard, ShoppingCart, Monitor, BookOpen, Users,
  TableIcon, Calendar, Package, Clock, TrendingUp, Receipt,
  Globe, Settings, LogOut, ChefHat, Bell, Wifi, WifiOff,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['owner', 'manager'] },
  { to: '/pos', icon: ShoppingCart, label: 'POS Terminal', roles: ['owner', 'manager', 'cashier', 'waiter'] },
  { to: '/kds', icon: Monitor, label: 'Kitchen Display', roles: ['owner', 'manager', 'kitchen'] },
  { to: '/menu', icon: BookOpen, label: 'Menu', roles: ['owner', 'manager'] },
  { to: '/tables', icon: TableIcon, label: 'Tables', roles: ['owner', 'manager', 'waiter', 'cashier'] },
  { to: '/reservations', icon: Calendar, label: 'Reservations', roles: ['owner', 'manager', 'waiter'] },
  { to: '/inventory', icon: Package, label: 'Inventory', roles: ['owner', 'manager'] },
  { to: '/staff', icon: Users, label: 'Staff', roles: ['owner', 'manager'] },
  { to: '/customers', icon: Users, label: 'Customers', roles: ['owner', 'manager', 'cashier'] },
  { to: '/analytics', icon: TrendingUp, label: 'Analytics', roles: ['owner', 'manager'] },
  { to: '/accounting', icon: Receipt, label: 'Accounting', roles: ['owner'] },
  { to: '/online-ordering', icon: Globe, label: 'Online Ordering', roles: ['owner', 'manager'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ['owner'] },
]

export default function AppShell() {
  const { user, logout, hasRole } = useAuthStore()
  const navigate = useNavigate()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const visibleNav = navItems.filter((item) => hasRole(...item.roles))

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className={cn(
        'flex flex-col border-r bg-slate-900 text-slate-100 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-slate-700">
          <ChefHat className="h-7 w-7 text-blue-400 shrink-0" />
          {!collapsed && <span className="font-bold text-lg tracking-tight">Restaurant OS</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white',
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-700 p-3 space-y-2">
          <div className={cn('flex items-center gap-2 px-2 py-1', collapsed && 'justify-center')}>
            {isOnline
              ? <Wifi className="h-4 w-4 text-green-400" />
              : <WifiOff className="h-4 w-4 text-red-400 animate-pulse" />}
            {!collapsed && (
              <span className={cn('text-xs', isOnline ? 'text-green-400' : 'text-red-400')}>
                {isOnline ? 'Online' : 'Offline — orders queued'}
              </span>
            )}
          </div>
          {!collapsed && user && (
            <div className="px-2 text-xs text-slate-400">
              <div className="font-medium text-slate-200">{user.first_name} {user.last_name}</div>
              <div className="capitalize">{user.role}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors',
              collapsed && 'justify-center',
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
