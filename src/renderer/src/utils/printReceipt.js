// import { printerApi } from '../api/ipc.js'

// // localStorage se positive number, warna default
// const num = (v, d) => {
//   const n = Number(v)
//   return Number.isFinite(n) && n > 0 ? n : d
// }
// const numAny = (v, d) => {
//   const n = Number(v)
//   return Number.isFinite(n) ? n : d
// }

// function buildCss(widthMm, offsetMm) {
//   return `
// * {
//   box-sizing: border-box;
//   margin: 0;
//   padding: 0;
//   -webkit-print-color-adjust: exact !important;
//   print-color-adjust: exact !important;
//   -webkit-font-smoothing: none !important;
//   text-rendering: geometricPrecision;
// }

// /* Physical page size = chosen width. Display-scaling se independent. */
// @page {
//   size: ${widthMm}mm auto;
//   margin: 0;
// }

// html,
// body {
//   width: ${widthMm}mm;
//   margin: 0;
//   padding: 0;
//   background: #fff;
//   color: #000;
//   overflow: visible;
//   font-family: 'Segoe UI', Arial, sans-serif;
//   font-weight: 700;
// }

// /* Width + Shift Settings (localStorage) se aate hain — live tunable */
// .rcpt,
// .receipt-print {
//   width: ${widthMm}mm !important;
//   max-width: ${widthMm}mm !important;
//   margin: 0 !important;
//   padding: 1mm 1.5mm !important;
//   transform: translateX(${offsetMm}mm);
//   color: #000;
//   font-size: 12px;
//   font-weight: 700;
// }

// .rcpt *,
// .receipt-print * {
//   color: #000 !important;
//   font-weight: 700 !important;
// }

// .rcpt-top { text-align: center; }

// .rcpt-qr {
//   display: flex;
//   align-items: center;
//   justify-content: center;
//   gap: 10px;
//   margin-bottom: 8px;
// }
// .rcpt-qr-label { font-size: 13px; line-height: 1.1; letter-spacing: 1px; font-weight: 900 !important; }
// .rcpt-qr-img { width: 92px; height: 92px; object-fit: contain; filter: contrast(1.6) brightness(0.85); }

// .rcpt-title { font-size: 18px; line-height: 1.15; letter-spacing: .5px; font-weight: 900 !important; }
// .rcpt-tag, .rcpt-tel { font-size: 11px; margin-top: 2px; }

// .rcpt-banner { background: #000 !important; text-align: center; font-size: 12px; padding: 3px 0; margin: 8px 0; }
// .rcpt-banner, .rcpt-banner * { color: #fff !important; font-weight: 900 !important; }

// .rcpt-meta { font-size: 11.5px; }
// .rcpt-meta div { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; }

// .rcpt-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11.5px; }
// .rcpt-table th { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 5px 2px; text-align: left; font-weight: 900 !important; }
// .rcpt-table th:nth-child(n+2), .rcpt-table td.c, .rcpt-table td.r { text-align: right; }
// .rcpt-table td.c { text-align: center; }
// .rcpt-table td { padding: 5px 2px; }
// .rcpt-count td { border-top: 1px dashed #000; padding-top: 6px; font-weight: 900 !important; }

// .rcpt-totals div { display: flex; justify-content: space-between; padding: 4px 0; }
// .rcpt-totals .big { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 5px 0; margin: 4px 0; font-size: 15px; font-weight: 900 !important; }
// .rcpt-totals .big strong { font-weight: 900 !important; }

// .rcpt-foot { text-align: center; font-size: 11px; margin: 10px 0; }
// .rcpt-barcode { display: block; margin: 4px auto 0; max-width: 100%; filter: contrast(1.4); }
// .rc-code { color: #000; font-size: 10px; }

// .rcpt-sw { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #000; text-align: center; }
// .rcpt-sw-urdu { font-size: 13px; direction: rtl; margin: 0 0 4px; line-height: 1.6; }
// .rcpt-sw-line { font-size: 11px; margin: 0; }

// /* simple receipt fallback */
// .rc-head { text-align: center; margin-bottom: 10px; }
// .rc-head h2 { font-size: 18px; font-weight: 900 !important; }
// .rc-head p { font-size: 12px; }
// .rc-table th { font-weight: 900 !important; border-bottom: 2px solid #000; }

