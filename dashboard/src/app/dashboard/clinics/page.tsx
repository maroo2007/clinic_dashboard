'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { toast } from 'sonner'
import { Plus, Search, Building2, Loader2, X, Users, CalendarDays, MessageSquare } from 'lucide-react'
import type { Clinic } from '@/lib/types'

function AddClinicModal({ open, onClose, onSaved }: {
  open: boolean; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', user_password: '', whatsapp_instance_name: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm({ name: '', email: '', phone: '', user_password: '', whatsapp_instance_name: '' })
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/clinics', form)
      toast.success('Clinic created')
      onSaved()
      onClose()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create clinic')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm text-white bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all'
  const labelCls = 'block text-xs font-medium text-zinc-400 mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-white">Create Clinic</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Clinic name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Bright Smiles Dental" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Clinic email (login email)</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="clinic@dentaflow.com" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Login password (min 8 chars)</label>
            <input type="password" value={form.user_password} onChange={e => setForm(f => ({ ...f, user_password: e.target.value }))}
              placeholder="••••••••" minLength={8} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Phone (optional)</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+201001234567" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>WhatsApp instance name (optional)</label>
            <input value={form.whatsapp_instance_name} onChange={e => setForm(f => ({ ...f, whatsapp_instance_name: e.target.value }))}
              placeholder="whatsapp-clinic-c" className={inputCls} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 border border-zinc-700 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white transition-colors">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Clinic
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ClinicsPage() {
  const { user } = useAuthStore()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchClinics = useCallback(async () => {
    try {
      const res = await api.get('/clinics')
      setClinics(res.data.data ?? [])
    } catch (err) {
      console.error('[Clinics] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchClinics() }, [fetchClinics])

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-zinc-500">Access restricted to Super Admin.</p>
      </div>
    )
  }

  const filtered = clinics.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Clinics</h1>
          <p className="text-zinc-500 text-sm mt-1">{clinics.length} registered clinics</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Add Clinic
        </button>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clinics…"
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-zinc-400 font-medium">No clinics found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(clinic => (
            <div key={clinic.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 hover:border-zinc-700 hover:bg-zinc-900 transition-all">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-blue-600/15 border border-blue-600/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{clinic.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{clinic.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center">
                  <p className="text-base font-bold text-white">{clinic._count?.patients ?? 0}</p>
                  <p className="text-xs text-zinc-500 flex items-center justify-center gap-1 mt-0.5">
                    <Users className="w-3 h-3" />Patients
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-white">{clinic._count?.appointments ?? 0}</p>
                  <p className="text-xs text-zinc-500 flex items-center justify-center gap-1 mt-0.5">
                    <CalendarDays className="w-3 h-3" />Appts
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-white">{clinic._count?.messages ?? 0}</p>
                  <p className="text-xs text-zinc-500 flex items-center justify-center gap-1 mt-0.5">
                    <MessageSquare className="w-3 h-3" />Msgs
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 space-y-1">
                {clinic.phone && (
                  <p className="text-xs text-zinc-500">{clinic.phone}</p>
                )}
                {clinic.whatsapp_instance_name && (
                  <p className="text-xs text-zinc-500">
                    WA: <span className="text-zinc-300">{clinic.whatsapp_instance_name}</span>
                  </p>
                )}
                <p className="text-xs text-zinc-600">
                  Created {new Date(clinic.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddClinicModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={fetchClinics} />
    </div>
  )
}
