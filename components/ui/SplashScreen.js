'use client'
import { useEffect, useState } from 'react'

// Full-screen green splash shown when the app opens (once per app session).
export default function SplashScreen() {
  const [show, setShow] = useState(true)
  const [fade, setFade] = useState(false)

  useEffect(() => {
    let seen = false
    try { seen = sessionStorage.getItem('gramjatra_splash') === '1' } catch (e) {}
    if (seen) { setShow(false); return }
    try { sessionStorage.setItem('gramjatra_splash', '1') } catch (e) {}
    const t1 = setTimeout(() => setFade(true), 1500)
    const t2 = setTimeout(() => setShow(false), 2000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (!show) return null

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        backgroundColor: '#026F4B',
        opacity: fade ? 0 : 1,
        transition: 'opacity 500ms ease',
        pointerEvents: fade ? 'none' : 'auto',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/splash-logo.jpg"
        alt=""
        style={{
          width: 'min(92vw, 520px)',
          height: 'auto',
          WebkitMaskImage: 'radial-gradient(ellipse farthest-corner, #000 80%, transparent 100%)',
          maskImage: 'radial-gradient(ellipse farthest-corner, #000 80%, transparent 100%)',
        }}
      />
    </div>
  )
}