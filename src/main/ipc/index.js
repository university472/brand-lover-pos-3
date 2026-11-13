import { registerAuthHandlers } from './auth.handlers.js'
import { registerCompanyHandlers } from './company.handlers.js'
import { registerDashboardHandlers } from './dashboard.handlers.js'
import { registerInventoryHandlers } from './inventory.handlers.js'
import { registerSalesHandlers } from './sales.handlers.js'
import { registerSalesmenHandlers } from './salesmen.handlers.js'
import { registerPurchasesHandlers } from './purchases.handlers.js'
import { registerCreditHandlers } from './credit.handlers.js'
import { registerReportsHandlers } from './reports.handlers.js'
import { registerReturnsHandlers } from './returns.handlers.js'
import { registerExpensesHandlers } from './expenses.handlers.js'
import { registerBackupHandlers } from './backup.handlers.js'
import { authorize, ADMIN_ROLES, ALL_ROLES } from '../services/auth.guard.js'

// Who may call what. Checked here, in the main process, against the logged-in session user —
// so hiding a page in the window is no longer the only protection (DevTools could call any
// handler directly).
// PUBLIC: needed before login (login screen) or harmless.
const PUBLIC = new Set([
  'auth:login',
  'auth:logout',
  'auth:list-users',
  'company:list',
  'company:financial-years',
  'company:get-profile'
])
// Salesman (cashier) role: only what the Counter Sale screen needs.
const CASHIER = new Set([
  'auth:verify-password',
  'auth:change-password',
  'sales:next-invoice-no',
  'sales:search-items',
  'sales:item-by-code',
  'sales:customers',
  'sales:search-customers',
  'sales:customer-summary',
  'sales:create-customer',
  'sales:next-customer-code',
  'sales:customer-by-code',
  'sales:accounts',
  'sales:create',
  'sales:hold',
  'sales:held-list',
  'sales:held-resume',
  'sales:held-delete',
  // Counter Sale → Previous Invoices / Last Bill: browse, open, reprint (read-only).
  // sales:update / sales:cancel stay Owner / Manager only.
  'sales:track',
  'sales:get',
  'sales:neighbor',
  'sales:find-by-no',
  'salesmen:list',
  'inventory:items:low-stock-count'
])
// Everything else: Owner / Manager only.

function guarded(ipcMain) {
  return {
    handle(channel, fn) {
      ipcMain.handle(channel, async (event, ...args) => {
        if (!PUBLIC.has(channel)) {
          try {
            await authorize(null, CASHIER.has(channel) ? ALL_ROLES : ADMIN_ROLES)
          } catch (err) {
            return { ok: false, error: err.message }
          }
        }
        return fn(event, ...args)
      })
    }
  }
}

export function registerIpcHandlers(ipcMain) {
  const g = guarded(ipcMain)
  registerAuthHandlers(g)
  registerCompanyHandlers(g)
  registerDashboardHandlers(g)
  registerInventoryHandlers(g)
  registerSalesHandlers(g)
  registerSalesmenHandlers(g)
  registerPurchasesHandlers(g)
  registerCreditHandlers(g)
  registerReportsHandlers(g)
  registerReturnsHandlers(g)
  registerExpensesHandlers(g)
  registerBackupHandlers(g)
}
