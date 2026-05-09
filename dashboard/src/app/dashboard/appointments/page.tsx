'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronRight, Plus, X, Loader2,
  Calendar, List, Clock, User, Stethoscope, FileText, Zap,
} from 'lucide-react'
import { cn, formatTime } from '@/lib/utils'
import type { Appointment, Doctor, Patient } from '@/lib/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const STATUS_COLOR: Record<string, string> = {
  scheduled:  'bg-blue-500/20 text-blue-300 border-blue-500/30',
  confirmed:  'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  completed:  'bg-green-500/20 text-green-300 border-green-500/30',
  no_show:    'bg-red-500/20 text-red-300 border-red-500/30',
  cancelled:  'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

const STATUS_DOT: Record<string, string> = {
  scheduled:  'bg-blue-400',
  confirmed:  'bg-cyan-400',
  completed:  'bg-green-400',
  no_show:    'bg-red-400',
  cancelled:  'bg-zinc-500',
}

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', STATUS_COLOR[status] ?? STATUS_COLOR.cancelled)}>
      {status.replace('_', ' ')}
    </span>
  )
}

interface ModalProps {
  open: boolean
  onClose: () => void
  appointment: Appointment | null
  doctors: Doctor[]
  patients: Patient[]
  onSaved: () => void
}

