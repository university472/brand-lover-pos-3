// import { printerApi } from '../api/ipc.js'

// const DPI = 203
// const MM = DPI / 25.4 // dots per mm

// // ---- Physical roll geometry (measured off the actual stock: 50*25*2000PCS) ----
// // Keep GAP_MM isolated so it's trivial to nudge after physical test prints.
// const TAG_W_MM = 50
// const TAG_H_MM = 25
// const GAP_MM = 3 // ~2-3mm gap between the two columns

// const TAG_W = Math.round(TAG_W_MM * MM) // ≈400 dots
// const TAG_H = Math.round(TAG_H_MM * MM) // ≈200 dots
// const GAP_W = Math.round(GAP_MM * MM) // ≈24 dots
// const ROW_W = TAG_W * 2 + GAP_W // ≈824 dots — total physical 2-up row width
// const ROW_H = TAG_H

// function zplSafe(s) {
//   return String(s || '')
//     .replace(/[\^~]/g, '')
//     .trim()
// }

// function money(n) {
//   return (
//     'Rs. ' +
//     Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
//   )
// }

// // Code 128 approx pixel width: (11*chars + 55) * moduleWidth
// function bcWidth(code, moduleW) {
//   return (11 * String(code).length + 55) * moduleW
// }

// // Renders ONE tag's content, offset horizontally by originX
// // (0 for the left tag, TAG_W+GAP_W for the right tag).
// function singleTagZpl(row, originX, opts) {
//   const {
//     shopName = '',
//     showShop = true,
//     showName = true,
//     showPrice = true,
//     offer = ''
//   } = opts

//   const pad = 4
//   const innerW = TAG_W - pad * 2
//   const parts = []
//   let y = pad

//   // ---- Shop name: top, centered, auto-shrinks so it never clips/overflows ----
//   if (showShop && shopName) {
//     const shop = zplSafe(shopName)
//     let h = 20
//     while (h > 12 && shop.length * h * 0.62 > innerW) h -= 2
//     const w = Math.round(h * 0.5)
//     parts.push(
//       `^FO${originX + pad},${y}^A0N,${h},${w}^FB${innerW},1,0,C,0^FD${shop}^FS`
//     )
//     y += h + 3
//   }

//   // ---- Item name (left) + Price (right) on one line, shrinks to avoid overlap ----
//   const priceStr = showPrice ? zplSafe(money(row.price)) : ''
//   const nameStr = showName
//     ? zplSafe(row.name + (row.size ? ` (${row.size})` : ''))
//     : ''

//   const priceH = 20
//   const priceW = Math.round(priceH * 0.5)
//   const priceTextW = priceStr ? priceStr.length * priceH * 0.62 : 0

//   let nameH = 22
//   if (nameStr) {
//     const availW = innerW - (priceTextW ? priceTextW + 8 : 0)
//     while (nameH > 12 && nameStr.length * nameH * 0.62 > availW) nameH -= 2
//   }
//   const nameW = Math.round(nameH * 0.5)
//   const rowH = Math.max(nameStr ? nameH : 0, priceStr ? priceH : 0, 16)

//   if (nameStr) {
//     parts.push(`^FO${originX + pad},${y}^A0N,${nameH},${nameW}^FD${nameStr}^FS`)
//   }
//   if (priceStr) {
//     const px = originX + TAG_W - pad - priceTextW
//     parts.push(
//       `^FO${Math.max(originX + pad, Math.round(px))},${y}^A0N,${priceH},${priceW}^FD${priceStr}^FS`
//     )
//   }
//   y += rowH + 4

//   // ---- Barcode: as wide as possible, then human-readable code + offer footer ----
//   const footH = 18
//   const barcodeH = Math.max(30, TAG_H - y - footH - pad)
//   const code = zplSafe(row.code)

//   let moduleW = 2
//   while (moduleW > 1 && bcWidth(code, moduleW) > innerW) moduleW -= 1
//   const bcW = bcWidth(code, moduleW)
//   const bcX = originX + Math.max(pad, Math.floor((TAG_W - bcW) / 2))

//   parts.push(`^BY${moduleW},2,${barcodeH}`)
//   parts.push(`^FO${bcX},${y}^BCN,${barcodeH},N,N,N^FD${code}^FS`)
//   y += barcodeH + 2

