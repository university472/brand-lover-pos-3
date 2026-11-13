import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/reports/daybook', label: 'Day Book' },
  { to: '/reports', label: 'Customers', end: true },
  { to: '/reports/sales', label: 'Sales' },
  { to: '/reports/profit-loss', label: 'Profit/Loss' }, // ← NEW
  { to: '/reports/credit-recovery', label: 'Credit Recovery' },
  { to: '/reports/salesman', label: 'Salesman' },
  { to: '/reports/purchase-payments', label: 'Purchase Payments' },
  { to: '/reports/stock', label: 'Stock Valuation' },
  { to: '/reports/purchases', label: 'Purchases' },
  { to: '/reports/purchases-by-product', label: 'Purchases by Product' }, // ← NEW
  { to: '/reports/customer-ledger', label: 'Customer Ledger' },
  { to: '/reports/stock-tracker', label: 'Stock Tracker' } // <-- NEW
]

export default function ReportTabs() {
  return (
    <div className="po-tabs report-tabs">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => 'po-tab' + (isActive ? ' active' : '')}
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  )
}
