'use client'
import { useEffect, useRef, useState } from 'react'

const SIZE = 56
const STORAGE_KEY = 'gramRideSosPosition'

// A round SOS button that floats above the page. Tap it to open the SOS confirmation.
// Press, hold and drag it to move it anywhere; it remembers where you left it.
export default function FloatingSos({ onPress, label = 'SOS' }) {
  const [pos, setPos] = useState(null)
  const posRef = useRef(null)
  const drag = useRef({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0 })

  const clamp = (x, y) => ({
    x: Math.min(Math.max(8, x), window.innerWidth - SIZE - 8),
    y: Math.min(Math.max(8, y), window.innerHeight - SIZE - 8),
  })

  useEffect(() => {
    let start = { x: window.innerWidth - SIZE - 16, y: window.innerHeight - SIZE - 96 }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') start = saved
    } catch {}
    const first = clamp(start.x, start.y)
    posRef.current = first
    setPos(first)
  }, [])

  const onPointerDown = (e) => {
    if (!posRef.current) return
    drag.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      originX: posRef.current.x,
      originY: posRef.current.y,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const d = drag.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) + Math.abs(dy) > 8) d.moved = true
    if (d.moved) {
      const next = clamp(d.originX + dx, d.originY + dy)
      posRef.current = next
      setPos(next)
    }
  }

  const onPointerUp = () => {
    const d = drag.current
    if (!d.active) return
    d.active = false
    if (d.moved) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current)) } catch {}
    } else {
      onPress()
    }
  }

  const onPointerCancel = () => { drag.current.active = false }

  if (!pos) return null

  return (
    <button
      type="button"
      aria-label="SOS"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE, touchAction: 'none' }}
      className="fixed z-50 flex select-none items-center justify-center rounded-full bg-danger text-[13px] font-extrabold tracking-wide text-white shadow-lg active:bg-danger-dark"
    >
      {label}
    </button>
  )
}