//   // Footer: item code bottom-left, offer bottom-right (only if present)
//   parts.push(`^FO${originX + pad},${y}^A0N,15,8^FD${code}^FS`)
//   const offerText = zplSafe(offer)
//   if (offerText) {
//     const offH = 15
//     const offW = offerText.length * offH * 0.62
//     const ox = originX + TAG_W - pad - offW
//     parts.push(
//       `^FO${Math.max(originX + pad, Math.round(ox))},${y}^A0N,${offH},8^FD${offerText}^FS`
//     )
//   }

//   return parts.join('\n')
// }

// // One physical 2-up row = ONE ^XA...^XZ label containing BOTH tags,
// // same product drawn twice (left column + right column).
// function rowZpl(row, opts, isFirst) {
//   const lines = ['^XA']
//   if (isFirst) {
//     // Physical media is die-cut / gapped 2-Up stock — NOT continuous.
//     // ^MNN (continuous) was the bug: it disables gap sensing, so the
//     // printer just estimates label length and drifts further down the
//     // roll with every subsequent print. ^MNY = non-continuous, web/gap
//     // sensing, which matches this media.
//     lines.push('^MNY')
//     lines.push('^JUS') // persist tracking mode
//   }
//   lines.push(`^PW${ROW_W}`)
//   lines.push(`^LL${ROW_H}`)
//   lines.push('^LH0,0')
//   lines.push(singleTagZpl(row, 0, opts))
//   lines.push(singleTagZpl(row, TAG_W + GAP_W, opts))
//   lines.push('^XZ')
//   return lines.join('\n')
// }

// // `rows`: one entry per physical 2-up row (== one entry per "copy").
// // Each row prints the SAME product in both columns, per spec.
// function buildLabelsZpl(rows, opts = {}) {
//   const zpl = rows.map((r, i) => rowZpl(r, opts, i === 0)).join('\n')
//   console.log('=== GENERATED ZPL ===', zpl)
//   return zpl
// }

// export async function printLabelsSheet(deviceName, rows, opts = {}) {
//   if (!rows || rows.length === 0) return { ok: false, error: 'No labels' }
//   if (!deviceName) return { ok: false, error: 'No printer selected' }

//   const zpl = buildLabelsZpl(rows, opts)
//   try {
//     await printerApi.printZplRaw({ deviceName, zpl })
//     return { ok: true }
//   } catch (e) {
//     return { ok: false, error: e.message }
//   }
// }

import { printerApi } from '../api/ipc.js'

const DPI = 203
const MM = DPI / 25.4 // dots per mm

// ---- Physical roll geometry (measured off the actual stock: 50*25*2000PCS) ----
// Keep GAP_MM isolated so it's trivial to nudge after physical test prints.
const TAG_W_MM = 50
const TAG_H_MM = 25
const GAP_MM = 3 // ~2-3mm gap between the two columns

const TAG_W = Math.round(TAG_W_MM * MM) // ≈400 dots
const TAG_H = Math.round(TAG_H_MM * MM) // ≈200 dots
const GAP_W = Math.round(GAP_MM * MM) // ≈24 dots
const ROW_W = TAG_W * 2 + GAP_W // ≈824 dots — total physical 2-up row width
const ROW_H = TAG_H

// ---- Tag layout tuning (all values in printer dots, 8 dots ≈ 1 mm) ----
// Change these after a physical test print instead of touching the logic.
const PAD_X = 8 // left/right safe margin inside each tag (~1mm)
const PAD_TOP = 8 // top safe margin
const PAD_BOTTOM = 12 // bottom safe margin — keeps the HR text off the die-cut edge

const SHOP_H = 20 // shop name height (shrinks for long names, min 14)
const SHOP_GAP = 6 // shop name → item line

const NAME_H = 26 // item name height (shrinks to NAME_MIN_H before wrapping)
const NAME_MIN_H = 20
const PRICE_H = 28 // price height — fixed, never shrinks
const NAME_PRICE_GAP = 16 // ~2mm between end of name and "Rs ..."
const FONT_W_RATIO = 0.85 // ^A0 width/height ratio: wider = thicker strokes on thermal
const CHAR_W_RATIO = 0.6 // est. avg glyph width of ^A0 per width unit (conservative)

const BARCODE_MAX_H = 90 // was effectively ~125 dots; ≈11mm still scans easily
const BARCODE_MIN_H = 50
const ITEM_TO_BARCODE_GAP = 8 // min space between item line and barcode

