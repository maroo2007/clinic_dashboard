'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { connectSocket, disconnectSocket } from '@/lib/socket'
import {
  LayoutDashboard, CalendarDays, MessageSquare,
  Users, Stethoscope, Building2, LogOut, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard',              label: 'Overview',      icon: LayoutDashboard, exact: true },
  { href: '/dashboard/appointments', label: 'Appointments',  icon: CalendarDays },
  { href: '/dashboard/messages',     label: 'Messages',      icon: MessageSquare },
  { href: '/dashboard/patients',     label: 'Patients',      icon: Users },
  { href: '/dashboard/doctors',      label: 'Doctors',       icon: Stethoscope },
]

const ADMIN_NAV = [
  { href: '/dashboard/clinics', label: 'Clinics', icon: Building2 },
]

function NavLink({ href, label, icon: Icon, exact, pathname }: {
  href: string; label: string; icon: React.ElementType
  exact?: boolean; pathname: string
}) {
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
        active
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
    </Link>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, token, isAuthenticated, isLoading, initFromStorage, clearAuth } = useAuthStore()

  useEffect(() => {
    initFromStorage()
  }, [initFromStorage])

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace('/login')
      } else if (token) {
        connectSocket(token)
      }
    }
  }, [isLoading, isAuthenticated, token, router])

  const handleSignOut = () => {
    disconnectSocket()
    clearAuth()
    router.replace('/login')
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#09090b' }}>
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'U'
  const roleLabel = isSuperAdmin ? 'Super Admin' : user?.clinic_name ?? 'Clinic'

  return (
    <div className="flex min-h-screen" style={{ background: '#09090b' }}>
      <aside className="w-60 shrink-0 flex flex-col border-r border-zinc-800" style={{ background: '#111113' }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">DentaFlow</p>
            <p className="text-zinc-500 text-xs truncate">Clinic Dashboard</p>
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(item => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}

          {isSuperAdmin && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider">Admin</p>
              </div>
              {ADMIN_NAV.map(item => (
                <NavLink key={item.href} {...item} pathname={pathname} />
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-zinc-800 space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-600/40 flex items-center justify-center shrink-0">
              <span className="text-blue-400 text-xs font-semibold">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-zinc-300 text-xs font-medium truncate">{user?.email ?? '—'}</p>
              <p className="text-zinc-600 text-xs truncate">{roleLabel}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
