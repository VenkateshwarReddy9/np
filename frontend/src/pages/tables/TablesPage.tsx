import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import { Plus, Users, Clock, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface TableSection {
  id: string
  name: string
  color: string
}

interface RestaurantTable {
  id: string
  name: string
  capacity: number
  status: 'available' | 'occupied' | 'reserved' | 'cleaning' | 'inactive'
  section_id: string | null
  pos_x: number
  pos_y: number
  shape: 'square' | 'round' | 'rectangle'
  current_order_id?: string | null
}

const STATUS_CONFIG = {
  available: { label: 'Available', color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-300' },
  occupied: { label: 'Occupied', color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-300' },
  reserved: { label: 'Reserved', color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50 border-blue-300' },
  cleaning: { label: 'Cleaning', color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-300' },
  inactive: { label: 'Inactive', color: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50 border-gray-300' },
}

function TableCard({ table, onClick }: { table: RestaurantTable; onClick: () => void }) {
  const cfg = STATUS_CONFIG[table.status]
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative border-2 rounded-xl p-4 text-left transition-all hover:scale-105 hover:shadow-md',
        cfg.bg,
        table.shape === 'round' ? 'rounded-full aspect-square flex flex-col items-center justify-center' : ''
      )}
    >
      <div className={cn('absolute top-2 right-2 w-2.5 h-2.5 rounded-full', cfg.color)} />
      <p className="font-bold text-sm">{table.name}</p>
      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
        <Users className="h-3 w-3" />
        <span>{table.capacity}</span>
      </div>
      <span className={cn('text-xs font-medium mt-1.5', cfg.text)}>{cfg.label}</span>
    </button>
  )
}

function TableDetailModal({
  table,
  onClose,
  onStatusChange,
}: {
  table: RestaurantTable
  onClose: () => void
  onStatusChange: (status: string) => void
}) {
  const cfg = STATUS_CONFIG[table.status]
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{table.name}</h2>
          <span className={cn('text-xs font-semibold px-3 py-1 rounded-full', cfg.bg, cfg.text)}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Users className="h-4 w-4" />
          <span>Seats {table.capacity}</span>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Set Status</p>
          {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((s) => (
            <button
              key={s}
              onClick={() => { onStatusChange(s); onClose() }}
              disabled={table.status === s}
              className={cn(
                'w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors',
                table.status === s
                  ? 'opacity-40 cursor-not-allowed bg-muted border-border'
                  : 'hover:bg-muted border-border'
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', STATUS_CONFIG[s].color)} />
                {STATUS_CONFIG[s].label}
              </div>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-4 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">
          Close
        </button>
      </div>
    </div>
  )
}

function AddTableModal({ sections, onClose, onSaved }: { sections: TableSection[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', capacity: 4, section_id: sections[0]?.id || '', shape: 'square' as const })
  const [loading, setLoading] = useState(false)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/tables', form)
      toast.success('Table created')
      onSaved()
    } catch {
      toast.error('Failed to create table')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-xl font-bold mb-5">Add Table</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Table Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Table 1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Capacity</label>
              <input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Shape</label>
              <select value={form.shape} onChange={(e) => setForm({ ...form, shape: e.target.value as any })}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="square">Square</option>
                <option value="round">Round</option>
                <option value="rectangle">Rectangle</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Section</label>
            <select value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })}
              className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {loading ? 'Saving...' : 'Add Table'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TablesPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const { on } = useWebSocket(user?.restaurant_id)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null)
  const [showAddTable, setShowAddTable] = useState(false)

  const { data: sections = [] } = useQuery<TableSection[]>({
    queryKey: ['table-sections'],
    queryFn: () => api.get('/tables/sections').then((r) => r.data),
  })

  const { data: tables = [] } = useQuery<RestaurantTable[]>({
    queryKey: ['tables'],
    queryFn: () => api.get('/tables').then((r) => r.data),
    refetchInterval: 30000,
  })

  // Listen for real-time table status updates
  useState(() => {
    const off = on('table.status', () => qc.invalidateQueries({ queryKey: ['tables'] }))
    return off
  })

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/tables/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Table status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const filteredTables = selectedSection
    ? tables.filter((t) => t.section_id === selectedSection)
    : tables

  const stats = {
    available: tables.filter((t) => t.status === 'available').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 border-r bg-muted/30 p-4 space-y-1 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sections</h2>
          <button
            onClick={() => setSelectedSection(null)}
            className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', !selectedSection ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >
            All Sections
          </button>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSection(s.id)}
              className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 mt-1', selectedSection === s.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </button>
          ))}
        </div>

        <div className="pt-4 border-t space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Live Summary</p>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>{stats.available} Available</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-red-500" />
            <span>{stats.occupied} Occupied</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-blue-500" />
            <span>{stats.reserved} Reserved</span>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Floor Plan</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{tables.length} tables · Click a table to update status</p>
          </div>
          <button
            onClick={() => setShowAddTable(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Add Table
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {sections.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">No sections yet</p>
              <p className="text-sm mt-1">Tables will appear here once sections are created</p>
            </div>
          ) : (
            <div className="space-y-8">
              {(selectedSection ? sections.filter((s) => s.id === selectedSection) : sections).map((section) => {
                const sectionTables = filteredTables.filter((t) => t.section_id === section.id)
                return (
                  <div key={section.id}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: section.color }} />
                      <h3 className="font-semibold">{section.name}</h3>
                      <span className="text-xs text-muted-foreground">({sectionTables.length} tables)</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                      {sectionTables.map((table) => (
                        <TableCard key={table.id} table={table} onClick={() => setSelectedTable(table)} />
                      ))}
                      {sectionTables.length === 0 && (
                        <div className="col-span-full text-sm text-muted-foreground py-4">No tables in this section</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {selectedTable && (
        <TableDetailModal
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
          onStatusChange={(status) => updateStatus({ id: selectedTable.id, status })}
        />
      )}
      {showAddTable && (
        <AddTableModal
          sections={sections}
          onClose={() => setShowAddTable(false)}
          onSaved={() => { setShowAddTable(false); qc.invalidateQueries({ queryKey: ['tables'] }) }}
        />
      )}
    </div>
  )
}