const HR_H = 20 // human-readable "* 0 4 1 8 4 *" height
const HR_GAP = 5 // bars → human-readable text (small visible gap)
const HR_WRAP_STARS = true // print the "* ... *" frame like the reference tag
const OFFER_H = 16
const OFFER_GAP = 2

function zplSafe(s) {
  return String(s || '')
    .replace(/[\^~]/g, '')
    .trim()
}

function money(n) {
  return (
    'Rs. ' +
    Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
  )
}

// Code 128 approx pixel width: (11*chars + 55) * moduleWidth
function bcWidth(code, moduleW) {
  return (11 * String(code).length + 55) * moduleW
}

// ^A0 width param for a given height (stroke weight comes from this)
function fontW(h) {
  return Math.round(h * FONT_W_RATIO)
}

// Conservative printed-width estimate for ^A0 text (over-estimates slightly,
// so the real gap is never smaller than intended)
function textW(str, h) {
  return Math.ceil(String(str).length * fontW(h) * CHAR_W_RATIO)
}

// "04184" -> "* 0 4 1 8 4 *"  (display only — barcode data is unchanged)
export function formatHumanReadable(code) {
  const chars = String(code || '').split('')
  if (HR_WRAP_STARS) return ['*', ...chars, '*'].join(' ')
  return chars.join(' ')
}

// Renders ONE tag's content, offset horizontally by originX
// (0 for the left tag, TAG_W+GAP_W for the right tag).
function singleTagZpl(row, originX, opts) {
  const {
    shopName = '',
    showShop = true,
    showName = true,
    showPrice = true,
    offer = ''
  } = opts

  const innerW = TAG_W - PAD_X * 2
  const left = originX + PAD_X
  const parts = []
  let y = PAD_TOP

  // ---- Shop name: top, centered, auto-shrinks so it never clips/overflows ----
  if (showShop && shopName) {
    const shop = zplSafe(shopName)
    let h = SHOP_H
    while (h > 14 && textW(shop, h) > innerW) h -= 2
    parts.push(
      `^FO${left},${y}^A0N,${h},${fontW(h)}^FB${innerW},1,0,C,0^FD${shop}^FS`
    )
    y += h + SHOP_GAP
  }

  // ---- Item name + price: one group, centered, price right after the name ----
  const priceStr = showPrice ? zplSafe(money(row.price)) : ''
  const nameStr = showName
    ? zplSafe(row.name + (row.size ? ` (${row.size})` : ''))
    : ''

  const priceTextW = priceStr ? textW(priceStr, PRICE_H) : 0
  const maxNameW = Math.max(
    60,
    innerW - (priceStr ? priceTextW + NAME_PRICE_GAP : 0)
  )

  let nameH = NAME_H
  let nameLines = 1
  let nameText = nameStr
  let nameBoxW = 0
  if (nameStr) {
    while (nameH > NAME_MIN_H && textW(nameStr, nameH) > maxNameW) nameH -= 2
    if (textW(nameStr, nameH) > maxNameW) {
      // Still too long at the minimum size → wrap to 2 lines, truncate beyond
      nameLines = 2
      const perLine = Math.floor(maxNameW / (fontW(nameH) * CHAR_W_RATIO))
      const maxChars = perLine * 2 - 2 // slack for word-wrap
      if (nameText.length > maxChars)
        nameText = nameText.slice(0, maxChars - 2).trimEnd() + '..'
      nameBoxW = maxNameW
    } else {
      nameBoxW = textW(nameStr, nameH)
    }
  }

  const groupW =
    nameBoxW + (nameStr && priceStr ? NAME_PRICE_GAP : 0) + priceTextW
  const groupX = left + Math.max(0, Math.floor((innerW - groupW) / 2))
  const nameBlockH = nameStr ? nameLines * nameH + (nameLines - 1) * 2 : 0
  const lineH = Math.max(nameBlockH, priceStr ? PRICE_H : 0)

  if (nameStr) {
    // single line: bottom-align with the (taller) price
    const ny = nameLines === 1 ? y + Math.max(0, lineH - nameH) : y
    const fb = nameLines === 2 ? `^FB${nameBoxW},2,2,L,0` : ''
    parts.push(
      `^FO${groupX},${ny}^A0N,${nameH},${fontW(nameH)}${fb}^FD${nameText}^FS`
    )
  }
  if (priceStr) {
    const px = nameStr ? groupX + nameBoxW + NAME_PRICE_GAP : groupX
    const py = nameLines === 1 ? y + Math.max(0, lineH - PRICE_H) : y
    parts.push(
      `^FO${Math.round(px)},${py}^A0N,${PRICE_H},${fontW(PRICE_H)}^FD${priceStr}^FS`
    )
  }
  if (lineH) y += lineH

  // ---- Footer is laid out from the bottom up so nothing touches the edge ----
  const code = zplSafe(row.code)
  const offerText = zplSafe(offer)
  let bottom = TAG_H - PAD_BOTTOM
  let offerY = null
  if (offerText) {
    offerY = bottom - OFFER_H
    bottom = offerY - OFFER_GAP
  }
  const hrY = bottom - HR_H
  const barcodeBottom = hrY - HR_GAP

  // ---- Barcode: same width/data/symbology, shorter bars, sits on the HR text ----
  const barcodeH = Math.max(
    BARCODE_MIN_H,
    Math.min(BARCODE_MAX_H, barcodeBottom - (y + ITEM_TO_BARCODE_GAP))
  )
  const barcodeY = barcodeBottom - barcodeH

  let moduleW = 2
  while (moduleW > 1 && bcWidth(code, moduleW) > innerW) moduleW -= 1
  const bcW = bcWidth(code, moduleW)
  const bcX = originX + Math.max(PAD_X, Math.floor((TAG_W - bcW) / 2))

  parts.push(`^BY${moduleW},2,${barcodeH}`)
  parts.push(`^FO${bcX},${barcodeY}^BCN,${barcodeH},N,N,N^FD${code}^FS`)

  // ---- Human-readable value, centered under the bars ----
  let hr = formatHumanReadable(code)
  if (textW(hr, HR_H) > innerW) hr = hr.replace(/ /g, '') // drop spacing first
  let hrH = HR_H
  while (hrH > 14 && textW(hr, hrH) > innerW) hrH -= 2
  parts.push(
    `^FO${left},${hrY + (HR_H - hrH)}^A0N,${hrH},${fontW(hrH)}^FB${innerW},1,0,C,0^FD${hr}^FS`
  )

  // ---- Offer line (only if present), centered at the very bottom ----
  if (offerText) {
    let oh = OFFER_H
    while (oh > 12 && textW(offerText, oh) > innerW) oh -= 2
    parts.push(
      `^FO${left},${offerY}^A0N,${oh},${fontW(oh)}^FB${innerW},1,0,C,0^FD${offerText}^FS`
    )
  }

  return parts.join('\n')
}

