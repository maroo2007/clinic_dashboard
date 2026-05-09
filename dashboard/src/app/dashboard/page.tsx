'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/auth'
import {
  CalendarDays, MessageSquare, Users, Stethoscope,
  TrendingUp, Clock, CheckCircle2, XCircle, Zap,
} from 'lucide-react'
import { formatTime } from '@/lib/utils'
import type { DashboardStats, Appointment } from '@/lib/types'

const STATUS_DOT: Record<string, string> = {
  scheduled:  'bg-blue-500',
  confirmed:  'bg-cyan-500',
  completed:  'bg-green-500',
  no_show:    'bg-red-500',
  cancelled:  'bg-zinc-500',
}

function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: number | string; icon: React.ElementType
  color: string; sub?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-zinc-400">{label}</p>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}

function SkeletonCard() {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 h-28 animate-pulse" />
}

export default function OverviewPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentMessages, setRecentMessages] = useState<{ phone: string; message: string; direction: string; timestamp: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [liveAppts, setLiveAppts] = useState<Appointment[]>([])

  const loadStats = useCallback(async () => {
    try {
      const [statsRes, msgsRes] = await Promise.all([
        api.get<{ success: boolean; data: DashboardStats }>('/appointments/stats'),
        api.get<{ success: boolean; data: { phone: string; message: string; direction: string; timestamp: string }[]; pagination: object }>(
          '/messages?limit=5'
        ),
      ])
      setStats(statsRes.data.data)
      setLiveAppts(statsRes.data.data.today_appointments ?? [])
      setRecentMessages(msgsRes.data.data ?? [])
    } catch (err) {
      console.error('[Overview] Load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // Realtime: append new appointments from socket
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onNewAppt = (appt: Appointment) => {
      setLiveAppts((prev) => [appt, ...prev].slice(0, 10))
      setStats((s) => s ? { ...s, today_total: s.today_total + 1, today_scheduled: s.today_scheduled + 1 } : s)
    }

    socket.on('appointment:new', onNewAppt)
    return () => { socket.off('appointment:new', onNewAppt) }
  }, [])

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-zinc-500 text-sm mt-1">{today}</p>
        </div>
        {user?.role === 'SUPER_ADMIN' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600/15 border border-blue-600/30">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-medium text-blue-400">Super Admin</span>
          </div>
        )}
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Today's Appointments"
            value={stats?.today_total ?? 0}
            icon={CalendarDays}
            color="bg-blue-500/15 text-blue-400"
            sub={`${stats?.today_scheduled ?? 0} scheduled · ${stats?.today_completed ?? 0} done`}
          />
          <StatCard
            label="Total Patients"
            value={stats?.total_patients ?? 0}
            icon={Users}
            color="bg-violet-500/15 text-violet-400"
          />
          <StatCard
            label="Doctors"
            value={stats?.total_doctors ?? 0}
            icon={Stethoscope}
            color="bg-emerald-500/15 text-emerald-400"
          />
          <StatCard
            label="Total Messages"
            value={stats?.total_messages ?? 0}
            icon={MessageSquare}
            color="bg-orange-500/15 text-orange-400"
          />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's appointments */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-white">Today&apos;s Schedule</h2>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse ml-1" title="Live" />
            </div>
            <a href="/dashboard/appointments" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              View all →
            </a>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {loading ? (
              <div className="px-5 py-8 text-center text-zinc-500 text-sm">Loading…</div>
            ) : liveAppts.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">No appointments today</p>
              </div>
            ) : (
              liveAppts.map(appt => (
                <div key={appt.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/30 transition-colors">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[appt.status] ?? 'bg-zinc-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{appt.patient?.name ?? '—'}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {appt.doctor?.name ?? 'No doctor'} · {appt.source ?? 'manual'}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400 shrink-0">{formatTime(appt.appointment_time)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent messages */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-white">Recent Messages</h2>
            </div>
            <a href="/dashboard/messages" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              View all →
            </a>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {loading ? (
              <div className="px-5 py-8 text-center text-zinc-500 text-sm">Loading…</div>
            ) : recentMessages.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <XCircle className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">No messages yet</p>
              </div>
            ) : (
              recentMessages.map((msg, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3 hover:bg-zinc-800/30 transition-colors">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${msg.direction === 'inbound' ? 'bg-violet-500' : 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{(msg as { patient?: { name: string } }).patient?.name || msg.phone}</p>
                    <p className="text-xs text-zinc-500 truncate">{msg.message}</p>
                  </div>
                  <span className="text-xs text-zinc-600 shrink-0 whitespace-nowrap">
                    {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
