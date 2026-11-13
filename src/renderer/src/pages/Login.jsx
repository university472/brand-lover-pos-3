import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, companyApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [users, setUsers] = useState([])
  const [companies, setCompanies] = useState([])
  const [years, setYears] = useState([])

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [yearId, setYearId] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Web demo only: demo logins listed under the form (window.api.demoInfo exists only in
  // the browser build, see web/setup.js).
  const [demo, setDemo] = useState(null)
  const isWeb = typeof window !== 'undefined' && !!window.__POS_WEB__

  useEffect(() => {
    window.api?.demoInfo?.().then((d) => d?.demo && setDemo(d)).catch(() => {})
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const [u, c, y] = await Promise.all([
          authApi.listUsers(),
          companyApi.list(),
          companyApi.financialYears()
        ])
        setUsers(u)
        setCompanies(c)
        setYears(y)
        if (u[0]) setUsername(u[0].username)
        if (c[0]) setCompanyId(String(c[0].id))
        const def = y.find((f) => f.is_default) || y[0]
        if (def) setYearId(String(def.id))
      } catch (e) {
        setError(
          isWeb
            ? 'Cannot reach the server. Please refresh in a moment. (' + e.message + ')'
            : 'Cannot reach database. Run "npm run db:setup" and check your .env. (' +
                e.message +
                ')'
        )
      }
    })()
  }, [])

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await authApi.login({
        username,
        password,
        companyId,
        yearId
      })
      login(data)
      // CHANGED: route by role — admins/managers go to dashboard, others to Counter Sale
      const admin = ['administrator', 'manager'].includes(data.role)
      navigate(admin ? '/dashboard' : '/sales', { replace: true })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className="login-wrap">
      <div className="login-art">
        <div className="login-lock">
          <Icon name="lock" size={64} />
        </div>
        <h2>Freedom Mall</h2>
        <p>Point of Sale &amp; Accounts Management System</p>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <h1 className="login-title">Log&nbsp;In</h1>

          <label className="field">
            <span>User</span>
            <select
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.username}>
                  {u.username}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              placeholder="Enter password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKey}
              autoFocus
            />
          </label>

          <label className="field">
            <span>Company</span>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Financial Year</span>
            <select value={yearId} onChange={(e) => setYearId(e.target.value)}>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
          </label>

          {error && <div className="login-error">{error}</div>}

          <div className="login-actions">
            {!isWeb && (
              <button className="btn-secondary" onClick={() => window.close()}>
                Exit
              </button>
            )}
            <button
              className="btn-primary"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Log in'}
            </button>
          </div>

          {demo?.users?.length > 0 && (
            <div className="demo-logins">
              <strong>Demo logins — tap to fill</strong>
              {demo.users.map((u) => (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => {
                    setUsername(u.username)
                    setPassword(u.password)
                  }}
                >
                  <span>
                    {u.username}{' '}
                    <small>
                      ({u.role === 'cashier' ? 'Salesman' : u.role === 'manager' ? 'Manager' : 'Owner/Admin'})
                    </small>
                  </span>
                  <code>{u.password}</code>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
