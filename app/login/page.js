'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'
import { phoneToEmail, normalizePin } from '@/lib/phoneAuth'
import Screen from '@/components/ui/Screen'
import PrimaryButton from '@/components/ui/PrimaryButton'
import { IconPhoneCall } from '@/components/ui/Icons'
import { HOTLINE_NUMBER } from '@/lib/config'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { t } = useLanguage()

  const isEmail = identifier.includes('@')

  const attemptLogin = async (idValue, passwordValue) => {
    setError('')
    const usingEmail = idValue.includes('@')
    const email = usingEmail ? idValue.trim() : phoneToEmail(idValue)
    if (!email) { setError(t('invalidPhone')); return }
    const password = usingEmail ? passwordValue : normalizePin(passwordValue)
    setLoading(true)
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (loginError) {
      setError(t('wrongPhoneOrPin'))
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    await attemptLogin(identifier, formData.get('password'))
  }

  return (
    <Screen className="flex flex-col justify-center">
      <h1 className="mb-6 text-center text-2xl font-bold text-charcoal">{t('login')}</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{t('phoneNumber')}</span>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            inputMode={isEmail ? 'email' : 'tel'}
            placeholder="01XXXXXXXXX"
            required
            className="tap-target w-full rounded-xl border-2 border-line bg-white px-3 font-num text-[16px] font-semibold text-charcoal focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{isEmail ? t('password') : t('pinLabel')}</span>
          <input
            name="password"
            type="password"
            inputMode={isEmail ? 'text' : 'numeric'}
            required
            className="tap-target w-full rounded-xl border-2 border-line bg-white px-3 font-num text-[16px] font-semibold text-charcoal focus:border-emerald focus:outline-none"
          />
        </label>
        {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">{error}</p>}
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? t('loggingIn') : t('logInButton')}
        </PrimaryButton>
      </form>
      <p className="mt-6 text-center text-[14px] text-charcoal/60">
        {t('noAccountYet')}{' '}
        <Link href="/signup" className="font-bold text-emerald">{t('createAccountButton')}</Link>
      </p>

      <a href="/forgot-pin" className="block pt-3 text-center text-sm font-semibold text-emerald-700 underline">
        {t('forgotPin')}
      </a>
    </Screen>
  )
}