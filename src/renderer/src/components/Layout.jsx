import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'

const MOBILE_QUERY = '(max-width: 900px)'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.(MOBILE_QUERY).matches
  )
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener ? mq.addEventListener('change', update) : mq.addListener(update)
    return () =>
      mq.removeEventListener ? mq.removeEventListener('change', update) : mq.removeListener(update)
  }, [])
  return isMobile
}

export default function Layout() {
  // Desktop: the menu collapses into the page. Phone/tablet (≤900px): the menu is a drawer
  // that slides over the page and closes after navigating.
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = useIsMobile()
  const { pathname } = useLocation()

  useEffect(() => setDrawerOpen(false), [pathname, isMobile])

  const hidden = isMobile ? !drawerOpen : collapsed
  const shellClass =
    'app-shell' +
    (!isMobile && collapsed ? ' sidebar-collapsed' : '') +
    (isMobile ? ' is-mobile' : '') +
    (isMobile && drawerOpen ? ' drawer-open' : '')

  return (
    <div className={shellClass}>
      <Sidebar collapsed={hidden} onClose={isMobile ? () => setDrawerOpen(false) : undefined} />
      {isMobile && drawerOpen && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}
      <div className="app-main">
        <Topbar
          collapsed={hidden}
          onToggleSidebar={() =>
            isMobile ? setDrawerOpen((o) => !o) : setCollapsed((c) => !c)
          }
        />
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
