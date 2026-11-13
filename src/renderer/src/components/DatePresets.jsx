import { PRESETS, presetRange, activePreset, isInverted } from '../utils/dateRanges.js'

// Today · This Week · This Month · All Time — the SAME buttons on every filtered page.
// The preset matching the current dates is highlighted (before, no button ever showed which
// filter was on, so the filters looked like they did nothing).
//   onChange({ from, to }) — the page sets both dates at once.
export default function DatePresets({ from, to, onChange, presets = PRESETS.map((p) => p[0]) }) {
  const active = activePreset(from, to)
  return (
    <>
      {PRESETS.filter(([k]) => presets.includes(k)).map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={'btn-sm ' + (active === key ? 'primary' : 'ghost')}
          aria-pressed={active === key}
          onClick={() => onChange(presetRange(key))}
        >
          {label}
        </button>
      ))}
      {isInverted(from, to) && (
        <span className="date-warn" title="Nothing can match — swap the dates">
          ⚠ From is after To
        </span>
      )}
    </>
  )
}
