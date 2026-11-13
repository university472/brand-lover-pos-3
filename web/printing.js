// Browser printing for window.api.printer (the desktop printed silently from Electron).
// A web page cannot pick a printer or skip the dialog, so every print opens the browser's
// print dialog (choose the thermal / label printer there, or "Save as PDF").

function printHtmlDocument(html, { pageCss = '' } = {}) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument
    doc.open()
    doc.write(pageCss ? html.replace('</head>', `<style>${pageCss}</style></head>`) : html)
    doc.close()
    const done = () => {
      setTimeout(() => iframe.remove(), 1500)
      resolve({ ok: true, data: { success: true } })
    }
    const go = () => {
      try {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
      } catch {
        /* ignore */
      }
      done()
    }
    const imgs = Array.from(doc.images || [])
    Promise.race([
      Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))),
      new Promise((r) => setTimeout(r, 2500))
    ]).then(() => setTimeout(go, 150))
  })
}

// Copies the app's stylesheets so an element prints the way it looks on screen.
function currentStyles() {
  return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((n) => n.outerHTML)
    .join('\n')
}

export function installWebPrinting(api) {
  api.printer = {
    // Desktop: printed the whole window silently. Web: browser print of the current page —
    // the page's own @media print rules (body classes set by utils/print.js) still apply.
    print: async () => {
      window.print()
      return { ok: true, data: { success: true } }
    },
    list: async () => ({ ok: true, data: [{ name: 'Browser print dialog', isDefault: true }] }),
    printReceipt: async ({ html, widthMm = 72 } = {}) =>
      printHtmlDocument(html, { pageCss: `@page { size: ${widthMm}mm auto; margin: 0 }` }),
    printLabels: async ({ html, widthMm = 50.8, heightMm = 25.4 } = {}) =>
      printHtmlDocument(html, { pageCss: `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0 }` }),
    // Desktop sent raw ZPL to the Zebra. Browsers cannot, so print the on-screen label preview.
    printZplRaw: async () => {
      const sheet = document.getElementById('barcode-sheet')
      if (!sheet) return { ok: false, error: 'Nothing to print — select products first.' }
      const html =
        '<!doctype html><html><head><meta charset="utf-8">' +
        currentStyles() +
        '<style>body{margin:0;background:#fff} .bc-sheet{box-shadow:none!important;margin:0!important}' +
        ' .bc-row{break-inside:avoid;page-break-inside:avoid}</style></head><body>' +
        sheet.outerHTML +
        '</body></html>'
      return printHtmlDocument(html)
    }
  }
}
