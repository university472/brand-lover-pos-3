// import Icon from './Icons.jsx'

// export default function Modal({
//   title,
//   children,
//   onClose,
//   footer,
//   width = 540
// }) {
//   return (
//     <div className="modal-overlay" onMouseDown={onClose}>
//       <div
//         className="modal"
//         style={{ width }}
//         onMouseDown={(e) => e.stopPropagation()}
//       >
//         <div className="modal-head">
//           <h3>{title}</h3>
//           <button className="btn-icon" onClick={onClose} aria-label="Close">
//             <Icon name="x" size={18} />
//           </button>
//         </div>
//         <div className="modal-body">{children}</div>
//         {footer && <div className="modal-foot">{footer}</div>}
//       </div>
//     </div>
//   )
// }

import { useState, useRef, useEffect } from 'react'
import Icon from './Icons.jsx'

export default function Modal({
  title,
  children,
  onClose,
  footer,
  width = 540
}) {
  // Track the position offset from the center
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const mouseStart = useRef({ x: 0, y: 0 })

  // Handle dragging start
  const handleMouseDown = (e) => {
    // Prevent drag if clicking a button inside the header (e.g., the close button)
    if (e.target.closest('button')) return

    dragging.current = true
    startPos.current = pos
    mouseStart.current = { x: e.clientX, y: e.clientY }

    // Prevent text selection while dragging
    document.body.style.userSelect = 'none'
  }

  // Attach global listeners to track mouse movements anywhere on screen
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragging.current) return

      const deltaX = e.clientX - mouseStart.current.x
      const deltaY = e.clientY - mouseStart.current.y

      setPos({
        x: startPos.current.x + deltaX,
        y: startPos.current.y + deltaY
      })
    }

    const handleMouseUp = () => {
      if (dragging.current) {
        dragging.current = false
        document.body.style.userSelect = ''
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
    }
  }, [])

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal"
        style={{
          width,
          // Apply the calculated drag position
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          // Smooth transition only when NOT dragging (for initial open)
          transition: dragging.current ? 'none' : 'transform 0.1s ease-out',
          // Ensure the modal is above the overlay
          position: 'relative',
          zIndex: 1050
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="modal-head"
          onMouseDown={handleMouseDown}
          style={{
            cursor: 'grab',
            // Optional: add a subtle visual cue that it's draggable
            backgroundImage: 'linear-gradient(rgba(0,0,0,0.02), rgba(0,0,0,0))'
          }}
        >
          <h3 style={{ pointerEvents: 'none' }}>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
