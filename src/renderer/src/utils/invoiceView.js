// Pure helpers for the Sales Report "All Invoices" list: sorting, date grouping and
// pagination. No React here, so the logic can be unit-tested with plain Node.
//
// Rules (owner's spec):
//  • Invoices are always grouped by day (by month for "All Time").
//  • Sort by Date → groups (and rows inside them) follow the chosen direction.
//    Sort by Invoice # / Amount / Due → groups stay newest-first, rows sorted INSIDE each group.
//  • Pagination counts invoice rows (e.g. 20 per page), across however many groups they span.
//    A group's header always shows the WHOLE group's count/total, even when split over pages.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const groupKeyOf = (row, byMonth) =>
  byMonth ? String(row.invoice_date).slice(0, 7) : String(row.invoice_date).slice(0, 10)

// "2026-09-27" → "27 Sep 2026", "2026-09" → "Sep 2026"
export function groupLabel(key, byMonth) {
  const [y, m, d] = String(key).split('-')
  const mon = MONTHS[Number(m) - 1] || m
  return byMonth ? `${mon} ${y}` : `${Number(d)} ${mon} ${y}`
}

const num = (v) => Number(v) || 0
const invNo = (r) => {
  const n = Number(r.invoice_no)
  return Number.isFinite(n) ? n : String(r.invoice_no)
}
const stamp = (r) => `${r.invoice_date} ${r.invoice_time || ''}`
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

const KEY_FN = {
  invoice: invNo,
  amount: (r) => num(r.net_total),
  due: (r) => num(r.outstanding)
}

// Returns a NEW sorted array; `sort` = { key: 'date'|'invoice'|'amount'|'due', dir: 'asc'|'desc' }
export function sortInvoices(rows, sort, byMonth) {
  const sign = sort.dir === 'asc' ? 1 : -1
  const groupSign = sort.key === 'date' ? sign : -1 // non-date sorts keep newest group first
  return [...rows].sort((a, b) => {
    const g = cmp(groupKeyOf(a, byMonth), groupKeyOf(b, byMonth))
    if (g) return g * groupSign
    let c
    if (sort.key === 'date') c = cmp(stamp(a), stamp(b)) * sign
    else c = cmp(KEY_FN[sort.key](a), KEY_FN[sort.key](b)) * sign
    if (c) return c
    return (cmp(stamp(a), stamp(b)) || cmp(num(a.id), num(b.id))) * -1 // stable: newest first
  })
}

// pageSize = 0 means "All"
export function paginate(sorted, pageSize, page) {
  const total = sorted.length
  const size = pageSize > 0 ? pageSize : total || 1
  const pageCount = Math.max(1, Math.ceil(total / size))
  const p = Math.min(Math.max(1, page), pageCount)
  const startIdx = (p - 1) * size
  const pageRows = sorted.slice(startIdx, startIdx + size)
  return {
    pageRows,
    page: p,
    pageCount,
    from: total ? startIdx + 1 : 0,
    to: startIdx + pageRows.length,
    total
  }
}

export function summarize(rows) {
  return rows.reduce(
    (t, r) => ({
      count: t.count + 1,
      amount: +(t.amount + num(r.net_total)).toFixed(2),
      received: +(t.received + num(r.amount_received)).toFixed(2),
      due: +(t.due + num(r.outstanding)).toFixed(2)
    }),
    { count: 0, amount: 0, received: 0, due: 0 }
  )
}

// Whole-group stats (count/total over ALL filtered invoices) keyed by group.
export function groupStats(allRows, byMonth) {
  const m = new Map()
  for (const r of allRows) {
    const k = groupKeyOf(r, byMonth)
    const g = m.get(k) || { count: 0, amount: 0 }
    g.count += 1
    g.amount = +(g.amount + num(r.net_total)).toFixed(2)
    m.set(k, g)
  }
  return m
}

// The page's rows split into consecutive groups, each carrying whole-group stats.
export function buildPageGroups(pageRows, stats, byMonth) {
  const groups = []
  for (const r of pageRows) {
    const k = groupKeyOf(r, byMonth)
    let g = groups[groups.length - 1]
    if (!g || g.key !== k) {
      const s = stats.get(k) || { count: 0, amount: 0 }
      g = { key: k, label: groupLabel(k, byMonth), count: s.count, amount: s.amount, rows: [] }
      groups.push(g)
    }
    g.rows.push(r)
  }
  return groups
}

// The newest group key (opened by default).
export function newestGroupKey(rows, byMonth) {
  let best = null
  for (const r of rows) {
    const k = groupKeyOf(r, byMonth)
    if (best === null || k > best) best = k
  }
  return best
}

// Page-number buttons with ellipses: [1, '…', 4, 5, 6, '…', 20]
export function pageButtons(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const set = new Set([1, pageCount, page - 1, page, page + 1])
  const list = [...set].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b)
  const out = []
  for (let i = 0; i < list.length; i++) {
    if (i && list[i] - list[i - 1] > 1) out.push('…')
    out.push(list[i])
  }
  return out
}