// /* ===== Print ruler (calibration) ===== */
// .cal-wrap { width: ${widthMm}mm; padding: 2mm 0; color: #000; font-family: 'Segoe UI', Arial, sans-serif; }
// .cal-title { text-align: center; font-weight: 900; font-size: 12px; margin-bottom: 4mm; }
// .cal-ruler { position: relative; width: ${widthMm}mm; height: 14mm; border-top: 2px solid #000; }
// .cal-edge { position: absolute; top: 0; height: 14mm; width: 2px; background: #000; }
// .cal-edge.l { left: 0; }
// .cal-edge.r { right: 0; }
// .cal-tick { position: absolute; top: 0; width: 1px; height: 4mm; background: #000; }
// .cal-tick.big { height: 8mm; }
// .cal-tick span { position: absolute; top: 8mm; left: 1px; font-size: 8px; font-weight: 700; }
// .cal-note { font-size: 10px; margin-top: 10mm; text-align: center; }

// @media print {
//   .rcpt, .rcpt *, .receipt-print, .receipt-print *, .cal-wrap, .cal-wrap * {
//     color: #000 !important; font-weight: 700 !important;
//     -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
//   }
//   .rcpt-title, .rcpt-table th, .rcpt-count td, .rcpt-totals .big, .rcpt-totals .big strong, .rc-head h2, .rc-table th { font-weight: 900 !important; }
//   .rcpt-banner, .rcpt-banner * { background: #000 !important; color: #fff !important; font-weight: 900 !important; }
// }
// `
// }

// function rulerHtml(widthMm) {
//   let ticks = ''
//   for (let mm = 0; mm <= widthMm; mm += 5) {
//     const big = mm % 10 === 0
//     ticks += `<div class="cal-tick ${big ? 'big' : ''}" style="left:${mm}mm">${big ? `<span>${mm}</span>` : ''}</div>`
//   }
//   return `
//     <div class="cal-wrap">
//       <div class="cal-title">PRINT RULER — width ${widthMm}mm</div>
//       <div class="cal-ruler">
//         <div class="cal-edge l"></div>
//         <div class="cal-edge r"></div>
//         ${ticks}
//       </div>
//       <div class="cal-note">
//         Left aur right dono kaali line dikhni chahiye.<br/>
//         Left cut ho -> Shift + (right). Right cut ho -> Shift -.<br/>
//         Dono taraf blank ho -> Width barhao.
//       </div>
//     </div>`
// }

// export async function printReceiptElement(elId = 'receipt', opts = {}) {
//   // 📍 Calibration Settings se aati hai (AdminSettings -> Receipt print alignment)
//   const widthMm = num(localStorage.getItem('receiptWidthMm'), 80)
//   const offsetMm = numAny(localStorage.getItem('receiptOffsetMm'), 0)

//   let inner
//   if (opts.ruler) {
//     inner = rulerHtml(widthMm)
//   } else {
//     const el = document.getElementById(elId || 'receipt')
//     if (!el) {
//       return { ok: false, error: 'Receipt not found in DOM.' }
//     }
//     inner = el.outerHTML
//   }

//   const html =
//     '<!doctype html>' +
//     '<html><head><meta charset="utf-8"><style>' +
//     buildCss(widthMm, offsetMm) +
//     '</style></head><body>' +
//     inner +
//     '</body></html>'

//   let deviceName = opts.printerName || localStorage.getItem('receiptPrinter')

//   if (!deviceName) {
//     try {
//       const list = await printerApi.list()
//       const bc = list.find((p) =>
//         /black\s*copper|bc87|bc-?lp|bc-?sale|pos-?80|thermal/i.test(p.name)
//       )
//       if (bc) {
//         deviceName = bc.name
//         localStorage.setItem('receiptPrinter', bc.name)
//       }
//     } catch {
//       // ignore
//     }
//   }

//   // 📍 Page width = content width (dono same) taake driver ke printable pe theek baithe.
//   return printerApi.printReceipt({
//     html,
//     widthMm,
//     deviceName: deviceName || undefined
//   })
// }


