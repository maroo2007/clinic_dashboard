'use client'
import { create } from 'zustand'
import type { AuthUser } from '@/lib/types'

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean

  setAuth: (user: AuthUser, token: string) => void
  clearAuth: () => void
  initFromStorage: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      // Also set a cookie so Next.js middleware can protect server routes
      document.cookie = `auth_token=${token}; path=/; max-age=86400; SameSite=Lax`
    }
    set({ user, token, isAuthenticated: true, isLoading: false })
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // Clear auth cookie
      document.cookie = 'auth_token=; path=/; max-age=0'
    }
    set({ user: null, token: null, isAuthenticated: false, isLoading: false })
  },

  initFromStorage: () => {
    if (typeof window === 'undefined') {
      set({ isLoading: false })
      return
    }
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as AuthUser
        set({ user, token, isAuthenticated: true, isLoading: false })
        return
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    set({ isLoading: false })
  },
}))
