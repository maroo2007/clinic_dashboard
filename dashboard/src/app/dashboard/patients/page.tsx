'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { toast } from 'sonner'
import { Plus, Search, X, Loader2, Users, Phone, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Patient } from '@/lib/types'

const RISK_COLOR: Record<string, string> = {
  low:       'bg-green-500/15 text-green-400 border-green-500/25',
  medium:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  high:      'bg-orange-500/15 text-orange-400 border-orange-500/25',
  emergency: 'bg-red-500/15 text-red-400 border-red-500/25',
}

function AddPatientModal({ open, onClose, onSaved }: {
  open: boolean; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({ name: '', phone: '', notes: '', risk_level: 'low' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm({ name: '', phone: '', notes: '', risk_level: 'low' })
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/patients', form)
      toast.success('Patient added')
      onSaved()
      onClose()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to add patient')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm text-white bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-white">Add Patient</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Full name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ahmed Mohamed" required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Phone number</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="01234567890" required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Risk level</label>
            <select value={form.risk_level} onChange={e => setForm(f => ({ ...f, risk_level: e.target.value }))} className={inputCls}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className={cn(inputCls, 'resize-none')} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 border border-zinc-700 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white transition-colors">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Add Patient
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [page, setPage] = useState(1)

  const fetchPatients = useCallback(async (searchVal = search, pg = page) => {
    try {
      const params = new URLSearchParams({ limit: '50', page: String(pg) })
      if (searchVal) params.set('search', searchVal)
      const res = await api.get(`/patients?${params}`)
      setPatients(res.data.data ?? [])
      setTotal(res.data.pagination?.total ?? 0)
    } catch (err) {
      console.error('[Patients] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchPatients() }, [fetchPatients])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchPatients(search, 1) }, 400)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Socket.io: new patients appear instantly
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onNew = (patient: Patient) => {
      setPatients(prev => {
        if (prev.find(p => p.id === patient.id)) return prev
        return [patient, ...prev]
      })
      setTotal(t => t + 1)
    }

    socket.on('patient:new', onNew)
    return () => { socket.off('patient:new', onNew) }
  }, [])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Patients</h1>
          <p className="text-zinc-500 text-sm mt-1">{total} registered patients</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Add Patient
        </button>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        </div>
      ) : patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-zinc-400 font-medium mb-1">{search ? 'No matches found' : 'No patients yet'}</p>
          {!search && (
            <button onClick={() => setModalOpen(true)} className="text-sm text-blue-400 hover:text-blue-300 mt-1">
              Add your first patient →
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {patients.map(patient => (
            <div key={patient.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 bg-gradient-to-br from-blue-600/30 to-violet-600/30 text-blue-300 border border-blue-600/20">
                  {patient.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{patient.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-zinc-500 shrink-0" />
                    <p className="text-xs text-zinc-400 truncate">{patient.phone}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                {patient.risk_level && patient.risk_level !== 'low' ? (
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', RISK_COLOR[patient.risk_level] ?? '')}>
                    <AlertTriangle className="w-3 h-3" />
                    {patient.risk_level}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-600">Low risk</span>
                )}
                <p className="text-xs text-zinc-600">
                  {new Date(patient.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddPatientModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={() => fetchPatients(search, 1)} />
    </div>
  )
}
