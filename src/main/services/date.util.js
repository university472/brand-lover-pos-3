// Calendar dates in the SHOP's local time (the PC's time zone, e.g. PKT = UTC+5).
//
// Why: `new Date().toISOString().slice(0, 10)` is the UTC date. In Pakistan, anything done
// between 00:00 and 05:00 was stamped with YESTERDAY's date (sales, recoveries, expenses,
// ledger rows), and "today" on the Dashboard/reports pointed at yesterday. MySQL's CURDATE()
// already uses local time, so the app and the database disagreed during those hours.

const pad = (n) => String(n).padStart(2, '0')

// YYYY-MM-DD of a Date in local time.
export function toLocalDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Today's local calendar date — use instead of new Date().toISOString().slice(0, 10).
export function localToday() {
  return toLocalDateStr(new Date())
}
