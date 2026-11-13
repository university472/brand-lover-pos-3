import { useEffect, useRef } from 'react'

// Keyboard "layer" for a dialog opened on top of a page (e.g. the invoice editor over
// Counter Sale). While at least one layer is open, every keydown goes ONLY to the top-most
// layer's handler and is stopped before it reaches the page's window-level hotkeys
// (useHotkeys / useEnterKey) — so Delete, F9, Enter… never act on the page underneath.
//
// The listener sits on `document` in the bubble phase: React's own onKeyDown handlers
// (inputs inside the dialog) have already run, and window listeners have not yet.
const stack = []

function onKeyDown(e) {
  const top = stack[stack.length - 1]
  if (!top) return
  e.stopPropagation()
  top.current(e)
}

export default function useKeyLayer(handler) {
  const ref = useRef(handler)
  ref.current = handler

  useEffect(() => {
    stack.push(ref)
    if (stack.length === 1) document.addEventListener('keydown', onKeyDown)
    return () => {
      const i = stack.lastIndexOf(ref)
      if (i >= 0) stack.splice(i, 1)
      if (stack.length === 0) document.removeEventListener('keydown', onKeyDown)
    }
  }, [])
}

export const isEditableTarget = (t) =>
  !!t &&
  (t.tagName === 'INPUT' ||
    t.tagName === 'TEXTAREA' ||
    t.tagName === 'SELECT' ||
    t.isContentEditable)
