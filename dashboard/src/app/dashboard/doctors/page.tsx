'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Search, Stethoscope, Loader2, Plus, X, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Doctor } from '@/lib/types'

const DAYS_SHORT: Record<string, string> = {
  sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
}

function AddDoctorModal({ open, onClose, onSaved }: {
  open: boolean; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({ name: '', specialty: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm({ name: '', specialty: '' })
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/doctors', form)
      toast.success('Doctor added')
      onSaved()
      onClose()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to add doctor')
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
          <h2 className="text-base font-semibold text-white">Add Doctor</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Full name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Dr. Ahmed Hassan" required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Specialty</label>
            <input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
              placeholder="General Dentistry" className={inputCls} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 border border-zinc-700 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white transition-colors">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Add Doctor
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchDoctors = useCallback(async () => {
    try {
      const res = await api.get('/doctors')
      setDoctors(res.data.data ?? [])
    } catch (err) {
      console.error('[Doctors] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDoctors() }, [fetchDoctors])

  const filtered = doctors.filter(d =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.specialty ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Doctors</h1>
          <p className="text-zinc-500 text-sm mt-1">{filtered.length} doctors</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Add Doctor
        </button>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search doctors…"
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Stethoscope className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-zinc-400 font-medium">No doctors found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doctor => (
            <div key={doctor.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 hover:border-zinc-700 hover:bg-zinc-900 transition-all">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600/25 to-blue-600/25 border border-emerald-600/20 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{doctor.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{doctor.specialty ?? 'General'}</p>
                </div>
              </div>

              {doctor.schedule && Object.keys(doctor.schedule).length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  {Object.entries(doctor.schedule).map(([day, hours]) => (
                    <span key={day} className="text-xs text-zinc-400">
                      {DAYS_SHORT[day] ?? day}
                      {Array.isArray(hours) && hours.length === 2
                        ? ` ${hours[0]}–${hours[1]}`
                        : ''}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-zinc-800">
                <p className="text-xs text-zinc-600">
                  Added {new Date(doctor.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddDoctorModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={fetchDoctors} />
    </div>
  )
}
