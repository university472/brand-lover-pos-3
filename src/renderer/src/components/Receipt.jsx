// const money = (n) =>
//   Number(n || 0).toLocaleString('en-PK', {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2
//   })

// const SOFTWARE_MAKER_PHONE = '0300-8647649'
// const SOFTWARE_MAKER_NAME = 'Umer Tech'
// const RETURN_POLICY_URDU =
//   'واپسی یا تبدیلی تین دن کے اندر ہوگی۔ بل اپنے ساتھ لائیں۔'

// export default function Receipt({
//   data,
//   profile,
//   title = 'Sale Receipt',
//   variant = 'sale'
// }) {
//   if (!data) return null

//   const isReturn = variant === 'return'
//   const isRepayment = variant === 'repayment'
//   const isSale = !isReturn && !isRepayment
//   const items = data.lines || []

//   const payLabel = isRepayment
//     ? data.method === 'bank'
//       ? 'Online Payment'
//       : 'Cash Payment'
//     : isReturn
//       ? data.refundMode === 'credit_adjust'
//         ? 'Credit Reduced'
//         : data.refundMode === 'bank'
//           ? 'Bank Transfer'
//           : 'Cash Refund'
//       : { cash: '1 (Cash)', online: '2 (Online)', credit: '3 (Credit)' }[
//           data.paymentType
//         ] || data.paymentType

//   return (
//     <div className="rcpt" id="receipt">
//       {/* ---------- Header ---------- */}
//       <div className="rcpt-top">
//         {profile?.payment_qr_image && (
//           <div className="rcpt-qr">
//             <span className="rcpt-qr-label">
//               PAY
//               <br />
//               BY
//               <br />
//               QR
//             </span>
//             <img
//               className="rcpt-qr-img"
//               src={profile.payment_qr_image}
//               alt="Payment QR"
//             />
//           </div>
//         )}
//         <h2 className="rcpt-title">
//           {profile?.receipt_header || 'Brand Lover Family Store'}
//         </h2>
//         {profile?.receipt_tagline && (
//           <p className="rcpt-tag">{profile.receipt_tagline}</p>
//         )}
//         {profile?.address && <p className="rcpt-tel">{profile.address}</p>}
//         {profile?.phone && <p className="rcpt-tel">Tel: {profile.phone}</p>}
//       </div>

//       {/* Plain black text between two solid rules — prints reliably on thermal */}
//       <div className="rcpt-banner">{title}</div>

//       {/* ---------- Meta ---------- */}
//       <div className="rcpt-meta">
//         <div>
//           <span>
//             {isRepayment ? 'Voucher No.' : isReturn ? 'Return No.' : 'Bill No.'}
//           </span>
//           <span>
//             {isRepayment
//               ? data.voucherNo
//               : isReturn
//                 ? data.returnNo
//                 : data.invoiceNo}
//           </span>
//         </div>
//         <div>
//           <span>Date {data.dateOnly}</span>
//           <span>Time {data.timeOnly}</span>
//         </div>
//         {isReturn && data.invoiceNo && (
//           <div>
//             <span>Against Invoice</span>
//             <span>#{data.invoiceNo}</span>
//           </div>
//         )}
//         <div>
//           <span>Operator Name</span>
//           <span>{data.operator || data.salesman || '—'}</span>
//         </div>
//         {data.salesman &&
//           data.salesman !== '—' &&
//           data.salesman !== data.operator && (
//             <div>
//               <span>Salesman</span>
//               <span>{data.salesman}</span>
//             </div>
//           )}
//         <div>
//           <span>Customer Name</span>
//           <span>
//             {data.customer}
//             {data.customerCode ? ` (${data.customerCode})` : ''}
//           </span>
//         </div>
//         <div>
//           <span>
//             {isRepayment
//               ? 'Payment Method'
//               : isReturn
//                 ? 'Refund Method'
//                 : 'Payment Type'}
//           </span>
//           <span>{payLabel}</span>
//         </div>
//       </div>

//       {/* Separator below Payment Type */}
//       <div className="rcpt-sep" />

