/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const AuthContext = createContext(null)
const SANDBOX_REQUEST_TIMEOUT_MS = 10000

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timeoutId)
    },
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ token: null, userId: null, isRealtimeOnline: false })
  const setRealtimeOnline = useCallback((isRealtimeOnline) => {
    setSession((current) => ({ ...current, isRealtimeOnline }))
  }, [])
  const value = useMemo(() => ({
    ...session,
    setSession,
    async startSandboxSession() {
      const apiUrl = (import.meta.env.VITE_CHAT_API_URL || 'http://localhost:8000').replace(/\/$/, '')
      const timeout = createTimeoutSignal(SANDBOX_REQUEST_TIMEOUT_MS)
      try {
        const response = await fetch(`${apiUrl}/sandbox/test-login`, {
          method: 'POST',
          credentials: 'include',
          signal: timeout.signal,
        })
        if (!response.ok) throw new Error('Sandbox login is unavailable')
        const identity = await response.json()
        setSession({ token: null, userId: identity.account_id, isRealtimeOnline: false })
      } finally {
        timeout.clear()
      }
    },
    async endSandboxSession() {
      const apiUrl = (import.meta.env.VITE_CHAT_API_URL || 'http://localhost:8000').replace(/\/$/, '')
      const timeout = createTimeoutSignal(SANDBOX_REQUEST_TIMEOUT_MS)
      try {
        await fetch(`${apiUrl}/sandbox/test-logout`, {
          method: 'POST',
          credentials: 'include',
          signal: timeout.signal,
        })
      } finally {
        timeout.clear()
        setSession({ token: null, userId: null, isRealtimeOnline: false })
      }
    },
    setRealtimeOnline,
    clearSession: () => setSession({ token: null, userId: null, isRealtimeOnline: false }),
  }), [session, setRealtimeOnline])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
