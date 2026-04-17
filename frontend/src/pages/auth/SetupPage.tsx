import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/api/client'
import toast from 'react-hot-toast'
import { ChefHat } from 'lucide-react'

export default function SetupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    restaurant_name: '',
    restaurant_slug: '',
    owner_email: '',
    owner_password: '',
    owner_first_name: '',
    owner_last_name: '',
    timezone: 'America/New_York',
    currency: 'USD',
    tax_rate: 8.5,
  })

  const update = (key: string, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/setup', form)
      toast.success('Restaurant created! Please log in.')
      navigate('/login')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <ChefHat className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Set Up Your Restaurant</h1>
          <p className="text-slate-400 mt-2">Takes about 2 minutes</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Restaurant Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Restaurant Name</label>
                <input value={form.restaurant_name} onChange={(e) => update('restaurant_name', e.target.value)} required className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="The Great Kitchen" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">URL Slug</label>
                <input value={form.restaurant_slug} onChange={(e) => update('restaurant_slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))} required className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="great-kitchen" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Tax Rate (%)</label>
                <input type="number" step="0.1" value={form.tax_rate} onChange={(e) => update('tax_rate', parseFloat(e.target.value))} className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Currency</label>
                <select value={form.currency} onChange={(e) => update('currency', e.target.value)} className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD (CA$)</option>
                </select>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-white pt-2">Owner Account</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">First Name</label>
                <input value={form.owner_first_name} onChange={(e) => update('owner_first_name', e.target.value)} required className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
                <input value={form.owner_last_name} onChange={(e) => update('owner_last_name', e.target.value)} required className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input type="email" value={form.owner_email} onChange={(e) => update('owner_email', e.target.value)} required className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <input type="password" value={form.owner_password} onChange={(e) => update('owner_password', e.target.value)} required minLength={8} className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors mt-4">
              {loading ? 'Creating...' : 'Create Restaurant'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