//       {/* ---------- Items ---------- */}
//       {!isRepayment && (
//         <table className="rcpt-table">
//           <thead>
//             <tr>
//               <th className="l">Description</th>
//               <th className="c">Qty</th>
//               <th className="r">Price</th>
//               <th className="r">Dis</th>
//               <th className="r">Total</th>
//             </tr>
//           </thead>
//           <tbody>
//             {items.map((l, i) => {
//               const qty = isReturn ? l.quantity : l.qty
//               const rate = Number(l.rate)
//               const net = isReturn ? Number(l.amount) : Number(l.net)
//               const disc = isReturn ? 0 : Number(l.qty) * rate - Number(l.net)
//               // Phase A6 — item code (sale uses .code, return uses .itemCode)
//               const code = isReturn ? l.itemCode : l.code
//               return (
//                 <tr key={l.itemId || i}>
//                   <td className="desc">
//                     {code && <span className="rc-code">{code} · </span>}
//                     {l.name}
//                   </td>
//                   <td className="c">{qty}</td>
//                   <td className="r">{money(rate)}</td>
//                   <td className="r">{money(disc)}</td>
//                   <td className="r t">{money(net)}</td>
//                 </tr>
//               )
//             })}
//             <tr className="rcpt-count">
//               <td>Item(s) {items.length}</td>
//               <td className="c" colSpan="2">
//                 Total Qty
//               </td>
//               <td colSpan="2" className="r">
//                 {items.reduce(
//                   (s, l) => s + Number(isReturn ? l.quantity : l.qty),
//                   0
//                 )}
//               </td>
//             </tr>
//           </tbody>
//         </table>
//       )}

//       {!isRepayment && <div className="rcpt-sep" />}

//       {/* ---------- Totals ---------- */}
//       {isRepayment ? (
//         <div className="rcpt-totals">
//           <div className="big">
//             <span>Amount Received Rs.</span>
//             <strong>{money(data.amount)}</strong>
//           </div>
//           {data.accountName && (
//             <div>
//               <span>Account</span>
//               <strong>{data.accountName}</strong>
//             </div>
//           )}
//           <div>
//             <span>Remaining Balance</span>
//             <strong>
//               {Number(data.remainingBalance) > 0.009
//                 ? 'Rs. ' + money(data.remainingBalance)
//                 : 'Fully Settled'}
//             </strong>
//           </div>
//         </div>
//       ) : isReturn ? (
//         <div className="rcpt-totals">
//           <div className="big">
//             <span>Refund Total Rs.</span>
//             <strong>{money(data.total)}</strong>
//           </div>
//           {data.accountName && (
//             <div>
//               <span>Account</span>
//               <strong>{data.accountName}</strong>
//             </div>
//           )}
//           {data.reason && (
//             <div>
//               <span>Reason</span>
//               <strong>{data.reason}</strong>
//             </div>
//           )}
//         </div>
//       ) : (
//         <div className="rcpt-totals">
//           <div>
//             <span>Gross Total</span>
//             <strong>{money(data.grossTotal ?? data.netTotal)}</strong>
//           </div>
//           <div>
//             <span>Discount</span>
//             <strong>{money(data.discountTotal || 0)}</strong>
//           </div>
//           <div className="big">
//             <span>Net Total Rs.</span>
//             <strong>{money(data.netTotal)}</strong>
//           </div>
//           <div>
//             <span>Amount Received</span>
//             <strong>{money(data.amountReceived)}</strong>
//           </div>
//           <div>
//             <span>Cash Back Rs.</span>
//             <strong>{money(data.change || 0)}</strong>
//           </div>
//           {data.outstanding > 0 && (
//             <div>
//               <span>Balance (Credit)</span>
//               <strong>{money(data.outstanding)}</strong>
//             </div>
//           )}
//         </div>
//       )}

//       {/* ---------- Return / exchange policy (replaces footer + barcode) ---------- */}
//       {isSale && (
//         <>
//           <div className="rcpt-sep" />
//           <p className="rcpt-policy">{RETURN_POLICY_URDU}</p>
//         </>
//       )}

//       {/* Shop's own closing line from Settings → Receipt ("Footer line") */}
//       {profile?.receipt_footer && <p className="rcpt-foot">{profile.receipt_footer}</p>}

//       <div className="rcpt-sw">
//         <p className="rcpt-sw-urdu">سافٹ ویئر بنوانے کے لیے رابطہ کریں</p>
//         <p className="rcpt-sw-line">
//           {SOFTWARE_MAKER_NAME} — {SOFTWARE_MAKER_PHONE}
//         </p>
//       </div>
//     </div>
//   )
// }

const money = (n) =>
  Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const SOFTWARE_MAKER_PHONE = '0300-8647649'
