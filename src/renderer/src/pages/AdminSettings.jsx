import { useEffect, useState, useRef } from 'react'
import { authApi, companyApi, salesmenApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import Modal from '../components/Modal.jsx'
import BackupPanel from '../components/BackupPanel.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { printReceiptElement } from '../utils/printReceipt.js'
import { printNow } from '../utils/print.js' // 📍 PIN #1 — print helper import

const ROLE_LABEL = {
  administrator: 'Owner / Admin',
  manager: 'Manager',
  cashier: 'Salesman'
}
const roleOptions = [
  { value: 'cashier', label: 'Salesman (bills only)' },
  { value: 'manager', label: 'Manager (full access)' },
  { value: 'administrator', label: 'Owner / Admin (full access)' }
]

export default function AdminSettings() {
  const { session } = useAuth()
  const [unlocked, setUnlocked] = useState(false)
  const [gatePw, setGatePw] = useState('')
  const [gateErr, setGateErr] = useState('')
  const [busy, setBusy] = useState(false)

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')

  const [users, setUsers] = useState([])
  const [userErr, setUserErr] = useState('')
  const [createModal, setCreateModal] = useState(false)
  const [newUser, setNewUser] = useState({
    fullName: '',
    username: '',
    password: '',
    role: 'cashier'
  })
  const [resetTarget, setResetTarget] = useState(null)
  const [resetPw, setResetPw] = useState('')

  const [profile, setProfile] = useState(null)
  const [profMsg, setProfMsg] = useState('')

  // ✅ Phase A3 — salesmen state
  const [salesmen, setSalesmen] = useState([])
  const [smErr, setSmErr] = useState('')
  const [smModal, setSmModal] = useState(false)
  const [smEditId, setSmEditId] = useState(null) // null = create mode
  const [smForm, setSmForm] = useState({ name: '', phone: '' })
  const [smBusy, setSmBusy] = useState(false)

  // Active section — last opened section yaad rehta hai
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem('adminSettingsTab') || 'account'
    } catch {
      return 'account'
    }
  })
  const goTab = (id) => {
    setTab(id)
    try {
      localStorage.setItem('adminSettingsTab', id)
    } catch {
      /* ignore */
    }
  }
  const [userQ, setUserQ] = useState('')
  const [smQ, setSmQ] = useState('')

  const gateRef = useRef(null)
  const headerRef = useRef(null)
  const smNameRef = useRef(null)

  const loadUsers = async () => {
    try {
      setUsers(await authApi.listUsersAdmin({ actingUserId: session.id }))
    } catch (e) {
      setUserErr(e.message)
    }
  }

  // ✅ Phase A3 — load salesmen (admin list, includes inactive)
  const loadSalesmen = async () => {
    try {
      setSmErr('')
      const rows = await salesmenApi.listAdmin({ actingUserId: session.id })
      setSalesmen(rows)
    } catch (e) {
      setSmErr(e.message)
    }
  }

  useEffect(() => {
    if (!unlocked) return
    loadUsers()
    loadSalesmen()
    companyApi
      .getProfile()
      .then(setProfile)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked])

  const unlock = async () => {
    setBusy(true)
    setGateErr('')
    try {
      await authApi.verifyPassword({ userId: session.id, password: gatePw })
      setUnlocked(true)
      setGatePw('')
    } catch (e) {
      setGateErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async () => {
    setPwMsg('')
    setPwErr('')
    if (pw.next !== pw.confirm) {
      setPwErr('New passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await authApi.changePassword({
        actingUserId: session.id,
        currentPassword: pw.current,
        newPassword: pw.next
      })
      setPw({ current: '', next: '', confirm: '' })
      setPwMsg('Password updated.')
    } catch (e) {
      setPwErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const createUser = async () => {
    setBusy(true)
    setUserErr('')
    try {
      await authApi.createUser({ actingUserId: session.id, ...newUser })
      setCreateModal(false)
      setNewUser({ fullName: '', username: '', password: '', role: 'cashier' })
      await loadUsers()
    } catch (e) {
      setUserErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (u) => {
    try {
      await authApi.updateUser({
        actingUserId: session.id,
        id: u.id,
        isActive: !u.is_active
      })
      await loadUsers()
    } catch (e) {
      setUserErr(e.message)
    }
  }
  const changeRole = async (u, role) => {
    try {
      await authApi.updateUser({ actingUserId: session.id, id: u.id, role })
      await loadUsers()
    } catch (e) {
      setUserErr(e.message)
    }
  }
  const doReset = async () => {
    setBusy(true)
    setUserErr('')
    try {
      await authApi.resetPassword({
        actingUserId: session.id,
        id: resetTarget.id,
        newPassword: resetPw
      })
      setResetTarget(null)
      setResetPw('')
    } catch (e) {
      setUserErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  // ✅ Phase A3 — open create modal
  // closing (or opening) a dialog clears its old error so it doesn't stay on the page
  useEffect(() => {
    setUserErr('')
    setSmErr('')
  }, [createModal, resetTarget, smModal])

  // Add User always opens empty — before, the last attempt's values and error were still there
  const openCreateUser = () => {
    setUserErr('')
    setNewUser({ fullName: '', username: '', password: '', role: 'cashier' })
    setCreateModal(true)
  }

  const openAddSalesman = () => {
    setSmErr('')
    setSmEditId(null)
    setSmForm({ name: '', phone: '' })
    setSmModal(true)
  }

  // ✅ Phase A3 — open edit modal
  const openEditSalesman = (s) => {
    setSmErr('')
    setSmEditId(s.id)
    setSmForm({ name: s.name || '', phone: s.phone || '' })
    setSmModal(true)
  }

  // ✅ Phase A3 — create or update
  const saveSalesman = async () => {
    setSmBusy(true)
    setSmErr('')
    try {
      if (!smForm.name.trim()) throw new Error('Name is required.')
      if (smEditId) {
        await salesmenApi.update({
          actingUserId: session.id,
          id: smEditId,
          name: smForm.name,
          phone: smForm.phone
        })
      } else {
        await salesmenApi.create({
          actingUserId: session.id,
          name: smForm.name,
          phone: smForm.phone
        })
      }
      setSmModal(false)
      setSmEditId(null)
      setSmForm({ name: '', phone: '' })
      await loadSalesmen()
    } catch (e) {
      setSmErr(e.message)
    } finally {
      setSmBusy(false)
    }
  }

  // ✅ Phase A3 — toggle active
  const toggleSalesman = async (s) => {
    try {
      await salesmenApi.toggle({ actingUserId: session.id, id: s.id })
      await loadSalesmen()
    } catch (e) {
      setSmErr(e.message)
    }
  }

  // ✅ Phase A3 — delete (blocked if used in bills, from backend)
  const deleteSalesman = async (s) => {
    if (
      !window.confirm(
        `Delete salesman "${s.name}"? This cannot be undone.\n\nTip: if this salesman already has bills, use Deactivate instead.`
      )
    )
      return
    try {
      await salesmenApi.delete({ actingUserId: session.id, id: s.id })
      await loadSalesmen()
    } catch (e) {
      setSmErr(e.message)
    }
  }

  // ✅ NEW — file → base64 (unchanged from earlier)
  const onPickQr = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setProfMsg('Please choose a PNG or JPG image.')
      return
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setProfMsg('Image too large — please use one under 1.5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setProfile((p) => ({ ...p, payment_qr_image: reader.result }))
      setProfMsg('') // a good image clears the old "too large / wrong type" message
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  const removeQr = () => setProfile((p) => ({ ...p, payment_qr_image: null }))

  const saveProfile = async () => {
    setProfMsg('')
    setBusy(true)
    try {
      await companyApi.updateProfile({
        actingUserId: session.id,
        receiptHeader: profile.receipt_header,
        receiptTagline: profile.receipt_tagline,
        receiptFooter: profile.receipt_footer,
        phone: profile.phone,
        address: profile.address || '',
        paymentQrImage: profile.payment_qr_image ?? null
      })
      setProfMsg('Receipt settings saved.')
      setTimeout(() => setProfMsg(''), 4000)
    } catch (e) {
      setProfMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  // ✅ Phase A3 — hotkeys (salesman modal ke liye F7)
  useHotkeys(
    {
      enter: () => {
        if (!unlocked && gatePw && !busy) unlock()
      },
      escape: () => {
        if (createModal) setCreateModal(false)
        else if (resetTarget) setResetTarget(null)
        else if (smModal) setSmModal(false)
      },
      f5: () => {
        if (!unlocked || busy) return
        loadUsers()
        loadSalesmen()
        companyApi
          .getProfile()
          .then(setProfile)
          .catch(() => {})
      },
      f7: () => {
        // ✅ NEW — F7 opens Add Salesman
        if (!unlocked || smModal) return
        goTab('salesmen')
        openAddSalesman()
      },
      f8: () => {
        if (!unlocked) return
        goTab('receipt')
        setTimeout(() => headerRef.current?.focus(), 0)
      },
      'alt+1': () => unlocked && goTab('account'),
      'alt+2': () => unlocked && goTab('users'),
      'alt+3': () => unlocked && goTab('salesmen'),
      'alt+4': () => unlocked && goTab('receipt'),
      'alt+5': () => unlocked && goTab('backup'),
      f9: () => {
        if (!unlocked || busy || !profile) return
        saveProfile()
      },
      p: () => printNow(), // 📍 PIN #2 — Ctrl+P: window.print() → printNow()
      delete: () => {
        if (resetTarget) setResetTarget(null)
      }
    },
    [
      unlocked,
      busy,
      gatePw,
      profile,
      createModal,
      resetTarget,
      smModal,
      newUser,
      pw,
      resetPw,
      smForm
    ]
  )

  if (!unlocked) {
    return (
      <div className="settings-gate">
        <div className="gate-card">
          <div className="gate-lock">
            <Icon name="lock" size={40} />
          </div>
          <h2>Admin Settings</h2>
          <p>Re-enter your password to continue.</p>
          <input
            ref={gateRef}
            type="password"
            autoFocus
            value={gatePw}
            placeholder="Your password  (Enter to unlock)"
            onChange={(e) => setGatePw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && unlock()}
          />
          {gateErr && <div className="login-error">{gateErr}</div>}
          <button
            className="btn-primary"
            onClick={unlock}
            disabled={busy || !gatePw}
          >
            Unlock
          </button>
        </div>
      </div>
    )
  }
  const initials = (name = '') =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || '')
      .join('')
      .toUpperCase() || '?'

  const uq = userQ.trim().toLowerCase()
  const shownUsers = uq
    ? users.filter(
        (u) =>
          (u.full_name || '').toLowerCase().includes(uq) ||
          (u.username || '').toLowerCase().includes(uq)
      )
    : users
  const sq = smQ.trim().toLowerCase()
  const shownSalesmen = sq
    ? salesmen.filter(
        (s) =>
          (s.name || '').toLowerCase().includes(sq) ||
          (s.phone || '').toLowerCase().includes(sq)
      )
    : salesmen
  const activeUsers = users.filter((u) => u.is_active).length
  const activeSalesmen = salesmen.filter((s) => s.is_active).length

  const TABS = [
    { id: 'account', icon: 'key', title: 'My Account', sub: 'Profile & password' },
    {
      id: 'users',
      icon: 'users',
      title: 'User Accounts',
      sub: 'Login users & roles',
      count: users.length
    },
    {
      id: 'salesmen',
      icon: 'user',
      title: 'Salesmen',
      sub: 'Billing staff',
      count: salesmen.length
    },
    { id: 'receipt', icon: 'receipt', title: 'Receipt & QR', sub: 'Print settings' },
    { id: 'backup', icon: 'download', title: 'Backup & Restore', sub: 'Data safety' }
  ]

  return (
    <div className="st-layout">
      {/* ── Left: section navigation ── */}
      <aside className="st-nav">
        <div className="st-nav-me">
          <div className="st-avatar lg">{initials(session.fullName)}</div>
          <div className="st-nav-me-text">
            <strong>{session.fullName}</strong>
            <span>{ROLE_LABEL[session.role] || session.role}</span>
          </div>
        </div>
        <div className="st-nav-list">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              className={'st-nav-item' + (tab === t.id ? ' active' : '')}
              onClick={() => goTab(t.id)}
              title={`Alt+${i + 1}`}
            >
              <span className="st-nav-icon">
                <Icon name={t.icon} size={18} />
              </span>
              <span className="st-nav-text">
                <strong>{t.title}</strong>
                <small>{t.sub}</small>
              </span>
              {t.count != null && <span className="st-nav-count">{t.count}</span>}
            </button>
          ))}
        </div>
        <div className="st-nav-foot">
          <kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>5</kbd> switch section
        </div>
      </aside>

      {/* ── Right: active section (full height) ── */}
      <section className="st-pane">
        {tab === 'account' && (
          <>
            <header className="st-pane-head">
              <div>
                <h2>
                  <Icon name="key" size={20} /> My Account
                </h2>
                <p>Aapki login details aur password.</p>
              </div>
            </header>
            <div className="st-pane-body">
              <div className="st-account-grid">
                <div className="st-card st-profile-card">
                  <div className="st-avatar xl">{initials(session.fullName)}</div>
                  <h3>{session.fullName}</h3>
                  <span className="st-role-pill">
                    {ROLE_LABEL[session.role] || session.role}
                  </span>
                  <div className="st-kv">
                    <div>
                      <span>Name</span>
                      <strong>{session.fullName}</strong>
                    </div>
                    <div>
                      <span>Username</span>
                      <strong>{session.username}</strong>
                    </div>
                    <div>
                      <span>Role</span>
                      <strong>{ROLE_LABEL[session.role] || session.role}</strong>
                    </div>
                  </div>
                </div>

                <div className="st-card">
                  <h3 className="st-card-title">Change Password</h3>
                  <p className="st-card-desc">
                    Purana password daalein, phir naya password do dafa likhein.
                  </p>
                  <label className="field">
                    <span>Current password</span>
                    <input
                      type="password"
                      value={pw.current}
                      onChange={(e) => setPw({ ...pw, current: e.target.value })}
                    />
                  </label>
                  <div className="field-row">
                    <label className="field">
                      <span>New password</span>
                      <input
                        type="password"
                        value={pw.next}
                        onChange={(e) => setPw({ ...pw, next: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Confirm new</span>
                      <input
                        type="password"
                        value={pw.confirm}
                        onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                      />
                    </label>
                  </div>
                  {pwErr && <div className="login-error">{pwErr}</div>}
                  {pwMsg && <div className="inv-notice">{pwMsg}</div>}
                  <button
                    className="btn-primary st-btn"
                    onClick={changePassword}
                    disabled={busy || !pw.current || !pw.next}
                  >
                    Update Password
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'users' && (
          <>
            <header className="st-pane-head">
              <div>
                <h2>
                  <Icon name="users" size={20} /> Salesman &amp; User Accounts
                </h2>
                <p>Jo log software mein login karte hain — role aur status yahan se badlein.</p>
              </div>
              <button className="btn-sm primary" onClick={openCreateUser}>
                <Icon name="plus" size={15} /> Add User
              </button>
            </header>
            <div className="st-toolbar">
              <div className="st-search">
                <Icon name="search" size={15} />
                <input
                  value={userQ}
                  onChange={(e) => setUserQ(e.target.value)}
                  placeholder="Search name or username…"
                />
              </div>
              <div className="st-stats">
                <span>
                  Total <b>{users.length}</b>
                </span>
                <span className="ok">
                  Active <b>{activeUsers}</b>
                </span>
                <span className="off">
                  Inactive <b>{users.length - activeUsers}</b>
                </span>
              </div>
            </div>
            {/* dialogs show their own error — not twice */}
            {userErr && !createModal && !resetTarget && (
              <div className="login-error">{userErr}</div>
            )}
            <div className="st-table-wrap">
              <table className="data-table st-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th className="num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shownUsers.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="empty">
                        {uq ? 'No user matches your search.' : 'No users yet.'}
                      </td>
                    </tr>
                  ) : (
                    shownUsers.map((u) => {
                      const self = Number(u.id) === Number(session.id)
                      return (
                        <tr key={u.id} className={u.is_active ? '' : 'row-inactive'}>
                          <td>
                            <div className="st-person">
                              <span className="st-avatar">{initials(u.full_name)}</span>
                              <span>
                                {u.full_name}
                                {self && <span className="self-tag">you</span>}
                              </span>
                            </div>
                          </td>
                          <td className="st-mono">{u.username}</td>
                          <td>
                            <select
                              className="role-select"
                              value={u.role}
                              disabled={self}
                              onChange={(e) => changeRole(u, e.target.value)}
                            >
                              {roleOptions.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <span
                              className={
                                'po-badge ' + (u.is_active ? 'received' : 'cancelled')
                              }
                            >
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="num">
                            <div className="table-actions st-actions">
                              <button
                                className="btn-sm ghost"
                                title="Reset password"
                                onClick={() => {
                                  setUserErr('')
                                  setResetPw('')
                                  setResetTarget(u)
                                }}
                              >
                                <Icon name="key" size={14} /> Reset
                              </button>
                              <button
                                className="btn-sm ghost"
                                title={u.is_active ? 'Deactivate' : 'Activate'}
                                disabled={self}
                                onClick={() => toggleActive(u)}
                              >
                                <Icon name={u.is_active ? 'pause' : 'check'} size={14} />
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'salesmen' && (
          <>
            <header className="st-pane-head">
              <div>
                <h2>
                  <Icon name="user" size={20} /> Salesmen (Billing Staff)
                </h2>
                <p>
                  Yeh billing staff hain — inke login accounts nahi hote. Counter Sale
                  screen par inka naam choose karke bill par assign hota hai.
                </p>
              </div>
              <button
                className="btn-sm primary"
                onClick={openAddSalesman}
                title="Add Salesman (F7)"
              >
                <Icon name="plus" size={15} /> Add Salesman
              </button>
            </header>
            <div className="st-toolbar">
              <div className="st-search">
                <Icon name="search" size={15} />
                <input
                  value={smQ}
                  onChange={(e) => setSmQ(e.target.value)}
                  placeholder="Search name or phone…"
                />
              </div>
              <div className="st-stats">
                <span>
                  Total <b>{salesmen.length}</b>
                </span>
                <span className="ok">
                  Active <b>{activeSalesmen}</b>
                </span>
                <span className="off">
                  Inactive <b>{salesmen.length - activeSalesmen}</b>
                </span>
              </div>
            </div>
            {smErr && !smModal && <div className="login-error">{smErr}</div>}
            <div className="st-table-wrap">
              <table className="data-table st-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th className="num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shownSalesmen.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="empty">
                        {sq
                          ? 'No salesman matches your search.'
                          : 'No salesmen yet — click Add Salesman (F7) to create one.'}
                      </td>
                    </tr>
                  ) : (
                    shownSalesmen.map((s) => (
                      <tr key={s.id} className={s.is_active ? '' : 'row-inactive'}>
                        <td>
                          <div className="st-person">
                            <span className="st-avatar">{initials(s.name)}</span>
                            <span>{s.name}</span>
                          </div>
                        </td>
                        <td className="st-mono">{s.phone || '—'}</td>
                        <td>
                          <span
                            className={
                              'po-badge ' + (s.is_active ? 'received' : 'cancelled')
                            }
                          >
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="num">
                          <div className="table-actions st-actions">
                            <button
                              className="btn-sm ghost"
                              title="Edit"
                              onClick={() => openEditSalesman(s)}
                            >
                              <Icon name="edit" size={14} /> Edit
                            </button>
                            <button
                              className="btn-sm ghost"
                              title={s.is_active ? 'Deactivate' : 'Activate'}
                              onClick={() => toggleSalesman(s)}
                            >
                              <Icon name={s.is_active ? 'pause' : 'check'} size={14} />
                              {s.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              className="btn-sm ghost st-danger"
                              title="Delete (only if no bills)"
                              onClick={() => deleteSalesman(s)}
                            >
                              <Icon name="trash" size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'receipt' && (
          <>
            <header className="st-pane-head">
              <div>
                <h2>
                  <Icon name="receipt" size={20} /> Receipt &amp; Payment QR
                </h2>
                <p>
                  Yeh details har sale/return receipt pe chhapti hain. Badalne ke baad{' '}
                  <strong>Save</strong> dabao — naya receipt usi waqt update ho jayega.
                </p>
              </div>
              <button
                className="btn-sm primary"
                onClick={saveProfile}
                disabled={busy || !profile}
                title="Save (F9)"
              >
                <Icon name="check" size={15} /> {busy ? 'Saving…' : 'Save Receipt Settings'}
              </button>
            </header>
            {profMsg && <div className="inv-notice">{profMsg}</div>}
            {!profile ? (
              <div className="st-pane-body">
                <p className="muted-text">Loading…</p>
              </div>
            ) : (
              <div className="st-pane-body">
                <div className="st-receipt-form">
                  <div className="st-card">
                    <h3 className="st-card-title">Shop Details</h3>
                    <div className="field-row">
                      <label className="field">
                        <span>Shop Name (receipt header)</span>
                        <input
                          ref={headerRef}
                          value={profile.receipt_header || ''}
                          onChange={(e) =>
                            setProfile({ ...profile, receipt_header: e.target.value })
                          }
                          placeholder="e.g. Brand Lover Family Store"
                          title="F8 to focus here"
                        />
                      </label>
                      <label className="field">
                        <span>Tagline / Sub-header</span>
                        <input
                          value={profile.receipt_tagline || ''}
                          onChange={(e) =>
                            setProfile({ ...profile, receipt_tagline: e.target.value })
                          }
                          placeholder="e.g. Family Store"
                        />
                      </label>
                    </div>
                    <div className="field-row">
                      <label className="field">
                        <span>Phone</span>
                        <input
                          value={profile.phone || ''}
                          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          placeholder="e.g. 0302-6874114, 0303-3302764"
                        />
                      </label>
                      <label className="field">
                        <span>Address</span>
                        <input
                          value={profile.address || ''}
                          onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                          placeholder="e.g. Faisal Bazar No 2 Sadiqabad"
                        />
                      </label>
                    </div>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span>Footer line</span>
                      <input
                        value={profile.receipt_footer || ''}
                        onChange={(e) =>
                          setProfile({ ...profile, receipt_footer: e.target.value })
                        }
                        placeholder="e.g. Thank You for Your Visit"
                      />
                    </label>
                  </div>

                  <div className="st-card">
                    <h3 className="st-card-title">
                      Payment QR Image <em className="hint-em">(PNG / JPG)</em>
                    </h3>
                    <div className="qr-picker">
                      <div className="qr-preview st-qr-lg">
                        {profile.payment_qr_image ? (
                          <img src={profile.payment_qr_image} alt="QR preview" />
                        ) : (
                          <span className="qr-empty">No QR</span>
                        )}
                      </div>
                      <div className="qr-picker-btns">
                        <label className="btn-sm ghost qr-file-btn">
                          <Icon name="upload" size={15} /> Choose QR Image
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={onPickQr}
                            hidden
                          />
                        </label>
                        {profile.payment_qr_image && (
                          <button type="button" className="btn-sm ghost" onClick={removeQr}>
                            <Icon name="trash" size={15} /> Remove
                          </button>
                        )}
                        <p className="muted-text" style={{ marginTop: 2 }}>
                          Yeh QR image receipt pe chhapegi. Badalni ho to dobara
                          &quot;Choose QR Image&quot; karke Save karo.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Receipt print calibration — sides se cut / off-center theek karne ke liye */}
                  <div className="st-card">
                    <h3 className="st-card-title">Receipt Print Alignment</h3>
                    <ol className="st-steps">
                      <li>
                        <b>Print ruler</b> dabao. Dekho left/right ki kaali line dikhti hai
                        ya nahi aur numbers kahan se shuru/khatam hote hain.
                      </li>
                      <li>
                        Left cut ho to <b>Shift +</b> (right) karo, right cut ho to{' '}
                        <b>Shift −</b> karo. Dono taraf cut ho to <b>Width</b> kam karo.
                      </li>
                    </ol>
                    <div className="st-align-row">
                      <label className="field">
                        <span>Width (mm)</span>
                        <input
                          type="number"
                          step="1"
                          defaultValue={localStorage.getItem('receiptWidthMm') || 56}
                          onChange={(e) => localStorage.setItem('receiptWidthMm', e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>Shift (mm)</span>
                        <input
                          type="number"
                          step="0.5"
                          defaultValue={localStorage.getItem('receiptOffsetMm') || 0}
                          onChange={(e) => localStorage.setItem('receiptOffsetMm', e.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn-sm ghost"
                        onClick={() => printReceiptElement(null, { ruler: true })}
                      >
                        <Icon name="printer" size={15} /> Print ruler
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'backup' && (
          <>
            <header className="st-pane-head">
              <div>
                <h2>
                  <Icon name="download" size={20} /> Backup &amp; Restore
                </h2>
                <p>
                  Sara data khud-ba-khud backup hota hai. Windows crash ya naya computer ho to
                  yahan se <strong>Restore</strong> karke sab records wapas laayein.
                </p>
              </div>
            </header>
            <BackupPanel />
          </>
        )}

        {/* 📍 PIN — hint strip */}
        <div className="hotkey-hint st-hints">
          <span>
            <kbd>Alt</kbd>+<kbd>1-5</kbd> Section
          </span>
          <span>
            <kbd>F5</kbd> Refresh
          </span>
          <span>
            <kbd>F7</kbd> Add salesman
          </span>
          <span>
            <kbd>F8</kbd> Shop name
          </span>
          <span>
            <kbd>F9</kbd> Save receipt
          </span>
          <span>
            <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
          </span>
          <span>
            <kbd>Esc</kbd> Close modal
          </span>
        </div>
      </section>

      {createModal && (
        <Modal
          title="Add User / Salesman"
          width={460}
          onClose={() => setCreateModal(false)}
          footer={
            <>
              <button
                className="btn-secondary"
                onClick={() => setCreateModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={createUser}
                disabled={busy}
              >
                Create
              </button>
            </>
          }
        >
          {userErr && <div className="login-error">{userErr}</div>}
          <label className="field">
            <span>Full name</span>
            <input
              autoFocus
              value={newUser.fullName}
              onChange={(e) =>
                setNewUser({ ...newUser, fullName: e.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Username (for login)</span>
            <input
              value={newUser.username}
              onChange={(e) =>
                setNewUser({ ...newUser, username: e.target.value })
              }
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Role</span>
              <select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser({ ...newUser, role: e.target.value })
                }
              >
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Modal>
      )}

      {resetTarget && (
        <Modal
          title={`Reset password — ${resetTarget.full_name}`}
          width={400}
          onClose={() => setResetTarget(null)}
          footer={
            <>
              <button
                className="btn-secondary"
                onClick={() => setResetTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={doReset}
                disabled={busy || !resetPw}
              >
                Reset
              </button>
            </>
          }
        >
          {userErr && <div className="login-error">{userErr}</div>}
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              autoFocus
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
            />
          </label>
        </Modal>
      )}

      {/* ✅ Phase A3 — Add/Edit Salesman modal */}
      {smModal && (
        <Modal
          title={smEditId ? 'Edit Salesman' : 'Add Salesman'}
          width={420}
          onClose={() => setSmModal(false)}
          footer={
            <>
              <button
                className="btn-secondary"
                onClick={() => setSmModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={saveSalesman}
                disabled={smBusy || !smForm.name.trim()}
              >
                {smBusy ? 'Saving…' : smEditId ? 'Save Changes' : 'Create'}
              </button>
            </>
          }
        >
          {smErr && <div className="login-error">{smErr}</div>}
          <label className="field">
            <span>Name</span>
            <input
              ref={smNameRef}
              autoFocus
              value={smForm.name}
              onChange={(e) => setSmForm({ ...smForm, name: e.target.value })}
              placeholder="e.g. Ali Raza"
            />
          </label>
          <label className="field">
            <span>
              Phone <em className="hint-em">(optional)</em>
            </span>
            <input
              value={smForm.phone}
              onChange={(e) => setSmForm({ ...smForm, phone: e.target.value })}
              placeholder="e.g. 0300-1234567"
            />
          </label>
          <p className="muted-text">
            Yeh salesman <strong>Counter Sale</strong> dropdown mein dikhega aur
            bill par assign hoga. Report: Reports → Salesman.
          </p>
        </Modal>
      )}
    </div>
  )
}
