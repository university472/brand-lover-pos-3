// import { useAuth } from '../context/AuthContext.jsx'
// import { useNavigate } from 'react-router-dom'
// import Icon from './Icons.jsx'

// export default function Topbar() {
//   const { session, logout } = useAuth()
//   const navigate = useNavigate()

//   const today = new Date().toLocaleDateString('en-GB', {
//     weekday: 'long',
//     day: '2-digit',
//     month: 'long',
//     year: 'numeric'
//   })

//   const handleLogout = () => {
//     logout()
//     navigate('/login', { replace: true })
//   }

//   return (
//     <header className="topbar">
//       <div className="topbar-left">
//         <h1>Accounts Management</h1>
//         <span className="topbar-date">{today}</span>
//       </div>
//       <div className="topbar-right">
//         <div className="user-chip">
//           <div className="avatar">{(session?.fullName || 'U').charAt(0)}</div>
//           <div className="user-meta">
//             <strong>{session?.fullName}</strong>
//             <span>{session?.role}</span>
//           </div>
//         </div>
//         <button className="btn-ghost" onClick={handleLogout}>
//           <Icon name="logout" size={18} />
//           Logout
//         </button>
//       </div>
//     </header>
//   )
// }

import { useAuth } from '../context/AuthContext.jsx'
import { useNavigate } from 'react-router-dom'
import Icon from './Icons.jsx'

export default function Topbar({ collapsed, onToggleSidebar }) {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="topbar">
      <div className="topbar-left with-toggle">
        <button
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          title={collapsed ? 'Open sidebar' : 'Close sidebar'}
          aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
        >
          <Icon name={collapsed ? 'menu' : 'x'} size={20} />
        </button>
        <h1>Accounts Management</h1>
        <span className="topbar-date">{today}</span>
      </div>
      <div className="topbar-right">
        <div className="user-chip">
          <div className="avatar">{(session?.fullName || 'U').charAt(0)}</div>
          <div className="user-meta">
            <strong>{session?.fullName}</strong>
            <span>{session?.role}</span>
          </div>
        </div>
        <button className="btn-ghost" onClick={handleLogout}>
          <Icon name="logout" size={18} />
          Logout
        </button>
      </div>
    </header>
  )
}
