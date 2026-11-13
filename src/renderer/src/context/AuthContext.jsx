import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../api/ipc.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const raw = sessionStorage.getItem('session')
    return raw ? JSON.parse(raw) : null
  })

  useEffect(() => {
    if (session) sessionStorage.setItem('session', JSON.stringify(session))
    else sessionStorage.removeItem('session')
  }, [session])

  const login = (data) => setSession(data)
  const logout = () => {
    // Clear the main-process session too, so nothing can be done after logging out.
    authApi.logout().catch(() => {})
    setSession(null)
  }

  const isAdmin = ['administrator', 'manager'].includes(session?.role)

  return (
    <AuthContext.Provider value={{ session, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
