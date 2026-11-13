const bridge = window.api

async function call(fn, ...args) {
  const res = await fn(...args)
  if (!res || !res.ok) throw new Error(res?.error || 'Request failed')
  return res.data
}

export const authApi = {
  login: (creds) => call(bridge.auth.login, creds),
  logout: () => call(bridge.auth.logout),
  listUsers: () => call(bridge.auth.listUsers),
  verifyPassword: (p) => call(bridge.auth.verifyPassword, p),
  changePassword: (p) => call(bridge.auth.changePassword, p),
  listUsersAdmin: (p) => call(bridge.auth.listUsersAdmin, p),
  createUser: (p) => call(bridge.auth.createUser, p),
  updateUser: (p) => call(bridge.auth.updateUser, p),
  resetPassword: (p) => call(bridge.auth.resetPassword, p)
}

export const companyApi = {
  list: () => call(bridge.company.list),
  financialYears: () => call(bridge.company.financialYears),
  getProfile: () => call(bridge.company.getProfile),
  updateProfile: (p) => call(bridge.company.updateProfile, p)
}

export const dashboardApi = {
  getSummary: (params) => call(bridge.dashboard.getSummary, params),
  detail: (p) => call(bridge.dashboard.detail, p),
  reconciliation: (p) => call(bridge.dashboard.reconciliation, p),
  overdueSummary: () => call(bridge.dashboard.overdueSummary)
}

export const inventoryApi = {
  categories: {
    list: () => call(bridge.inventory.categories.list),
    create: (p) => call(bridge.inventory.categories.create, p),
    update: (p) => call(bridge.inventory.categories.update, p),
    toggle: (p) => call(bridge.inventory.categories.toggle, p)
  },
  subcategories: {
    list: (p) => call(bridge.inventory.subcategories.list, p),
    create: (p) => call(bridge.inventory.subcategories.create, p),
    update: (p) => call(bridge.inventory.subcategories.update, p),
    toggle: (p) => call(bridge.inventory.subcategories.toggle, p)
  },
  brands: {
    list: () => call(bridge.inventory.brands.list),
    create: (p) => call(bridge.inventory.brands.create, p)
  },
  items: {
    list: (p) => call(bridge.inventory.items.list, p),
    nextCode: () => call(bridge.inventory.items.nextCode),
    create: (p) => call(bridge.inventory.items.create, p),
    update: (p) => call(bridge.inventory.items.update, p),
    toggle: (p) => call(bridge.inventory.items.toggle, p),
    adjustStock: (p) => call(bridge.inventory.items.adjustStock, p),
    updateStockPrices: (p) => call(bridge.inventory.items.updateStockPrices, p),
    ledger: (p) => call(bridge.inventory.items.ledger, p),
    importExcel: () => call(bridge.inventory.items.importExcel),
    importTemplate: () => call(bridge.inventory.items.importTemplate),
    ensureBarcodes: () => call(bridge.inventory.items.ensureBarcodes),
    lowStock: () => call(bridge.inventory.items.lowStock),
    lowStockCount: () => call(bridge.inventory.items.lowStockCount)
  }
}

// export const salesApi = {
//   nextInvoiceNo: () => call(bridge.sales.nextInvoiceNo),
//   searchItems: (p) => call(bridge.sales.searchItems, p),
//   itemByCode: (p) => call(bridge.sales.itemByCode, p),
//   customers: () => call(bridge.sales.customers),
//   createCustomer: (p) => call(bridge.sales.createCustomer, p),
//   nextCustomerCode: () => call(bridge.sales.nextCustomerCode),
//   customerByCode: (p) => call(bridge.sales.customerByCode, p),
//   accounts: () => call(bridge.sales.accounts),
//   create: (p) => call(bridge.sales.create, p),
//   list: (p) => call(bridge.sales.list, p),
//   get: (p) => call(bridge.sales.get, p),
//   dailyPaymentTotals: (p) => call(bridge.sales.dailyPaymentTotals, p),
//   hold: (p) => call(bridge.sales.hold, p),
//   heldList: (p) => call(bridge.sales.heldList, p),
//   heldResume: (p) => call(bridge.sales.heldResume, p),
//   heldDelete: (p) => call(bridge.sales.heldDelete, p),
//   track: (p) => call(bridge.sales.track, p),
//   update: (p) => call(bridge.sales.update, p),
//   cancel: (p) => call(bridge.sales.cancel, p)
// }

