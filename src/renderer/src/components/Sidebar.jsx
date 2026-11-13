// // add close sidebar button for mobile view
// import { useEffect, useState, useCallback } from 'react'
// import { NavLink, useLocation } from 'react-router-dom'
// import Icon from './Icons.jsx'
// import { useAuth } from '../context/AuthContext.jsx'
// import { inventoryApi, dashboardApi } from '../api/ipc.js'
// import { STOCK_EVENT } from '../utils/lowStock.js'

// const nav = [
//   { to: '/dashboard', label: 'Dashboard', icon: 'grid', admin: true },
//   { to: '/sales', label: 'Counter Sale', icon: 'cart', admin: false },
//   // 📍 PIN — Customer History (admin only)
//   {
//     to: '/customer-history',
//     label: 'Customer History',
//     icon: 'history',
//     admin: true
//   },
//   { to: '/returns', label: 'Returns', icon: 'return', admin: true },
//   { to: '/inventory', label: 'Inventory', icon: 'package', admin: true },
//   { to: '/purchases', label: 'Purchases', icon: 'truck', admin: true },
//   { to: '/payments', label: 'Payments', icon: 'wallet', admin: true },
//   {
//     to: '/credit',
//     label: 'Credit/Receipt',
//     icon: 'book',
//     admin: true,
//     badge: 'overdue'
//   },
//   { to: '/bills', label: 'Bills', icon: 'receipt', admin: true },
//   { to: '/reports', label: 'Reports', icon: 'chart', admin: true },
//   {
//     to: '/low-stock',
//     label: 'Low Stock',
//     icon: 'alert',
//     admin: true,
//     badge: 'lowStock'
//   },
//   { to: '/settings', label: 'Settings', icon: 'settings', admin: true }
// ]

// export default function Sidebar({ collapsed }) {
//   const { isAdmin } = useAuth()
//   const [lowCount, setLowCount] = useState(0)
//   const { pathname } = useLocation()

//   // The badge used to be counted ONCE at startup, so selling an item down to its alert level
//   // never showed up. Now: on every page change, right after a sale/edit/stock change
//   // (STOCK_EVENT), and every minute.
//   const [overdueCount, setOverdueCount] = useState(0)
//   const refreshLow = useCallback(() => {
//     inventoryApi.items
//       .lowStockCount()
//       .then((d) => setLowCount(d.count))
//       .catch(() => {})
//     // overdue credit bills (Owner/Manager only — the Salesman never sees Credit/Receipt)
//     if (isAdmin)
//       dashboardApi
//         .overdueSummary()
//         .then((d) => setOverdueCount(d.count))
//         .catch(() => {})
//   }, [isAdmin])
//   useEffect(() => {
//     refreshLow()
//   }, [pathname, refreshLow])
//   useEffect(() => {
//     window.addEventListener(STOCK_EVENT, refreshLow)
//     const t = setInterval(refreshLow, 60000)
//     return () => {
//       window.removeEventListener(STOCK_EVENT, refreshLow)
//       clearInterval(t)
//     }
//   }, [refreshLow])

//   return (
//     <aside className="sidebar" aria-hidden={collapsed}>
//       <div className="brand">
//         <div className="brand-mark">FM</div>
//         <div className="brand-text">
//           <strong>Freedom Mall</strong>
//           <span>POS & Accounts</span>
//         </div>
//       </div>

//       <nav className="nav">
//         {nav
//           .filter((n) => isAdmin || !n.admin)
//           .map((n) => (
//             <NavLink
//               key={n.to}
//               to={n.to}
//               className={({ isActive }) =>
//                 'nav-item' + (isActive ? ' active' : '')
//               }
//             >
//               <Icon name={n.icon} />
//               <span>{n.label}</span>
//               {n.badge === 'lowStock' && lowCount > 0 && (
//                 <span className="nav-badge">{lowCount}</span>
//               )}
//               {n.badge === 'overdue' && overdueCount > 0 && (
//                 <span className="nav-badge" title="Overdue credit bills">
//                   {overdueCount}
//                 </span>
//               )}
//             </NavLink>
//           ))}
//       </nav>

//       <div className="sidebar-foot">v1.0.0 · POS &amp; Accounts</div>
//     </aside>
//   )
// }

