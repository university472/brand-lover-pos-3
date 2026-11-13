import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export default function Barcode({
  value,
  height = 48,
  width = 1.8,
  fontSize = 14,
  displayValue = true
}) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, String(value), {
        format: 'CODE128',
        height,
        width,
        fontSize,
        displayValue,
        margin: 4,
        textMargin: 3,
        font: 'monospace',
        textAlign: 'center',
        lineColor: '#000',
        background: '#ffffff'
      })
    } catch {
      /* invalid value — leave blank */
    }
  }, [value, height, width, fontSize, displayValue])
  if (!value) return <span className="bc-none">no code</span>
  return <svg ref={ref} className="bc-svg" />
}