// One physical 2-up row = ONE ^XA...^XZ label containing BOTH tags,
// same product drawn twice (left column + right column).
function rowZpl(row, opts, isFirst) {
  const lines = ['^XA']
  if (isFirst) {
    // Physical media is die-cut / gapped 2-Up stock — NOT continuous.
    // ^MNN (continuous) was the bug: it disables gap sensing, so the
    // printer just estimates label length and drifts further down the
    // roll with every subsequent print. ^MNY = non-continuous, web/gap
    // sensing, which matches this media.
    lines.push('^MNY')
    lines.push('^JUS') // persist tracking mode
  }
  lines.push(`^PW${ROW_W}`)
  lines.push(`^LL${ROW_H}`)
  lines.push('^LH0,0')
  lines.push(singleTagZpl(row, 0, opts))
  lines.push(singleTagZpl(row, TAG_W + GAP_W, opts))
  lines.push('^XZ')
  return lines.join('\n')
}

// `rows`: one entry per physical 2-up row (== one entry per "copy").
// Each row prints the SAME product in both columns, per spec.
export function buildLabelsZpl(rows, opts = {}) {
  const zpl = rows.map((r, i) => rowZpl(r, opts, i === 0)).join('\n')
  console.log('=== GENERATED ZPL ===', zpl)
  return zpl
}

export async function printLabelsSheet(deviceName, rows, opts = {}) {
  if (!rows || rows.length === 0) return { ok: false, error: 'No labels' }
  // Web version prints through the browser dialog, so no named printer is needed.
  if (!deviceName && !window.__POS_WEB__) return { ok: false, error: 'No printer selected' }

  const zpl = buildLabelsZpl(rows, opts)
  try {
    await printerApi.printZplRaw({ deviceName, zpl })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}