import { printerApi } from '../api/ipc.js'

// localStorage se positive number, warna default
const num = (v, d) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : d
}
const numAny = (v, d) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

/*
  Thermal print CSS — this is what the PRINTER actually receives.
  Weight rule: only 600 (Segoe UI Semibold) and 700 (Bold).
  Never 800/900: on Windows those resolve to "Segoe UI Black",
  which smears and merges letters on thermal paper.
  Lines are 2px (≈ 4 dots at 203 dpi) so they never drop out.
*/
function buildCss(widthMm, offsetMm) {
  return `
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  text-rendering: geometricPrecision;
}

@page {
  size: ${widthMm}mm auto;
  margin: 0;
}

html,
body {
  width: ${widthMm}mm;
  margin: 0;
  padding: 0;
  background: #fff;
  color: #000;
  overflow: visible;
  font-family: 'Segoe UI', Arial, sans-serif;
  font-weight: 600;
}

/* ===== Receipt ===== */
.rcpt,
.receipt-print {
  width: ${widthMm}mm !important;
  max-width: ${widthMm}mm !important;
  margin: 0 !important;
  padding: 1mm 2mm 2mm !important;
  transform: translateX(${offsetMm}mm);
  color: #000;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
}
.rcpt *,
.receipt-print * { color: #000 !important; }

.rcpt-top { text-align: center; }

.rcpt-qr { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 6px; }
.rcpt-qr-label { font-size: 13px; line-height: 1.15; letter-spacing: 1px; font-weight: 700; }
.rcpt-qr-img { width: 92px; height: 92px; object-fit: contain; filter: contrast(1.6); }

.rcpt-title { font-size: 20px; line-height: 1.2; letter-spacing: .3px; font-weight: 700; }
.rcpt-tag, .rcpt-tel { font-size: 12.5px; font-weight: 600; margin-top: 2px; }

/* "Sale Receipt" — black text between solid rules (no black fill) */
.rcpt-banner {
  background: #fff;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: .5px;
  padding: 4px 0;
  margin: 8px 0 6px;
  border-top: 2px solid #000;
  border-bottom: 2px solid #000;
}

.rcpt-meta { font-size: 13px; }
.rcpt-meta > div { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 2px 0; }
.rcpt-meta > div > span:first-child { font-weight: 600; white-space: nowrap; }
.rcpt-meta > div > span:last-child { font-weight: 700; text-align: right; word-break: break-word; }

/* Separator lines */
.rcpt-sep { height: 0; border-top: 2px dashed #000; margin: 6px 0; }

/* Items table — auto layout so numbers keep their width, description wraps */
.rcpt-table { width: 100%; border-collapse: collapse; margin: 2px 0 0; font-size: 12.5px; }
.rcpt-table th {
  font-size: 13px;
  font-weight: 700;
  padding: 4px 2px;
  border-top: 2px solid #000;
  border-bottom: 2px solid #000;
  white-space: nowrap;
}
.rcpt-table td { padding: 4px 2px; font-weight: 600; vertical-align: top; }
.rcpt-table .l, .rcpt-table .desc { text-align: left; }
.rcpt-table .desc { word-break: break-word; }
.rcpt-table .c { text-align: center; white-space: nowrap; }
.rcpt-table .r { text-align: right; white-space: nowrap; }
.rcpt-table td.t { font-weight: 700; }
.rcpt-count td { border-top: 2px dashed #000; padding-top: 5px; font-weight: 700; }
.rc-code { font-size: 11px; font-weight: 600; }

/* Totals */
.rcpt-totals { font-size: 13.5px; }
.rcpt-totals > div { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 3px 0; }
.rcpt-totals > div > span { font-weight: 600; }
.rcpt-totals > div > strong { font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.rcpt-totals .big {
  border-top: 2px solid #000;
  border-bottom: 2px solid #000;
  margin: 5px 0;
  padding: 5px 0;
  font-size: 17px;
}
.rcpt-totals .big > span { font-weight: 700; }
.rcpt-totals .big > strong { font-size: 18px; font-weight: 700; }

/* Return / exchange policy */
.rcpt-policy {
  direction: rtl;
  text-align: center;
  font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', 'Urdu Typesetting', Arial, sans-serif;
  font-size: 17px;
  font-weight: 700;
  line-height: 2;
  margin: 4px 0 2px;
}

/* Software maker */
.rcpt-sw { margin-top: 6px; padding-top: 6px; border-top: 2px dashed #000; text-align: center; }
.rcpt-sw-urdu {
  font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', 'Urdu Typesetting', Arial, sans-serif;
  font-size: 13px;
  font-weight: 600;
  direction: rtl;
  line-height: 1.9;
  margin: 0 0 2px;
}
.rcpt-sw-line { font-size: 12px; font-weight: 600; margin: 0; }

/* simple receipt fallback */
.rc-head { text-align: center; margin-bottom: 10px; }
.rc-head h2 { font-size: 18px; font-weight: 700; }
.rc-head p { font-size: 12px; }
.rc-table th { font-weight: 700; border-bottom: 2px solid #000; }

/* ===== Print ruler (calibration) ===== */
.cal-wrap { width: ${widthMm}mm; padding: 2mm 0; color: #000; font-family: 'Segoe UI', Arial, sans-serif; }
.cal-title { text-align: center; font-weight: 700; font-size: 12px; margin-bottom: 4mm; }
.cal-ruler { position: relative; width: ${widthMm}mm; height: 14mm; border-top: 2px solid #000; }
.cal-edge { position: absolute; top: 0; height: 14mm; width: 2px; background: #000; }
.cal-edge.l { left: 0; }
.cal-edge.r { right: 0; }
.cal-tick { position: absolute; top: 0; width: 1px; height: 4mm; background: #000; }
.cal-tick.big { height: 8mm; }
.cal-tick span { position: absolute; top: 8mm; left: 1px; font-size: 8px; font-weight: 700; }
.cal-note { font-size: 10px; margin-top: 10mm; text-align: center; }
`
}

