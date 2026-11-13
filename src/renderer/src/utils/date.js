// Calendar dates in the shop's LOCAL time zone (e.g. PKT, UTC+5).
//
// `date.toISOString().slice(0, 10)` gives the UTC date: between 00:00 and 05:00 in Pakistan
// "today" became yesterday, and a local-midnight date such as the 1st of the month turned into
// the last day of the previous month (so "This Month" / "This Week" started a day early).

const pad = (n) => String(n).padStart(2, '0')

// YYYY-MM-DD of a Date in local time.
export function toLocalDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Today's local date — use instead of new Date().toISOString().slice(0, 10).
export function localToday() {
  return toLocalDateStr(new Date())
}