const SOFTWARE_MAKER_NAME = 'Umer Tech'
const RETURN_POLICY_URDU =
  'واپسی یا تبدیلی تین دن کے اندر ہوگی۔ بل اپنے ساتھ لائیں۔'

export default function Receipt({
  data,
  profile,
  title = 'Sale Receipt',
  variant = 'sale'
}) {
  if (!data) return null

  const isReturn = variant === 'return'
  const isRepayment = variant === 'repayment'
  const isSale = !isReturn && !isRepayment
  const items = data.lines || []

  const payLabel = isRepayment
    ? data.method === 'bank'
      ? 'Online Payment'
      : 'Cash Payment'
    : isReturn
      ? data.refundMode === 'credit_adjust'
        ? 'Credit Reduced'
        : data.refundMode === 'bank'
          ? 'Bank Transfer'
          : 'Cash Refund'
      : { cash: '1 (Cash)', online: '2 (Online)', credit: '3 (Credit)' }[
          data.paymentType
        ] || data.paymentType

  // 🆕 Discount presentation for a sale bill.
  //  • New callers pass itemDiscount + billDiscount → show two clean rows.
  //  • Old callers (returns, reprints, etc.) only pass discountTotal → fall back
  //    to the single "Discount" row exactly as before.
  const itemDisc = Number(data.itemDiscount) || 0
  const billDisc = Number(data.billDiscount) || 0
  const hasSplitDiscount = itemDisc > 0 || billDisc > 0
  const combinedDisc = Number(data.discountTotal) || itemDisc + billDisc

  return (
    <div className="rcpt" id="receipt">
      {/* ---------- Header ---------- */}
      <div className="rcpt-top">
        {profile?.payment_qr_image && (
          <div className="rcpt-qr">
            <span className="rcpt-qr-label">
              PAY
              <br />
              BY
              <br />
              QR
            </span>
            <img
              className="rcpt-qr-img"
              src={profile.payment_qr_image}
              alt="Payment QR"
            />
          </div>
        )}
        <h2 className="rcpt-title">
          {profile?.receipt_header || 'Brand Lover Family Store'}
        </h2>
        {profile?.receipt_tagline && (
          <p className="rcpt-tag">{profile.receipt_tagline}</p>
        )}
        {profile?.address && <p className="rcpt-tel">{profile.address}</p>}
        {profile?.phone && <p className="rcpt-tel">Tel: {profile.phone}</p>}
      </div>

      {/* Plain black text between two solid rules — prints reliably on thermal */}
      <div className="rcpt-banner">{title}</div>

      {/* ---------- Meta ---------- */}
      <div className="rcpt-meta">
        <div>
          <span>
            {isRepayment ? 'Voucher No.' : isReturn ? 'Return No.' : 'Bill No.'}
          </span>
          <span>
            {isRepayment
              ? data.voucherNo
              : isReturn
                ? data.returnNo
                : data.invoiceNo}
          </span>
        </div>
        <div>
          <span>Date {data.dateOnly}</span>
          <span>Time {data.timeOnly}</span>
        </div>
        {isReturn && data.invoiceNo && (
          <div>
            <span>Against Invoice</span>
            <span>#{data.invoiceNo}</span>
          </div>
        )}
        <div>
          <span>Operator Name</span>
          <span>{data.operator || data.salesman || '—'}</span>
        </div>
        {data.salesman &&
          data.salesman !== '—' &&
          data.salesman !== data.operator && (
            <div>
              <span>Salesman</span>
              <span>{data.salesman}</span>
            </div>
          )}
        <div>
          <span>Customer Name</span>
          <span>
            {data.customer}
            {data.customerCode ? ` (${data.customerCode})` : ''}
          </span>
        </div>
        <div>
          <span>
            {isRepayment
              ? 'Payment Method'
              : isReturn
                ? 'Refund Method'
                : 'Payment Type'}
          </span>
          <span>{payLabel}</span>
        </div>
      </div>

      {/* Separator below Payment Type */}
      <div className="rcpt-sep" />

      {/* ---------- Items ---------- */}
      {!isRepayment && (
        <table className="rcpt-table">
          <thead>
            <tr>
              <th className="l">Description</th>
              <th className="c">Qty</th>
              <th className="r">Price</th>
              <th className="r">Dis</th>
              <th className="r">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l, i) => {
              const qty = isReturn ? l.quantity : l.qty
              const rate = Number(l.rate)
              const net = isReturn ? Number(l.amount) : Number(l.net)
              const disc = isReturn ? 0 : Number(l.qty) * rate - Number(l.net)
              // Phase A6 — item code (sale uses .code, return uses .itemCode)
              const code = isReturn ? l.itemCode : l.code
              return (
                <tr key={l.itemId || i}>
                  <td className="desc">
                    {code && <span className="rc-code">{code} · </span>}
                    {l.name}
                  </td>
                  <td className="c">{qty}</td>
                  <td className="r">{money(rate)}</td>
                  <td className="r">{money(disc)}</td>
                  <td className="r t">{money(net)}</td>
                </tr>
              )
            })}
            <tr className="rcpt-count">
              <td>Item(s) {items.length}</td>
              <td className="c" colSpan="2">
                Total Qty
              </td>
              <td colSpan="2" className="r">
                {items.reduce(
                  (s, l) => s + Number(isReturn ? l.quantity : l.qty),
                  0
                )}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {!isRepayment && <div className="rcpt-sep" />}

      {/* ---------- Totals ---------- */}
      {isRepayment ? (
        <div className="rcpt-totals">
          <div className="big">
            <span>Amount Received Rs.</span>
            <strong>{money(data.amount)}</strong>
          </div>
          {data.accountName && (
            <div>
              <span>Account</span>
              <strong>{data.accountName}</strong>
            </div>
          )}
          <div>
            <span>Remaining Balance</span>
            <strong>
              {Number(data.remainingBalance) > 0.009
                ? 'Rs. ' + money(data.remainingBalance)
                : 'Fully Settled'}
            </strong>
          </div>
        </div>
      ) : isReturn ? (
        <div className="rcpt-totals">
          <div className="big">
            <span>Refund Total Rs.</span>
            <strong>{money(data.total)}</strong>
          </div>
          {data.accountName && (
            <div>
              <span>Account</span>
              <strong>{data.accountName}</strong>
            </div>
          )}
          {data.reason && (
            <div>
              <span>Reason</span>
              <strong>{data.reason}</strong>
            </div>
          )}
        </div>
      ) : (
        <div className="rcpt-totals">
          <div>
            <span>Gross Total</span>
            <strong>{money(data.grossTotal ?? data.netTotal)}</strong>
          </div>

          {/* 🆕 Split discount rows when the caller provides the breakdown,
              otherwise fall back to a single combined "Discount" row (old behaviour). */}
          {hasSplitDiscount ? (
            <>
              {itemDisc > 0 && (
                <div>
                  <span>Item Discounts</span>
                  <strong>{money(itemDisc)}</strong>
                </div>
              )}
              {billDisc > 0 && (
                <div>
                  <span>Bill Discount</span>
                  <strong>{money(billDisc)}</strong>
                </div>
              )}
            </>
          ) : (
            <div>
              <span>Discount</span>
              <strong>{money(combinedDisc)}</strong>
            </div>
          )}

          <div className="big">
            <span>Net Total Rs.</span>
            <strong>{money(data.netTotal)}</strong>
          </div>
          <div>
            <span>Amount Received</span>
            <strong>{money(data.amountReceived)}</strong>
          </div>
          <div>
            <span>Cash Back Rs.</span>
            <strong>{money(data.change || 0)}</strong>
          </div>
          {data.outstanding > 0 && (
            <div>
              <span>Balance (Credit)</span>
              <strong>{money(data.outstanding)}</strong>
            </div>
          )}
        </div>
      )}

      {/* ---------- Return / exchange policy (replaces footer + barcode) ---------- */}
      {isSale && (
        <>
          <div className="rcpt-sep" />
          <p className="rcpt-policy">{RETURN_POLICY_URDU}</p>
        </>
      )}

      {/* Shop's own closing line from Settings → Receipt ("Footer line") */}
      {profile?.receipt_footer && (
        <p className="rcpt-foot">{profile.receipt_footer}</p>
      )}

      <div className="rcpt-sw">
        <p className="rcpt-sw-urdu">سافٹ ویئر بنوانے کے لیے رابطہ کریں</p>
        <p className="rcpt-sw-line">
          {SOFTWARE_MAKER_NAME} — {SOFTWARE_MAKER_PHONE}
        </p>
      </div>
    </div>
  )
}
