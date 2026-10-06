'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ResetPinButton({ userId, name }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const reset = async () => {
    const ok = window.confirm(
      `Reset the PIN for ${name}?\n\nOnly do this after you have called their registered number and are sure it is really them. Their old PIN will stop working immediately.`
    )
    if (!ok) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/reset-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Could not reset the PIN.')
      else setResult(json)
    } catch {
      setError('Could not reach the server.')
    }
    setBusy(false)
  }

  const close = () => { setResult(null); setError('') }

  return (
    <>
      <button
        onClick={reset}
        disabled={busy}
        className="text-[12.5px] font-bold text-charcoal/60 hover:text-charcoal disabled:opacity-40"
      >
        {busy ? 'Resetting...' : 'Reset PIN'}
      </button>

      {(result || error) && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-charcoal/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            {error ? (
              <>
                <p className="font-bold text-danger">{error}</p>
                <button onClick={close} className="mt-5 w-full rounded-xl bg-charcoal py-3 text-[14px] font-bold text-white">
                  Close
                </button>
              </>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-charcoal/60">New temporary PIN for</p>
                <p className="text-[17px] font-bold text-charcoal">{result.name}</p>
                <p className="my-4 font-num text-[40px] font-extrabold tracking-[0.2em] text-emerald-dark">{result.pin}</p>
                <p className="text-[13px] text-charcoal/70">
                  Call them on <span className="font-num font-bold">{result.phone}</span> and tell them this PIN.
                  It is shown only now and is not stored anywhere you can read it again.
                </p>
                <button onClick={close} className="mt-5 w-full rounded-xl bg-emerald py-3 text-[14px] font-bold text-white">
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}