import { contextBridge, ipcRenderer } from 'electron'

const api = {
  auth: {
    login: (creds) => ipcRenderer.invoke('auth:login', creds),
    logout: () => ipcRenderer.invoke('auth:logout'),
    listUsers: () => ipcRenderer.invoke('auth:list-users'),
    verifyPassword: (p) => ipcRenderer.invoke('auth:verify-password', p),
    changePassword: (p) => ipcRenderer.invoke('auth:change-password', p),
    listUsersAdmin: (p) => ipcRenderer.invoke('auth:list-users-admin', p),
    createUser: (p) => ipcRenderer.invoke('auth:create-user', p),
    updateUser: (p) => ipcRenderer.invoke('auth:update-user', p),
    resetPassword: (p) => ipcRenderer.invoke('auth:reset-password', p)
  },
  company: {
    list: () => ipcRenderer.invoke('company:list'),
    financialYears: () => ipcRenderer.invoke('company:financial-years'),
    getProfile: () => ipcRenderer.invoke('company:get-profile'),
    updateProfile: (p) => ipcRenderer.invoke('company:update-profile', p)
  },
  dashboard: {
    getSummary: (params) => ipcRenderer.invoke('dashboard:summary', params),
    detail: (p) => ipcRenderer.invoke('dashboard:detail', p),
    reconciliation: (p) => ipcRenderer.invoke('dashboard:reconciliation', p),
    overdueSummary: () => ipcRenderer.invoke('dashboard:overdue-summary')
  },
  inventory: {
    categories: {
      list: () => ipcRenderer.invoke('inventory:categories:list'),
      create: (p) => ipcRenderer.invoke('inventory:categories:create', p),
      update: (p) => ipcRenderer.invoke('inventory:categories:update', p),
      toggle: (p) => ipcRenderer.invoke('inventory:categories:toggle', p)
    },
    subcategories: {
      list: (p) => ipcRenderer.invoke('inventory:subcategories:list', p),
      create: (p) => ipcRenderer.invoke('inventory:subcategories:create', p),
      update: (p) => ipcRenderer.invoke('inventory:subcategories:update', p),
      toggle: (p) => ipcRenderer.invoke('inventory:subcategories:toggle', p)
    },
    brands: {
      list: () => ipcRenderer.invoke('inventory:brands:list'),
      create: (p) => ipcRenderer.invoke('inventory:brands:create', p)
    },
    items: {
      list: (p) => ipcRenderer.invoke('inventory:items:list', p),
      nextCode: () => ipcRenderer.invoke('inventory:items:next-code'),
      create: (p) => ipcRenderer.invoke('inventory:items:create', p),
      update: (p) => ipcRenderer.invoke('inventory:items:update', p),
      toggle: (p) => ipcRenderer.invoke('inventory:items:toggle', p),
      adjustStock: (p) => ipcRenderer.invoke('inventory:items:adjust-stock', p),
      updateStockPrices: (p) =>
        ipcRenderer.invoke('inventory:items:update-stock-prices', p),
      ledger: (p) => ipcRenderer.invoke('inventory:items:ledger', p),
      importExcel: () => ipcRenderer.invoke('inventory:items:import'),
      importTemplate: () =>
        ipcRenderer.invoke('inventory:items:import-template'),
      ensureBarcodes: () =>
        ipcRenderer.invoke('inventory:items:ensure-barcodes'),
      lowStock: () => ipcRenderer.invoke('inventory:items:low-stock'),
      lowStockCount: () => ipcRenderer.invoke('inventory:items:low-stock-count')
    }
  },
  returns: {
    lookupSale: (p) => ipcRenderer.invoke('returns:lookup-sale', p),
    create: (p) => ipcRenderer.invoke('returns:create', p),
    list: (p) => ipcRenderer.invoke('returns:list', p),
    findBillsByItem: (p) => ipcRenderer.invoke('returns:find-bills-by-item', p),
    creditBills: (p) => ipcRenderer.invoke('returns:credit-bills', p)
  },
  // sales: {
  //   nextInvoiceNo: () => ipcRenderer.invoke('sales:next-invoice-no'),
  //   searchItems: (p) => ipcRenderer.invoke('sales:search-items', p),
  //   itemByCode: (p) => ipcRenderer.invoke('sales:item-by-code', p),
  //   customers: () => ipcRenderer.invoke('sales:customers'),
  //   createCustomer: (p) => ipcRenderer.invoke('sales:create-customer', p),
  //   nextCustomerCode: () => ipcRenderer.invoke('sales:next-customer-code'),
  //   customerByCode: (p) => ipcRenderer.invoke('sales:customer-by-code', p),
  //   accounts: () => ipcRenderer.invoke('sales:accounts'),
  //   create: (p) => ipcRenderer.invoke('sales:create', p),
  //   list: (p) => ipcRenderer.invoke('sales:list', p),
  //   get: (p) => ipcRenderer.invoke('sales:get', p),
  //   dailyPaymentTotals: (p) =>
  //     ipcRenderer.invoke('sales:daily-payment-totals', p),
  //   hold: (p) => ipcRenderer.invoke('sales:hold', p),
  //   heldList: (p) => ipcRenderer.invoke('sales:held-list', p),
  //   heldResume: (p) => ipcRenderer.invoke('sales:held-resume', p),
  //   heldDelete: (p) => ipcRenderer.invoke('sales:held-delete', p),
  //   track: (p) => ipcRenderer.invoke('sales:track', p),
  //   update: (p) => ipcRenderer.invoke('sales:update', p),
  //   cancel: (p) => ipcRenderer.invoke('sales:cancel', p)
  // },

  sales: {
    nextInvoiceNo: () => ipcRenderer.invoke('sales:next-invoice-no'),
    searchItems: (p) => ipcRenderer.invoke('sales:search-items', p),
    itemByCode: (p) => ipcRenderer.invoke('sales:item-by-code', p),
    customers: () => ipcRenderer.invoke('sales:customers'),
    searchCustomers: (p) => ipcRenderer.invoke('sales:search-customers', p), // ✅ NEW
    customerSummary: (p) => ipcRenderer.invoke('sales:customer-summary', p), // ✅ NEW
    createCustomer: (p) => ipcRenderer.invoke('sales:create-customer', p),
    nextCustomerCode: () => ipcRenderer.invoke('sales:next-customer-code'),
    customerByCode: (p) => ipcRenderer.invoke('sales:customer-by-code', p),
    accounts: () => ipcRenderer.invoke('sales:accounts'),
    create: (p) => ipcRenderer.invoke('sales:create', p),
    list: (p) => ipcRenderer.invoke('sales:list', p),
    get: (p) => ipcRenderer.invoke('sales:get', p),
    dailyPaymentTotals: (p) =>
      ipcRenderer.invoke('sales:daily-payment-totals', p),
    hold: (p) => ipcRenderer.invoke('sales:hold', p),
    heldList: (p) => ipcRenderer.invoke('sales:held-list', p),
    heldResume: (p) => ipcRenderer.invoke('sales:held-resume', p),
    heldDelete: (p) => ipcRenderer.invoke('sales:held-delete', p),
    track: (p) => ipcRenderer.invoke('sales:track', p),
    neighbor: (p) => ipcRenderer.invoke('sales:neighbor', p),
    findByNo: (p) => ipcRenderer.invoke('sales:find-by-no', p),
    update: (p) => ipcRenderer.invoke('sales:update', p),
    cancel: (p) => ipcRenderer.invoke('sales:cancel', p)
  },
  credit: {
    customers: (p) => ipcRenderer.invoke('credit:customers', p),
    ledger: (p) => ipcRenderer.invoke('credit:ledger', p),
    recordRepayment: (p) => ipcRenderer.invoke('credit:record-repayment', p),
    updateRepayment: (p) => ipcRenderer.invoke('credit:update-repayment', p),
    deleteRepayment: (p) => ipcRenderer.invoke('credit:delete-repayment', p),
    refundCustomer: (p) => ipcRenderer.invoke('credit:refund-customer', p),
    deleteCustomerRefund: (p) =>
      ipcRenderer.invoke('credit:delete-customer-refund', p),
    accountLedger: (p) => ipcRenderer.invoke('credit:account-ledger', p),
    exportAccountLedger: (p) =>
      ipcRenderer.invoke('credit:export-account-ledger', p)
  },
  salesmen: {
    list: () => ipcRenderer.invoke('salesmen:list'),
    listAdmin: (p) => ipcRenderer.invoke('salesmen:list-admin', p),
    create: (p) => ipcRenderer.invoke('salesmen:create', p),
    update: (p) => ipcRenderer.invoke('salesmen:update', p),
    toggle: (p) => ipcRenderer.invoke('salesmen:toggle', p),
    delete: (p) => ipcRenderer.invoke('salesmen:delete', p)
  },
  purchases: {
    vendors: () => ipcRenderer.invoke('purchases:vendors'),
    createVendor: (p) => ipcRenderer.invoke('purchases:create-vendor', p),
    accounts: () => ipcRenderer.invoke('purchases:accounts'),
    searchItems: (p) => ipcRenderer.invoke('purchases:search-items', p),
    nextSerial: () => ipcRenderer.invoke('purchases:next-serial'),
    create: (p) => ipcRenderer.invoke('purchases:create', p),
    receive: (p) => ipcRenderer.invoke('purchases:receive', p),
    list: (p) => ipcRenderer.invoke('purchases:list', p),
    get: (p) => ipcRenderer.invoke('purchases:get', p),
    updateVendor: (p) => ipcRenderer.invoke('purchases:update-vendor', p),
    createBill: (p) => ipcRenderer.invoke('purchases:create-bill', p),
    payVendor: (p) => ipcRenderer.invoke('purchases:pay-vendor', p),
    receiveFromVendor: (p) =>
      ipcRenderer.invoke('purchases:receive-from-vendor', p),
    deleteVendorPayment: (p) =>
      ipcRenderer.invoke('purchases:delete-vendor-payment', p),
    deleteBill: (p) => ipcRenderer.invoke('purchases:delete-bill', p),
    vendorLedger: (p) => ipcRenderer.invoke('purchases:vendor-ledger', p),
    bills: (p) => ipcRenderer.invoke('purchases:bills', p),
    editBill: (p) => ipcRenderer.invoke('purchases:edit-bill', p),
    createReturn: (p) => ipcRenderer.invoke('purchases:create-return', p),
    deleteReturn: (p) => ipcRenderer.invoke('purchases:delete-return', p),
    billDetail: (p) => ipcRenderer.invoke('purchases:bill-detail', p)
  },
  reports: {
    customerSummary: (p) => ipcRenderer.invoke('reports:customer-summary', p),
    customerDetail: (p) => ipcRenderer.invoke('reports:customer-detail', p),
    exportCustomerSummary: (p) =>
      ipcRenderer.invoke('reports:export-customer-summary', p),
    salesSummary: (p) => ipcRenderer.invoke('reports:sales-summary', p),
    purchaseList: (p) => ipcRenderer.invoke('reports:purchase-list', p),
    stockValuation: (p) => ipcRenderer.invoke('reports:stock-valuation', p),
    dayBook: (p) => ipcRenderer.invoke('reports:day-book', p),
    exportReport: (p) => ipcRenderer.invoke('reports:export', p),
    purchasePayments: (p) => ipcRenderer.invoke('reports:purchase-payments', p),
    salesmanPerformance: (p) =>
      ipcRenderer.invoke('reports:salesman-performance', p),
    customerLedger: (p) => ipcRenderer.invoke('reports:customer-ledger', p),
    customerBalances: (p) => ipcRenderer.invoke('reports:customer-balances', p),
    creditRecovery: (p) => ipcRenderer.invoke('reports:credit-recovery', p),
    salesInvoices: (p) => ipcRenderer.invoke('reports:sales-invoices', p),
    profitLoss: (p) => ipcRenderer.invoke('reports:profit-loss', p),
    profitLossDetail: (p) =>
      ipcRenderer.invoke('reports:profit-loss-detail', p),
    purchasesByProduct: (p) =>
      ipcRenderer.invoke('reports:purchases-by-product', p),
    purchasesByProductDetail: (p) =>
      ipcRenderer.invoke('reports:purchases-by-product-detail', p),
    stockTracker: (p) => ipcRenderer.invoke('reports:stock-tracker', p)
  },
  expenses: {
    categories: (p) => ipcRenderer.invoke('expenses:categories', p),
    addCategory: (p) => ipcRenderer.invoke('expenses:add-category', p),
    accounts: (p) => ipcRenderer.invoke('expenses:accounts', p),
    create: (p) => ipcRenderer.invoke('expenses:create', p),
    update: (p) => ipcRenderer.invoke('expenses:update', p),
    delete: (p) => ipcRenderer.invoke('expenses:delete', p),
    list: (p) => ipcRenderer.invoke('expenses:list', p)
  },
  backup: {
    status: () => ipcRenderer.invoke('backup:status'),
    updateSettings: (p) => ipcRenderer.invoke('backup:update-settings', p),
    chooseFolder: (p) => ipcRenderer.invoke('backup:choose-folder', p),
    create: () => ipcRenderer.invoke('backup:create'),
    openFolder: () => ipcRenderer.invoke('backup:open-folder'),
    restore: (p) => ipcRenderer.invoke('backup:restore', p)
  },
  printer: {
    print: (opts) => ipcRenderer.invoke('print:silent', opts),
    list: () => ipcRenderer.invoke('printer:list'),
    printReceipt: (p) => ipcRenderer.invoke('print:receipt', p),
    printLabels: (p) => ipcRenderer.invoke('print:labels', p),
    printZplRaw: (p) => ipcRenderer.invoke('printer:zpl-raw', p)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.api = api
}
