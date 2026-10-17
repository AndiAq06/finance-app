import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError, ensureCsrf, setUnauthorizedHandler } from '@/lib/api'
import { configureFormatting } from '@/lib/format'
import type { Preferences, User } from '@/types'

interface MeResponse {
  user: User
  preferences: Preferences
}

interface AuthContextValue {
  user: User | null
  preferences: Preferences | null
  loading: boolean
  login: (email: string, password: string, remember: boolean) => Promise<void>
  register: (data: { name: string; email: string; password: string; password_confirmation: string }) => Promise<void>
  logout: () => Promise<void>
  setPreferences: (p: Preferences) => void
  refresh: () => Promise<unknown>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const [user, setUser] = React.useState<User | null>(null)
  const [preferences, setPreferencesState] = React.useState<Preferences | null>(null)
  const [loading, setLoading] = React.useState(true)

  const fetchMe = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<MeResponse>('/auth/me')
      if (res?.user) {
        setUser(res.user)
        setPreferencesState(res.preferences ?? null)
        qc.setQueryData(['me'], res)
      } else {
        setUser(null)
        setPreferencesState(null)
        qc.setQueryData(['me'], null)
      }
      return res
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null)
        setPreferencesState(null)
        qc.setQueryData(['me'], null)
        return null
      }
      setUser(null)
      setPreferencesState(null)
      qc.setQueryData(['me'], null)
      return null
    } finally {
      setLoading(false)
    }
  }, [qc])

  React.useEffect(() => {
    fetchMe()
  }, [fetchMe])

  React.useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setPreferencesState(null)
      qc.setQueryData(['me'], null)
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
    })
  }, [qc])

  React.useEffect(() => {
    if (preferences) {
      configureFormatting({ dateFormat: preferences.date_format, timezone: preferences.timezone })
      applyTheme(preferences.theme)
    }
  }, [preferences])

  const value: AuthContextValue = {
    user,
    preferences,
    loading,
    login: async (email, password, remember) => {
      await ensureCsrf(true)
      const res = await api.post<MeResponse>('/auth/login', { email, password, remember })
      if (res?.user) {
        setUser(res.user)
        setPreferencesState(res.preferences ?? null)
        qc.setQueryData(['me'], res)
        qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
      }
    },
    register: async (data) => {
      await ensureCsrf(true)
      const res = await api.post<MeResponse>('/auth/register', data)
      if (res?.user) {
        setUser(res.user)
        setPreferencesState(res.preferences ?? null)
        qc.setQueryData(['me'], res)
        qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
      }
    },
    logout: async () => {
      try {
        await api.post('/auth/logout')
      } catch {
        // Abaikan error saat proses logout API agar pembersihan sesi lokal tetap berjalan
      } finally {
        setUser(null)
        setPreferencesState(null)
        qc.setQueryData(['me'], null)
        qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
        sessionStorage.removeItem('finora-recurring-run')
        window.location.hash = '#/'
      }
    },
    setPreferences: (p) => {
      setPreferencesState(p)
      qc.setQueryData<MeResponse | null>(['me'], (old) => (old ? { ...old, preferences: p } : old))
    },
    refresh: () => fetchMe(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}

export function applyTheme(theme: 'light' | 'dark' | 'system') {
  localStorage.setItem('finora-theme', theme)
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}
