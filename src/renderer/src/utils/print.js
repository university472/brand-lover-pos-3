import { printerApi } from '../api/ipc.js'

// Adds a print-scope body class, sends the page straight to the default printer (no
// dialog), then cleans up. Falls back to the dialog on failure.
//
// Default scope 'print-page' = "print the current page". Callers used to pass nothing, and
// the app's global receipt/barcode print rules (`@media print { body * { visibility:
// hidden } }`) then hid everything → reports (Day Book, Customers, Stock, …) printed BLANK.
// Pages with their own layout still pass their own class ('print-ledger', 'print-sales', …).
export async function printNow(bodyClass = 'print-page') {
  if (bodyClass) document.body.classList.add(bodyClass)
  try {
    await new Promise((r) => setTimeout(r, 80)) // let the DOM/paint settle
    const res = await printerApi.print({})
    if (!res || !res.success) {
      // handler already opened the fallback dialog on the main side; nothing else to do
    }
  } catch {
    window.print() // hard fallback if IPC itself failed
  } finally {
    if (bodyClass)
      setTimeout(() => document.body.classList.remove(bodyClass), 250)
  }
}
