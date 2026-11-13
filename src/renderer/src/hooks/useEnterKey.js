import { useEffect } from 'react'

// Fires `handler` on Enter while `active` is true — but ignores Enter typed
// inside inputs/selects or on a focused button (so it never double-triggers).
export default function useEnterKey(handler, active = true) {
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.key !== 'Enter') return
      const t = e.target
      const tag = t && t.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        tag === 'A' ||
        (t && t.isContentEditable)
      )
        return
      e.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handler, active])
}
