// Date-range presets used by every filtered page (Dashboard, reports, Bills, Payments …).
// One definition so "This Week" means the same everywhere (week starts Monday), and so a page
// can tell WHICH preset is active and highlight it.
import { toLocalDateStr, localToday } from './date.js'

export const PRESETS = [
  ['today', 'Today'],
  ['week', 'This Week'],
  ['month', 'This Month'],
  ['all', 'All Time']
]

// { from, to } as YYYY-MM-DD in local time ('' = open-ended / All Time)
export function presetRange(key, now = new Date()) {
  const today = toLocalDateStr(now)
  if (key === 'today') return { from: today, to: today }
  if (key === 'week') {
    const d = new Date(now)
    const back = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
    d.setDate(d.getDate() - back)
    return { from: toLocalDateStr(d), to: today }
  }
  if (key === 'month') {
    return { from: toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
  }
  if (key === 'all') return { from: '', to: '' }
  return { from: today, to: today }
}

// Which preset the current range equals (null = custom dates). "This Week" on a Monday is
// the same as "Today" — Today wins so the highlight is unambiguous.
export function activePreset(from, to, now = new Date()) {
  for (const [key] of PRESETS) {
    const r = presetRange(key, now)
    if ((from || '') === r.from && (to || '') === r.to) return key
  }
  return null
}

export function rangeLabel(from, to, now = new Date()) {
  const k = activePreset(from, to, now)
  if (k) return PRESETS.find((p) => p[0] === k)[1]
  if (!from && !to) return 'All Time'
  return `${from || '…'} → ${to || '…'}`
}

export const isInverted = (from, to) => !!from && !!to && from > to

export { localToday }