export const salesApi = {
  nextInvoiceNo: () => call(bridge.sales.nextInvoiceNo),
  searchItems: (p) => call(bridge.sales.searchItems, p),
  itemByCode: (p) => call(bridge.sales.itemByCode, p),
  customers: () => call(bridge.sales.customers),
  searchCustomers: (p) => call(bridge.sales.searchCustomers, p), // ✅ NEW
  customerSummary: (p) => call(bridge.sales.customerSummary, p), // ✅ NEW
  createCustomer: (p) => call(bridge.sales.createCustomer, p),
  nextCustomerCode: () => call(bridge.sales.nextCustomerCode),
  customerByCode: (p) => call(bridge.sales.customerByCode, p),
  accounts: () => call(bridge.sales.accounts),
  create: (p) => call(bridge.sales.create, p),
  list: (p) => call(bridge.sales.list, p),
  get: (p) => call(bridge.sales.get, p),
  dailyPaymentTotals: (p) => call(bridge.sales.dailyPaymentTotals, p),
  hold: (p) => call(bridge.sales.hold, p),
  heldList: (p) => call(bridge.sales.heldList, p),
  heldResume: (p) => call(bridge.sales.heldResume, p),
  heldDelete: (p) => call(bridge.sales.heldDelete, p),
  track: (p) => call(bridge.sales.track, p),
  neighbor: (p) => call(bridge.sales.neighbor, p),
  findByNo: (p) => call(bridge.sales.findByNo, p),
  update: (p) => call(bridge.sales.update, p),
  cancel: (p) => call(bridge.sales.cancel, p)
}
export const salesmenApi = {
  list: () => call(bridge.salesmen.list),
  listAdmin: (p) => call(bridge.salesmen.listAdmin, p),
  create: (p) => call(bridge.salesmen.create, p),
  update: (p) => call(bridge.salesmen.update, p),
  toggle: (p) => call(bridge.salesmen.toggle, p),
  delete: (p) => call(bridge.salesmen.delete, p)
}

export const creditApi = {
  customers: (p) => call(bridge.credit.customers, p),
  ledger: (p) => call(bridge.credit.ledger, p),
  recordRepayment: (p) => call(bridge.credit.recordRepayment, p),
  updateRepayment: (p) => call(bridge.credit.updateRepayment, p),
  deleteRepayment: (p) => call(bridge.credit.deleteRepayment, p),
  refundCustomer: (p) => call(bridge.credit.refundCustomer, p),
  deleteCustomerRefund: (p) => call(bridge.credit.deleteCustomerRefund, p),
  accountLedger: (p) => call(bridge.credit.accountLedger, p),
  exportAccountLedger: (p) => call(bridge.credit.exportAccountLedger, p)
}

