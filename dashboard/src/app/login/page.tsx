'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { connectSocket } from '@/lib/socket'
import type { AuthUser } from '@/lib/types'
import { AlertCircle, Loader2, Building2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post<{ success: boolean; data: { token: string; user: AuthUser }; error?: string }>(
        '/auth/login',
        { email, password }
      )
      if (!res.data.success) throw new Error(res.data.error || 'Login failed')
      const { token, user } = res.data.data
      setAuth(user, token)
      connectSocket(token)
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error || (err as { message?: string })?.message || 'Login failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: '#09090b' }}
    >
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 bg-zinc-950 border-r border-zinc-800 p-12">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">Apex Automations</span>
        </div>

        <div>
          <blockquote className="text-zinc-300 text-xl font-light leading-relaxed mb-6">
            "The platform that turned our chaotic appointment book into a seamless, automated experience."
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-300">
              BS
            </div>
            <div>
              <p className="text-white text-sm font-medium">Bright Smile Dental</p>
              <p className="text-zinc-500 text-xs">Cairo, Egypt</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-zinc-800">
          {[['3+', 'Clinics'], ['500+', 'Patients'], ['99%', 'Uptime']].map(([val, label]) => (
            <div key={label}>
              <p className="text-white font-bold text-2xl">{val}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8 justify-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold">Apex Automations</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="text-zinc-400 text-sm mt-1">Sign in to your clinic dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@clinic.com"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white placeholder-zinc-500 bg-zinc-900 border border-zinc-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white placeholder-zinc-500 bg-zinc-900 border border-zinc-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                required
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 text-red-400 text-sm bg-red-500/8 border border-red-500/20 rounded-lg px-3.5 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm mt-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-zinc-600 mt-8">
            Apex Automations © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
