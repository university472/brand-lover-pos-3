import { useEffect } from 'react'

const BARE_FIRE = new Set([
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'f6',
  'f7',
  'f8',
  'f9',
  'f10',
  'f11',
  'f12',
  'escape',
  'enter',
  'delete',
  'backspace'
])

const SAFE_INSIDE_INPUT = new Set([
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'f6',
  'f7',
  'f8',
  'f9',
  'f10',
  'f11',
  'f12',
  'escape'
])

export function useHotkeys(handlers, deps = []) {
  useEffect(() => {
    function onKey(e) {
      const key = (e.key || '').toLowerCase()
      const ctrl = e.ctrlKey || e.metaKey
      const shift = e.shiftKey
      const alt = e.altKey

      const t = e.target
      const isEditable =
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)

      // 1) Alt + <key>
      if (alt && !ctrl && !shift) {
        const fn = handlers[`alt+${key}`]
        if (fn) {
          e.preventDefault()
          fn(e)
        }
        return
      }

      // 2) Ctrl + Shift + <key>
      if (ctrl && shift && !alt) {
        const fn = handlers[`ctrl+shift+${key}`]
        if (fn) {
          e.preventDefault()
          fn(e)
        }
        return
      }

      // 3) Ctrl + <key>  (also matches bare 'key' for legacy Ctrl+letter)
      if (ctrl && !alt && !shift) {
        const fn = handlers[`ctrl+${key}`] || handlers[key]
        if (fn) {
          e.preventDefault()
          fn(e)
        }
        return
      }

      if (ctrl || alt) return // ignore other combos

      // 4) Bare keys
      if (!BARE_FIRE.has(key)) return
      if (isEditable && !SAFE_INSIDE_INPUT.has(key)) return

      const fn = handlers[key]
      if (fn) {
        e.preventDefault()
        fn(e)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