export const purchasesApi = {
  vendors: () => call(bridge.purchases.vendors),
  createVendor: (p) => call(bridge.purchases.createVendor, p),
  accounts: () => call(bridge.purchases.accounts),
  searchItems: (p) => call(bridge.purchases.searchItems, p),
  nextSerial: () => call(bridge.purchases.nextSerial),
  create: (p) => call(bridge.purchases.create, p),
  receive: (p) => call(bridge.purchases.receive, p),
  list: (p) => call(bridge.purchases.list, p),
  get: (p) => call(bridge.purchases.get, p),
  updateVendor: (p) => call(bridge.purchases.updateVendor, p),
  createBill: (p) => call(bridge.purchases.createBill, p),
  payVendor: (p) => call(bridge.purchases.payVendor, p),
  receiveFromVendor: (p) => call(bridge.purchases.receiveFromVendor, p),
  deleteVendorPayment: (p) => call(bridge.purchases.deleteVendorPayment, p),
  deleteBill: (p) => call(bridge.purchases.deleteBill, p),
  vendorLedger: (p) => call(bridge.purchases.vendorLedger, p),
  bills: (p) => call(bridge.purchases.bills, p),
  editBill: (p) => call(bridge.purchases.editBill, p),
  createReturn: (p) => call(bridge.purchases.createReturn, p),
  deleteReturn: (p) => call(bridge.purchases.deleteReturn, p),
  billDetail: (p) => call(bridge.purchases.billDetail, p)
}

export const reportsApi = {
  customerSummary: (p) => call(bridge.reports.customerSummary, p),
  customerDetail: (p) => call(bridge.reports.customerDetail, p),
  exportCustomerSummary: (p) => call(bridge.reports.exportCustomerSummary, p),
  salesSummary: (p) => call(bridge.reports.salesSummary, p),
  purchaseList: (p) => call(bridge.reports.purchaseList, p),
  stockValuation: (p) => call(bridge.reports.stockValuation, p),
  dayBook: (p) => call(bridge.reports.dayBook, p),
  exportReport: (p) => call(bridge.reports.exportReport, p),
  purchasePayments: (p) => call(bridge.reports.purchasePayments, p),
  salesmanPerformance: (p) => call(bridge.reports.salesmanPerformance, p),
  customerLedger: (p) => call(bridge.reports.customerLedger, p),
  customerBalances: (p) => call(bridge.reports.customerBalances, p),
  creditRecovery: (p) => call(bridge.reports.creditRecovery, p),
  salesInvoices: (p) => call(bridge.reports.salesInvoices, p),
  profitLoss: (p) => call(bridge.reports.profitLoss, p),
  profitLossDetail: (p) => call(bridge.reports.profitLossDetail, p),
  purchasesByProduct: (p) => call(bridge.reports.purchasesByProduct, p),
  purchasesByProductDetail: (p) =>
    call(bridge.reports.purchasesByProductDetail, p),
  stockTracker: (p) => call(bridge.reports.stockTracker, p)
}

export const returnsApi = {
  lookupSale: (p) => call(bridge.returns.lookupSale, p),
  create: (p) => call(bridge.returns.create, p),
  list: (p) => call(bridge.returns.list, p),
  findBillsByItem: (p) => call(bridge.returns.findBillsByItem, p),
  creditBills: (p) => call(bridge.returns.creditBills, p)
}

export const expensesApi = {
  categories: (p) => call(bridge.expenses.categories, p),
  addCategory: (p) => call(bridge.expenses.addCategory, p),
  accounts: (p) => call(bridge.expenses.accounts, p),
  create: (p) => call(bridge.expenses.create, p),
  update: (p) => call(bridge.expenses.update, p),
  delete: (p) => call(bridge.expenses.delete, p),
  list: (p) => call(bridge.expenses.list, p)
}

export const printerApi = {
  print: (opts = {}) => call(bridge.printer.print, opts),
  list: () => call(bridge.printer.list),
  printReceipt: (p) => call(bridge.printer.printReceipt, p),
  printLabels: (p) => call(bridge.printer.printLabels, p),
  printZplRaw: (p) => call(bridge.printer.printZplRaw, p)
}

export const backupApi = {
  status: () => call(bridge.backup.status),
  updateSettings: (p) => call(bridge.backup.updateSettings, p),
  chooseFolder: (p) => call(bridge.backup.chooseFolder, p),
  create: () => call(bridge.backup.create),
  openFolder: () => call(bridge.backup.openFolder),
  restore: (p) => call(bridge.backup.restore, p)
}
