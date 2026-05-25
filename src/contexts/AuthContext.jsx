import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getToken, setToken, clearToken } from '../utils/api'
import { clearNotesCache } from '../hooks/useNotes'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) { setLoading(false); return }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.username) setUser({ username: data.username, avatarUrl: data.avatarUrl || null })
        else clearToken()
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    setToken(data.token)
    setUser({ username: data.username, avatarUrl: null })
  }, [])

  const signup = useCallback(async (username, password) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Sign up failed')
    setToken(data.token)
    setUser({ username: data.username, avatarUrl: null })
  }, [])

  const updateAvatar = useCallback((avatarUrl) => {
    setUser(u => u ? { ...u, avatarUrl } : u)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    clearNotesCache()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, signup, updateAvatar }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
