'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'
import { normalizePhone, phoneToEmail, normalizePin } from '@/lib/phoneAuth'
import Screen from '@/components/ui/Screen'
import PrimaryButton from '@/components/ui/PrimaryButton'

const inputClass =
  'tap-target w-full rounded-xl border-2 border-line bg-white px-3 text-[16px] font-semibold text-charcoal focus:border-emerald focus:outline-none'

export default function SignUp() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [area, setArea] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [role, setRole] = useState('passenger')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { t } = useLanguage()

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')

    const phoneNorm = normalizePhone(phone)
    if (!phoneNorm) { setError(t('invalidPhone')); return }
    const pinNorm = normalizePin(pin)
    if (!/^\d{6}$/.test(pinNorm)) { setError(t('invalidPin')); return }
    if (pinNorm !== normalizePin(pin2)) { setError(t('pinMismatch')); return }

    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: phoneToEmail(phoneNorm),
      password: pinNorm,
    })

    if (signUpError) {
      setError(/already/i.test(signUpError.message) ? t('phoneAlreadyRegistered') : signUpError.message)
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      user_id: data.user.id,
      name,
      phone: phoneNorm,
      area,
      role,
    })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    router.push('/dashboard')
  }

  return (
    <Screen>
      <h1 className="mb-6 text-center text-2xl font-bold text-charcoal">{t('createAccountTitle')}</h1>
      <form onSubmit={handleSignUp} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{t('name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{t('phoneNumber')}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" required className={`${inputClass} font-num`} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{t('areaLabel')}</span>
          <input value={area} onChange={(e) => setArea(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{t('pinLabel')}</span>
          <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)} required className={`${inputClass} font-num`} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{t('pinConfirm')}</span>
          <input type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value)} required className={`${inputClass} font-num`} />
        </label>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{t('iAmA')}</span>
          <div className="grid grid-cols-2 gap-3">
            {['passenger', 'driver'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`tap-target rounded-xl border-2 font-bold ${role === r ? 'border-emerald bg-mint text-emerald' : 'border-line bg-white text-charcoal/60'}`}
              >
                {t(r)}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">{error}</p>}
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? t('creatingAccount') : t('createAccountButton')}
        </PrimaryButton>
      </form>
      <p className="mt-6 text-center text-[14px] text-charcoal/60">
        {t('haveAccount')}{' '}
        <Link href="/login" className="font-bold text-emerald">{t('login')}</Link>
      </p>
    </Screen>
  )
}