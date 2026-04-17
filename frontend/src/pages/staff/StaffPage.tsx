import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Plus, Clock, Users, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'employees' | 'schedule' | 'timeclock' | 'payroll'

interface Employee {
  id: string
  user_id?: string
  first_name?: string
  last_name?: string
  name?: string
  position: string
  hourly_rate: number
  hire_date: string
  status: 'active' | 'inactive' | 'on_leave'
  phone?: string
}

interface Shift {
  id: string
  employee_id: string
  employee_name?: string
  role: string
  start_time: string
  end_time: string
  status: string
}

interface TimeEntry {
  id: string
  employee_id: string
  employee_name?: string
  clock_in: string
  clock_out?: string
  total_hours?: number
  overtime_hours?: number
}

interface PayrollPeriod {
  id: string
  start_date: string
  end_date: string
  status: 'open' | 'processing' | 'processed' | 'paid'
}

function AddEmployeeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', position: 'server', hourly_rate: 15,
    hire_date: new Date().toISOString().split('T')[0], phone: '', email: '', pin: ''
  })
  const [loading, setLoading] = useState(false)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/staff/employees', form)
      toast.success('Employee added')
      onSaved()
    } catch {
      toast.error('Failed to add employee')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-5">Add Employee</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">First Name</label>
              <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Last Name</label>
              <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Email (for login)</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Position</label>
              <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['server', 'bartender', 'host', 'busser', 'cook', 'line cook', 'prep cook', 'dishwasher', 'manager', 'cashier'].map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Hourly Rate ($)</label>
              <input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: parseFloat(e.target.value) })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Hire Date</label>
              <input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">POS PIN (4-digit)</label>
              <input maxLength={4} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {loading ? 'Saving...' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddShiftModal({ employees, onClose, onSaved }: { employees: Employee[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    employee_id: employees[0]?.id || '',
    role: 'server',
    start_time: '',
    end_time: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/staff/shifts', form)
      toast.success('Shift scheduled')
      onSaved()
    } catch {
      toast.error('Failed to schedule shift')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-xl font-bold mb-5">Schedule Shift</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Employee</label>
            <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name || `${emp.first_name} ${emp.last_name}`}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Role</label>
            <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Start</label>
              <input type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">End</label>
              <input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {loading ? 'Saving...' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function StaffPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('employees')
  const [showAddEmp, setShowAddEmp] = useState(false)
  const [showAddShift, setShowAddShift] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get('/staff/employees').then((r) => r.data),
  })

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + weekOffset * 7)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ['shifts', weekOffset],
    queryFn: () => {
      const start = weekDays[0].toISOString().split('T')[0]
      const end = weekDays[6].toISOString().split('T')[0]
      return api.get(`/staff/shifts?start_date=${start}&end_date=${end}`).then((r) => r.data)
    },
    enabled: tab === 'schedule',
  })

  const { data: timeEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ['time-entries'],
    queryFn: () => api.get('/staff/time-entries').then((r) => r.data),
    enabled: tab === 'timeclock',
  })

  const { data: payrollPeriods = [] } = useQuery<PayrollPeriod[]>({
    queryKey: ['payroll-periods'],
    queryFn: () => api.get('/staff/payroll/periods').then((r) => r.data),
    enabled: tab === 'payroll',
  })

  const { mutate: clockIn } = useMutation({
    mutationFn: (employeeId: string) => api.post('/staff/clock-in', { employee_id: employeeId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['time-entries'] }); toast.success('Clocked in') },
    onError: () => toast.error('Failed to clock in'),
  })

  const { mutate: clockOut } = useMutation({
    mutationFn: (employeeId: string) => api.post('/staff/clock-out', { employee_id: employeeId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['time-entries'] }); toast.success('Clocked out') },
    onError: () => toast.error('Failed to clock out'),
  })

  const { mutate: processPayroll } = useMutation({
    mutationFn: (periodId: string) => api.post(`/staff/payroll/${periodId}/process`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-periods'] }); toast.success('Payroll processed') },
    onError: () => toast.error('Failed to process payroll'),
  })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'employees', label: 'Employees' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'timeclock', label: 'Time Clock' },
    { key: 'payroll', label: 'Payroll' },
  ]

  const activeEmployees = employees.filter((e) => e.status === 'active')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <div className="flex gap-2">
            {tab === 'schedule' && (
              <button onClick={() => setShowAddShift(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
                <Plus className="h-4 w-4" /> Schedule Shift
              </button>
            )}
            {tab === 'employees' && (
              <button onClick={() => setShowAddEmp(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
                <Plus className="h-4 w-4" /> Add Employee
              </button>
            )}
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

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'employees' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {employees.map((emp) => {
              const name = emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
              return (
                <div key={emp.id} className="bg-card border rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{name}</p>
                      <p className="text-sm text-muted-foreground capitalize">{emp.position}</p>
                      <p className="text-sm font-medium text-blue-600 mt-1">{formatCurrency(emp.hourly_rate)}/hr</p>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', emp.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600')}>
                      {emp.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Hired {formatDate(emp.hire_date)}</p>
                </div>
              )
            })}
            {employees.length === 0 && (
              <div className="col-span-full text-center py-16 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No employees yet</p>
              </div>
            )}
          </div>
        )}

        {tab === 'schedule' && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setWeekOffset(weekOffset - 1)} className="p-2 border rounded-lg hover:bg-muted">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-medium text-sm">
                {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} —{' '}
                {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <button onClick={() => setWeekOffset(weekOffset + 1)} className="p-2 border rounded-lg hover:bg-muted">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button onClick={() => setWeekOffset(0)} className="px-3 py-1.5 border rounded-lg text-xs hover:bg-muted">Today</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm min-w-[700px]">
                <thead>
                  <tr>
                    <th className="text-left p-3 border font-medium text-muted-foreground w-32">Employee</th>
                    {weekDays.map((d) => (
                      <th key={d.toISOString()} className={cn('p-3 border text-center font-medium', d.toDateString() === new Date().toDateString() ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground')}>
                        <div>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className="text-xs">{d.getDate()}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeEmployees.map((emp) => {
                    const name = emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
                    return (
                      <tr key={emp.id}>
                        <td className="p-3 border font-medium">{name}</td>
                        {weekDays.map((d) => {
                          const dayShifts = shifts.filter((s) => {
                            const shiftDate = new Date(s.start_time).toDateString()
                            return s.employee_id === emp.id && shiftDate === d.toDateString()
                          })
                          return (
                            <td key={d.toISOString()} className="p-2 border text-center min-w-[100px]">
                              {dayShifts.map((s) => (
                                <div key={s.id} className="text-xs bg-blue-100 text-blue-800 rounded px-1.5 py-0.5 mb-0.5">
                                  {new Date(s.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </div>
                              ))}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  {activeEmployees.length === 0 && (
                    <tr><td colSpan={8} className="text-center p-8 text-muted-foreground border">No active employees</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'timeclock' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
              {activeEmployees.map((emp) => {
                const name = emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
                const isClockedIn = timeEntries.some((t) => t.employee_id === emp.id && !t.clock_out)
                return (
                  <div key={emp.id} className={cn('border rounded-xl p-4', isClockedIn ? 'border-green-300 bg-green-50' : '')}>
                    <p className="font-medium text-sm">{name}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{emp.position}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <div className={cn('w-2 h-2 rounded-full', isClockedIn ? 'bg-green-500' : 'bg-gray-400')} />
                      <span className="text-xs">{isClockedIn ? 'On clock' : 'Off clock'}</span>
                    </div>
                    <button
                      onClick={() => isClockedIn ? clockOut(emp.id) : clockIn(emp.id)}
                      className={cn('w-full mt-3 py-2 rounded-lg text-xs font-semibold transition-colors', isClockedIn ? 'bg-red-100 hover:bg-red-200 text-red-700' : 'bg-green-600 hover:bg-green-700 text-white')}
                    >
                      {isClockedIn ? 'Clock Out' : 'Clock In'}
                    </button>
                  </div>
                )
              })}
            </div>
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Recent Entries</h3>
            <div className="space-y-2">
              {timeEntries.slice(0, 20).map((entry) => (
                <div key={entry.id} className="bg-card border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{entry.employee_name || 'Employee'}</p>
                    <p className="text-xs text-muted-foreground">
                      In: {new Date(entry.clock_in).toLocaleString()} {entry.clock_out ? `→ Out: ${new Date(entry.clock_out).toLocaleString()}` : '— Still working'}
                    </p>
                  </div>
                  {entry.total_hours && (
                    <div className="text-right">
                      <p className="font-semibold text-sm">{entry.total_hours.toFixed(1)}h</p>
                      {entry.overtime_hours && entry.overtime_hours > 0 && (
                        <p className="text-xs text-amber-600">+{entry.overtime_hours.toFixed(1)}h OT</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'payroll' && (
          <div className="space-y-4">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => api.post('/staff/payroll/periods', { start_date: weekDays[0].toISOString().split('T')[0], end_date: weekDays[6].toISOString().split('T')[0] }).then(() => { qc.invalidateQueries({ queryKey: ['payroll-periods'] }); toast.success('Payroll period created') })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
              >
                <Plus className="h-4 w-4" /> New Period
              </button>
            </div>
            {payrollPeriods.map((period) => {
              const statusColor = { open: 'text-blue-600 bg-blue-50', processing: 'text-amber-600 bg-amber-50', processed: 'text-green-600 bg-green-50', paid: 'text-gray-600 bg-gray-50' }[period.status]
              return (
                <div key={period.id} className="bg-card border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{formatDate(period.start_date)} — {formatDate(period.end_date)}</p>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize mt-1 inline-block', statusColor)}>{period.status}</span>
                  </div>
                  {period.status === 'open' && (
                    <button onClick={() => processPayroll(period.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium">
                      <DollarSign className="h-4 w-4" /> Process
                    </button>
                  )}
                </div>
              )
            })}
            {payrollPeriods.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No payroll periods yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showAddEmp && <AddEmployeeModal onClose={() => setShowAddEmp(false)} onSaved={() => { setShowAddEmp(false); qc.invalidateQueries({ queryKey: ['employees'] }) }} />}
      {showAddShift && <AddShiftModal employees={activeEmployees} onClose={() => setShowAddShift(false)} onSaved={() => { setShowAddShift(false); qc.invalidateQueries({ queryKey: ['shifts'] }) }} />}
    </div>
  )
}