// add close sidebar button for mobile view
import { useEffect, useState, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Icon from './Icons.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { inventoryApi, dashboardApi } from '../api/ipc.js'
import {
  STOCK_EVENT,
  getDismissedLowStock,
  LOW_STOCK_DISMISS_EVENT
} from '../utils/lowStock.js'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: 'grid', admin: true },
  { to: '/sales', label: 'Counter Sale', icon: 'cart', admin: false },
  // 📍 PIN — Customer History (admin only)
  {
    to: '/customer-history',
    label: 'Customer History',
    icon: 'history',
    admin: true
  },
  { to: '/returns', label: 'Returns', icon: 'return', admin: true },
  { to: '/inventory', label: 'Inventory', icon: 'package', admin: true },
  { to: '/purchases', label: 'Purchases', icon: 'truck', admin: true },
  { to: '/payments', label: 'Payments', icon: 'wallet', admin: true },
  {
    to: '/credit',
    label: 'Credit/Receipt',
    icon: 'book',
    admin: true,
    badge: 'overdue'
  },
  { to: '/bills', label: 'Bills', icon: 'receipt', admin: true },
  { to: '/reports', label: 'Reports', icon: 'chart', admin: true },
  {
    to: '/low-stock',
    label: 'Low Stock',
    icon: 'alert',
    admin: true,
    badge: 'lowStock'
  },
  { to: '/settings', label: 'Settings', icon: 'settings', admin: true }
]

export default function Sidebar({ collapsed, onClose }) {
  const { isAdmin } = useAuth()
  const [lowCount, setLowCount] = useState(0)
  const [overdueCount, setOverdueCount] = useState(0)
  const { pathname } = useLocation()

  // Mobile viewport detection — used to show the close button and to auto-close
  // the sidebar after tapping a nav link (standard mobile drawer behaviour).
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(max-width: 900px)')
    const update = () => setIsMobile(mq.matches)
    update()
    // Some older engines only support addListener/removeListener
    if (mq.addEventListener) mq.addEventListener('change', update)
    else if (mq.addListener) mq.addListener(update)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update)
      else if (mq.removeListener) mq.removeListener(update)
    }
  }, [])

  // The badge used to be counted ONCE at startup, so selling an item down to its alert level
  // never showed up. Now: on every page change, right after a sale/edit/stock change
  // (STOCK_EVENT), when the user dismisses a low-stock alert (LOW_STOCK_DISMISS_EVENT),
  // and every minute. Dismissed items are filtered out of the badge count.
  const refreshLow = useCallback(() => {
    inventoryApi.items
      .lowStock()
      .then((items) => {
        const dismissed = getDismissedLowStock()
        const activeAlerts = items.filter((i) => !dismissed.includes(i.id))
        setLowCount(activeAlerts.length)
      })
      .catch(() => {})

    // overdue credit bills (Owner/Manager only — the Salesman never sees Credit/Receipt)
    if (isAdmin)
      dashboardApi
        .overdueSummary()
        .then((d) => setOverdueCount(d.count))
        .catch(() => {})
  }, [isAdmin])

  useEffect(() => {
    refreshLow()
  }, [pathname, refreshLow])

  useEffect(() => {
    window.addEventListener(STOCK_EVENT, refreshLow)
    window.addEventListener(LOW_STOCK_DISMISS_EVENT, refreshLow)
    const t = setInterval(refreshLow, 60000)
    return () => {
      window.removeEventListener(STOCK_EVENT, refreshLow)
      window.removeEventListener(LOW_STOCK_DISMISS_EVENT, refreshLow)
      clearInterval(t)
    }
  }, [refreshLow])

  // On mobile, close the drawer after a nav link is tapped
  const handleNavClick = () => {
    if (isMobile && onClose) {
      // let the route change happen first, then close
      setTimeout(onClose, 0)
    }
  }

  return (
    <aside
      className="sidebar"
      aria-hidden={collapsed}
      style={{ position: 'relative' }}
    >
      {/* Mobile-only close (X) button — sits in the brand area's top-right corner */}
      {isMobile && onClose && (
        <button
          type="button"
          className="sidebar-close"
          onClick={onClose}
          aria-label="Close menu"
          title="Close menu"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 34,
            height: 34,
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.12)',
            color: 'inherit',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20
          }}
        >
          <Icon name="x" size={18} />
        </button>
      )}

      <div className="brand">
        <div className="brand-mark">FM</div>
        <div className="brand-text">
          <strong>Freedom Mall</strong>
          <span>POS & Accounts</span>
        </div>
      </div>

      <nav className="nav">
        {nav
          .filter((n) => isAdmin || !n.admin)
          .map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={handleNavClick}
              className={({ isActive }) =>
                'nav-item' + (isActive ? ' active' : '')
              }
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.badge === 'lowStock' && lowCount > 0 && (
                <span className="nav-badge">{lowCount}</span>
              )}
              {n.badge === 'overdue' && overdueCount > 0 && (
                <span className="nav-badge" title="Overdue credit bills">
                  {overdueCount}
                </span>
              )}
            </NavLink>
          ))}
      </nav>

      <div className="sidebar-foot">v1.0.0 · POS &amp; Accounts</div>
    </aside>
  )
}
