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
  const [session, setSession] = useState({
    token: null,
    userId: null,
    lastActivityAt: null,
    idleTimeoutSeconds: null,
    isRealtimeOnline: false,
  })
  const setRealtimeOnline = useCallback((isRealtimeOnline) => {
    setSession((current) => ({ ...current, isRealtimeOnline }))
  }, [])
  const recordSessionActivity = useCallback(() => {
    setSession((current) => (
      current.userId
        ? { ...current, lastActivityAt: Date.now() }
        : current
    ))
  }, [])
  const clearSession = useCallback(() => {
    setSession({
      token: null,
      userId: null,
      lastActivityAt: null,
      idleTimeoutSeconds: null,
      isRealtimeOnline: false,
    })
  }, [])
  const startSandboxSession = useCallback(async () => {
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
      if (!Number.isSafeInteger(identity.idle_timeout_seconds) || identity.idle_timeout_seconds <= 0) {
        throw new Error('Sandbox inactivity timeout is not configured')
      }
      setSession({
        token: null,
        userId: identity.account_id,
        lastActivityAt: Date.now(),
        idleTimeoutSeconds: identity.idle_timeout_seconds,
        isRealtimeOnline: false,
      })
    } finally {
      timeout.clear()
    }
  }, [])
  const endSandboxSession = useCallback(async () => {
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
      clearSession()
    }
  }, [clearSession])
  const value = useMemo(() => ({
    ...session,
    setSession,
    startSandboxSession,
    endSandboxSession,
    recordSessionActivity,
    setRealtimeOnline,
    clearSession,
  }), [
    session,
    startSandboxSession,
    endSandboxSession,
    recordSessionActivity,
    setRealtimeOnline,
    clearSession,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
