import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Inventory from './pages/Inventory.jsx'
import LowStock from './pages/LowStock.jsx'
import CounterSale from './pages/CounterSale.jsx'
import Purchases from './pages/Purchases.jsx'
import Placeholder from './pages/Placeholder.jsx'
import AdminSettings from './pages/AdminSettings.jsx'
import CreditBook from './pages/CreditBook.jsx'
import Reports from './pages/Reports.jsx'
import SalesReport from './pages/SalesReport.jsx'
import SalesmanPerformance from './pages/SalesmanPerformance.jsx' // ✅ Phase A3
import PurchaseReport from './pages/PurchaseReport.jsx'
import StockReport from './pages/StockReport.jsx'
import DayBook from './pages/DayBook.jsx'
import BarcodeLabels from './pages/BarcodeLabels.jsx'
import Returns from './pages/Returns.jsx'
import BillTracking from './pages/BillTracking.jsx'
import Payments from './pages/Payments.jsx'
import PurchasePaymentsReport from './pages/PurchasePaymentsReport.jsx'
import CustomerHistory from './pages/CustomerHistory.jsx'
import CustomerLedger from './pages/CustomerLedger.jsx'
import CreditRecoveryReport from './pages/CreditRecoveryReport.jsx'
import ProfitLossReport from './pages/ProfitLossReport.jsx'
import PurchasesByProductReport from './pages/PurchasesByProductReport.jsx'
import StockTrackerReport from './pages/StockTrackerReport.jsx'

function Protected({ children }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  return children
}

function RequireAdmin({ children }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  if (!['administrator', 'manager'].includes(session.role))
    return <Navigate to="/sales" replace />
  return children
}

export default function App() {
  const { session } = useAuth()
  const home =
    session && ['administrator', 'manager'].includes(session.role)
      ? '/dashboard'
      : '/sales'
  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to={home} replace /> : <Login />}
      />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route
          path="/dashboard"
          element={
            <RequireAdmin>
              <Dashboard />
            </RequireAdmin>
          }
        />
        <Route
          path="/inventory"
          element={
            <RequireAdmin>
              <Inventory />
            </RequireAdmin>
          }
        />
        <Route
          path="/reports/purchases-by-product"
          element={
            <RequireAdmin>
              <PurchasesByProductReport />
            </RequireAdmin>
          }
        />
        <Route
          path="/low-stock"
          element={
            <RequireAdmin>
              <LowStock />
            </RequireAdmin>
          }
        />
        <Route path="/sales" element={<CounterSale />} />

        <Route
          path="/customer-history"
          element={
            <RequireAdmin>
              <CustomerHistory />
            </RequireAdmin>
          }
        />
        <Route
          path="/reports/stock-tracker"
          element={
            <RequireAdmin>
              <StockTrackerReport />
            </RequireAdmin>
          }
        />
        <Route path="/reports/customer-ledger" element={<CustomerLedger />} />
        <Route
          path="/purchases"
          element={
            <RequireAdmin>
              <Purchases />
            </RequireAdmin>
          }
        />
        <Route
          path="/payments"
          element={
            <RequireAdmin>
              <Payments />
            </RequireAdmin>
          }
        />
        <Route
          path="/receipts"
          element={
            <RequireAdmin>
              <Placeholder title="Receipts" />
            </RequireAdmin>
          }
        />
        <Route path="/barcodes" element={<BarcodeLabels />} />
        <Route
          path="/returns"
          element={
            <RequireAdmin>
              <Returns />
            </RequireAdmin>
          }
        />
        <Route
          path="/bills"
          element={
            <RequireAdmin>
              <BillTracking />
            </RequireAdmin>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireAdmin>
              <Reports />
            </RequireAdmin>
          }
        />
        <Route
          path="/reports/profit-loss"
          element={
            <RequireAdmin>
              <ProfitLossReport />
            </RequireAdmin>
          }
        />
        <Route
          path="/reports/sales"
          element={
            <RequireAdmin>
              <SalesReport />
            </RequireAdmin>
          }
        />
        {/* ✅ Phase A3 — Salesman Performance report */}
        <Route
          path="/reports/salesman"
          element={
            <RequireAdmin>
              <SalesmanPerformance />
            </RequireAdmin>
          }
        />
        <Route
          path="/reports/purchases"
          element={
            <RequireAdmin>
              <PurchaseReport />
            </RequireAdmin>
          }
        />
        <Route
          path="/reports/stock"
          element={
            <RequireAdmin>
              <StockReport />
            </RequireAdmin>
          }
        />
        <Route
          path="/reports/daybook"
          element={
            <RequireAdmin>
              <DayBook />
            </RequireAdmin>
          }
        />
        {/* Credit recoveries — kept separate from the Sales report */}
        <Route
          path="/reports/credit-recovery"
          element={
            <RequireAdmin>
              <CreditRecoveryReport />
            </RequireAdmin>
          }
        />
        <Route
          path="/reports/purchase-payments"
          element={
            <RequireAdmin>
              <PurchasePaymentsReport />
            </RequireAdmin>
          }
        />
        <Route
          path="/credit"
          element={
            <RequireAdmin>
              <CreditBook />
            </RequireAdmin>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAdmin>
              <AdminSettings />
            </RequireAdmin>
          }
        />
      </Route>
      <Route
        path="*"
        element={<Navigate to={session ? home : '/login'} replace />}
      />
    </Routes>
  )
}
