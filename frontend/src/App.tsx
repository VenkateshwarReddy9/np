import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import AppShell from '@/components/layout/AppShell'

// Pages
import LoginPage from '@/pages/auth/LoginPage'
import SetupPage from '@/pages/auth/SetupPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import POSPage from '@/pages/pos/POSPage'
import KDSPage from '@/pages/kds/KDSPage'
import MenuPage from '@/pages/menu/MenuPage'
import TablesPage from '@/pages/tables/TablesPage'
import ReservationsPage from '@/pages/reservations/ReservationsPage'
import InventoryPage from '@/pages/inventory/InventoryPage'
import StaffPage from '@/pages/staff/StaffPage'
import CustomersPage from '@/pages/customers/CustomersPage'
import AnalyticsPage from '@/pages/analytics/AnalyticsPage'
import AccountingPage from '@/pages/accounting/AccountingPage'
import OnlineOrderingPage from '@/pages/online-ordering/OnlineOrderingPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import PublicMenuPage from '@/pages/online-ordering/PublicMenuPage'

function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, hasRole } = useAuthStore()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (roles && !hasRole(...roles)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/menu/:slug" element={<PublicMenuPage />} />

        {/* KDS — full-screen, no shell */}
        <Route path="/kds" element={<RequireAuth roles={['owner', 'manager', 'kitchen']}><KDSPage /></RequireAuth>} />

        {/* App with sidebar shell */}
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/pos" element={<POSPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/tables" element={<TablesPage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/accounting" element={<AccountingPage />} />
          <Route path="/online-ordering" element={<OnlineOrderingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
