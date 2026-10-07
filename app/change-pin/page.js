'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useLanguage } from '@/lib/i18n'
import { normalizePin } from '@/lib/phoneAuth'
import Screen from '@/components/ui/Screen'
import PrimaryButton from '@/components/ui/PrimaryButton'

const inputClass =
  'tap-target w-full rounded-xl border-2 border-line bg-white px-3 font-num text-[16px] font-semibold text-charcoal focus:border-emerald focus:outline-none'

export default function ChangePinPage() {
  const [forced, setForced] = useState(false)
  const [email, setEmail] = useState('')
  const [ready, setReady] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPin2, setNewPin2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setEmail(user.email || '')
      const { data } = await supabase.from('profiles').select('must_change_pin').eq('user_id', user.id).single()
      setForced(!!data?.must_change_pin)
      setReady(true)
    }
    load()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const current = normalizePin(currentPin)
    const next = normalizePin(newPin)
    if (!/^\d{6}$/.test(next)) { setError(t('invalidPin')); return }
    if (next !== normalizePin(newPin2)) { setError(t('pinMismatch')); return }
    if (next === current) { setError(t('pinSameAsOld')); return }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/change-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ currentPin: current, newPin: next }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.code === 'wrong_current') setError(t('wrongCurrentPin'))
        else if (json.code === 'same') setError(t('pinSameAsOld'))
        else if (json.code === 'invalid') setError(t('invalidPin'))
        else setError(json.error || 'Something went wrong.')
        setLoading(false)
        return
      }
    } catch {
      setError('Could not reach the server.')
      setLoading(false)
      return
    }
    // The server may end the old session when the PIN changes, so sign in again with the new PIN.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: next })
    if (signInError) {
      router.replace('/login')
      return
    }
    setDone(true)
    setLoading(false)
    setTimeout(() => router.replace('/dashboard'), 1200)
  }

  if (!ready) return <Screen><p className="mt-24 text-center text-charcoal/60">{t('loading')}</p></Screen>

  return (
    <Screen>
      <h1 className="mb-5 text-[22px] font-bold text-charcoal">{t('changePinTitle')}</h1>

      {forced && (
        <div className="mb-4 rounded-2xl border-2 border-amber/60 bg-amber/10 p-4">
          <p className="text-[14px] font-bold text-amber-dark">{t('pinResetNotice')}</p>
        </div>
      )}

      {done ? (
        <div className="rounded-xl border-2 border-emerald/40 bg-mint px-4 py-3">
          <p className="font-bold text-emerald-dark">✅ {t('pinChanged')}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{t('currentPinLabel')}</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              required
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{t('newPinLabel')}</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              required
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{t('pinConfirm')}</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newPin2}
              onChange={(e) => setNewPin2(e.target.value)}
              required
              className={inputClass}
            />
          </label>
          {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">{error}</p>}
          <PrimaryButton type="submit" disabled={loading}>{t('changePinButton')}</PrimaryButton>
          {!forced && (
            <Link href="/profile" className="block text-center text-[14px] font-semibold text-charcoal/50">
              {t('cancel')}
            </Link>
          )}
        </form>
      )}
    </Screen>
  )
}