function rulerHtml(widthMm) {
  let ticks = ''
  for (let mm = 0; mm <= widthMm; mm += 5) {
    const big = mm % 10 === 0
    ticks += `<div class="cal-tick ${big ? 'big' : ''}" style="left:${mm}mm">${big ? `<span>${mm}</span>` : ''}</div>`
  }
  return `
    <div class="cal-wrap">
      <div class="cal-title">PRINT RULER — width ${widthMm}mm</div>
      <div class="cal-ruler">
        <div class="cal-edge l"></div>
        <div class="cal-edge r"></div>
        ${ticks}
      </div>
      <div class="cal-note">
        Left aur right dono kaali line dikhni chahiye.<br/>
        Left cut ho -> Shift + (right). Right cut ho -> Shift -.<br/>
        Dono taraf blank ho -> Width barhao.
      </div>
    </div>`
}

export async function printReceiptElement(elId = 'receipt', opts = {}) {
  // 📍 Calibration Settings se aati hai (AdminSettings -> Receipt print alignment)
  const widthMm = num(localStorage.getItem('receiptWidthMm'), 80)
  const offsetMm = numAny(localStorage.getItem('receiptOffsetMm'), 0)

  let inner
  if (opts.ruler) {
    inner = rulerHtml(widthMm)
  } else {
    const el = document.getElementById(elId || 'receipt')
    if (!el) {
      return { ok: false, error: 'Receipt not found in DOM.' }
    }
    inner = el.outerHTML
  }

  const html =
    '<!doctype html>' +
    '<html><head><meta charset="utf-8"><style>' +
    buildCss(widthMm, offsetMm) +
    '</style></head><body>' +
    inner +
    '</body></html>'

  let deviceName = opts.printerName || localStorage.getItem('receiptPrinter')

  if (!deviceName) {
    try {
      const list = await printerApi.list()
      const bc = list.find((p) =>
        /black\s*copper|bc87|bc-?lp|bc-?sale|pos-?80|thermal/i.test(p.name)
      )
      if (bc) {
        deviceName = bc.name
        localStorage.setItem('receiptPrinter', bc.name)
      }
    } catch {
      // ignore
    }
  }

  // 📍 Page width = content width (dono same) taake driver ke printable pe theek baithe.
  return printerApi.printReceipt({
    html,
    widthMm,
    deviceName: deviceName || undefined
  })
}
