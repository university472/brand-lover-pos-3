import { useEffect } from 'react'

// Moves DOM focus among a container's [data-nav-item] children on ArrowUp/ArrowDown
// (wraps at both ends) — lets a plain clickable list be driven by Tab + arrows + Enter,
// without each screen re-implementing its own index-tracking state.
export function useArrowListNav(containerRef, selector = '[data-nav-item]') {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onKey = (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const items = Array.from(el.querySelectorAll(selector))
      if (!items.length) return
      e.preventDefault()
      const idx = items.indexOf(document.activeElement)
      let next
      if (idx === -1) next = e.key === 'ArrowDown' ? 0 : items.length - 1
      else if (e.key === 'ArrowDown') next = (idx + 1) % items.length
      else next = (idx - 1 + items.length) % items.length
      items[next]?.focus()
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [containerRef, selector])
}