function AppointmentModal({ open, onClose, appointment, doctors, patients, onSaved }: ModalProps) {
  const isEdit = !!appointment
  const [form, setForm] = useState({
    patient_id: '',
    doctor_id: '',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '09:00',
    status: 'scheduled' as string,
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (appointment) {
      setForm({
        patient_id: String(appointment.patient_id ?? ''),
        doctor_id: String(appointment.doctor_id ?? ''),
        appointment_date: appointment.appointment_date,
        appointment_time: appointment.appointment_time.slice(0, 5),
        status: appointment.status,
        notes: appointment.notes ?? '',
      })
    } else {
      setForm(f => ({ ...f, patient_id: '', doctor_id: '', notes: '' }))
    }
  }, [appointment, open])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        patient_id: form.patient_id ? parseInt(form.patient_id) : undefined,
        doctor_id: form.doctor_id ? parseInt(form.doctor_id) : undefined,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        status: form.status,
        notes: form.notes || null,
      }

      if (isEdit) {
        await api.put(`/appointments/${appointment!.id}`, payload)
        toast.success('Appointment updated')
      } else {
        await api.post('/appointments', payload)
        toast.success('Appointment created')
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to save'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!appointment) return
    if (!confirm('Cancel this appointment?')) return
    try {
      await api.put(`/appointments/${appointment.id}`, { status: 'cancelled' })
      toast.success('Appointment cancelled')
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to cancel')
    }
  }

  if (!open) return null

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm text-white bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all'
  const labelCls = 'block text-xs font-medium text-zinc-400 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Appointment' : 'New Appointment'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={labelCls}><User className="inline w-3 h-3 mr-1" />Patient</label>
            <select value={form.patient_id} onChange={e => set('patient_id', e.target.value)} required className={inputCls}>
              <option value="">Select patient…</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name} · {p.phone}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}><Stethoscope className="inline w-3 h-3 mr-1" />Doctor</label>
            <select value={form.doctor_id} onChange={e => set('doctor_id', e.target.value)} className={inputCls}>
              <option value="">No doctor assigned</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}{d.specialty ? ` · ${d.specialty}` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}><Calendar className="inline w-3 h-3 mr-1" />Date</label>
              <input type="date" value={form.appointment_date} onChange={e => set('appointment_date', e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}><Clock className="inline w-3 h-3 mr-1" />Time</label>
              <input type="time" value={form.appointment_time} onChange={e => set('appointment_time', e.target.value)} required className={inputCls} />
            </div>
          </div>
          {isEdit && (
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="no_show">No Show</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}><FileText className="inline w-3 h-3 mr-1" />Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={cn(inputCls, 'resize-none')} />
          </div>

          <div className="flex gap-2 pt-1">
            {isEdit && (
              <button type="button" onClick={handleDelete}
                className="px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors">
                Cancel appt
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 border border-zinc-700 transition-colors">
              Close
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white transition-colors">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MonthCalendar({ year, month, appointments, selectedDate, onDateSelect }: {
  year: number; month: number; appointments: Appointment[]
  selectedDate: string | null; onDateSelect: (d: string) => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const firstDOW = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(firstDOW).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const apptsByDate = useMemo(() => {
    const m: Record<string, Appointment[]> = {}
    appointments.forEach(a => {
      const d = a.appointment_date.split('T')[0]
      if (!m[d]) m[d] = []
      m[d].push(a)
    })
    return m
  }, [appointments])

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-zinc-800">
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-zinc-500">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="border-b border-r border-zinc-800/40 h-20" />
          const dateStr = toDateStr(year, month, day)
          const dayAppts = apptsByDate[dateStr] ?? []
          const isToday = dateStr === today
          const isSelected = dateStr === selectedDate
          return (
            <button key={i} onClick={() => onDateSelect(dateStr)}
              className={cn(
                'border-b border-r border-zinc-800/40 h-20 p-1.5 text-left transition-colors hover:bg-zinc-800/50',
                isSelected && 'bg-blue-600/15 border-blue-600/30',
              )}>
              <span className={cn(
                'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs mb-1',
                isToday && !isSelected && 'bg-blue-600 text-white font-bold',
                isSelected && 'bg-blue-500 text-white font-bold',
                !isToday && !isSelected && 'text-zinc-400',
              )}>{day}</span>
              <div className="flex flex-wrap gap-0.5">
                {dayAppts.slice(0, 3).map(a => (
                  <span key={a.id} className={cn('w-2 h-2 rounded-full', STATUS_DOT[a.status])} />
                ))}
                {dayAppts.length > 3 && <span className="text-zinc-600 text-xs">+{dayAppts.length - 3}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(now.toISOString().split('T')[0])
  const [view, setView] = useState<'calendar' | 'list'>('calendar')

  const [modalOpen, setModalOpen] = useState(false)
  const [editAppt, setEditAppt] = useState<Appointment | null>(null)

  const fetchData = useCallback(async () => {
    const start = `${viewYear}-${pad(viewMonth + 1)}-01`
    const endDay = new Date(viewYear, viewMonth + 1, 0).getDate()
    const end = `${viewYear}-${pad(viewMonth + 1)}-${pad(endDay)}`

    try {
      const [apptsRes, docsRes, patientsRes] = await Promise.all([
        api.get(`/appointments?from=${start}&to=${end}&limit=200`),
        api.get('/doctors'),
        api.get('/patients?limit=200'),
      ])
      setAppointments(apptsRes.data.data ?? [])
      setDoctors(docsRes.data.data ?? [])
      setPatients(patientsRes.data.data ?? [])
    } catch (err) {
      console.error('[Appointments] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [viewYear, viewMonth])

  useEffect(() => { fetchData() }, [fetchData])

  // Socket.io: realtime appointment updates
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onNew = (appt: Appointment) => {
      setAppointments(prev => {
        if (prev.find(a => a.id === appt.id)) return prev
        return [...prev, appt]
      })
      toast.success(`New appointment: ${appt.patient?.name ?? 'Unknown'}`, { duration: 4000 })
    }
    const onUpdated = (appt: Appointment) => {
      setAppointments(prev => prev.map(a => a.id === appt.id ? appt : a))
    }
    const onDeleted = ({ id }: { id: number }) => {
      setAppointments(prev => prev.filter(a => a.id !== id))
    }

    socket.on('appointment:new', onNew)
    socket.on('appointment:updated', onUpdated)
    socket.on('appointment:deleted', onDeleted)

    return () => {
      socket.off('appointment:new', onNew)
      socket.off('appointment:updated', onUpdated)
      socket.off('appointment:deleted', onDeleted)
    }
  }, [])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const selectedAppts = selectedDate
    ? appointments.filter(a => a.appointment_date.split('T')[0] === selectedDate)
    : []

  const openCreate = () => { setEditAppt(null); setModalOpen(true) }
  const openEdit   = (a: Appointment) => { setEditAppt(a); setModalOpen(true) }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Appointments</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-zinc-500 text-sm">Manage patient scheduling</p>
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          </div>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          New Appointment
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold text-white min-w-36 text-center">{MONTHS[viewMonth]} {viewYear}</h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-0.5">
          {(['calendar', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                view === v ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200')}>
              {v === 'calendar' ? <Calendar className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        </div>
      ) : view === 'calendar' ? (
        <div className="space-y-5">
          <MonthCalendar year={viewYear} month={viewMonth} appointments={appointments}
            selectedDate={selectedDate} onDateSelect={setSelectedDate} />

          {selectedDate && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
              <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <span className="text-xs text-zinc-500">{selectedAppts.length} appointment{selectedAppts.length !== 1 ? 's' : ''}</span>
              </div>
              {selectedAppts.length === 0 ? (
                <div className="px-5 py-8 text-center text-zinc-500 text-sm">
                  No appointments · <button onClick={openCreate} className="text-blue-400 hover:text-blue-300">Schedule one</button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {selectedAppts.map(appt => (
                    <div key={appt.id} onClick={() => openEdit(appt)}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-800/40 cursor-pointer transition-colors">
                      <div className="text-center w-12 shrink-0">
                        <p className="text-sm font-semibold text-white">{formatTime(appt.appointment_time)}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{appt.patient?.name ?? '—'}</p>
                        <p className="text-xs text-zinc-500">{appt.doctor?.name ?? 'No doctor'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {appt.source === 'whatsapp' && <span title="WhatsApp booking"><Zap className="w-3.5 h-3.5 text-green-400" /></span>}
                        <StatusBadge status={appt.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Patient', 'Doctor', 'Date', 'Time', 'Source', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {appointments.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">No appointments this month</td></tr>
              ) : (
                appointments.map(appt => (
                  <tr key={appt.id} onClick={() => openEdit(appt)} className="hover:bg-zinc-800/30 cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{appt.patient?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-300">{appt.doctor?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-300">{appt.appointment_date.split('T')[0]}</td>
                    <td className="px-4 py-3 text-zinc-300">{formatTime(appt.appointment_time)}</td>
                    <td className="px-4 py-3">
                      {appt.source === 'whatsapp'
                        ? <span className="flex items-center gap-1 text-green-400 text-xs"><Zap className="w-3 h-3" />WhatsApp</span>
                        : <span className="text-zinc-500 text-xs capitalize">{appt.source ?? 'manual'}</span>
                      }
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={appt.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <AppointmentModal open={modalOpen} onClose={() => setModalOpen(false)}
        appointment={editAppt} doctors={doctors} patients={patients} onSaved={fetchData} />
    </div>
  )
}
