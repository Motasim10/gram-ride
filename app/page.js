'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useLanguage } from '@/lib/i18n'
import Screen from '@/components/ui/Screen'
import PrimaryButton from '@/components/ui/PrimaryButton'
import { IconAutoRickshaw } from '@/components/ui/Icons'

export default function Home() {
  const router = useRouter()
  const { t } = useLanguage()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.replace('/dashboard')
      else setChecking(false)
    }
    check()
  }, [])

  if (checking) return <Screen />

  return (
    <Screen className="flex flex-col justify-center text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald text-white">
        <IconAutoRickshaw size={42} />
      </div>
      <h1 className="text-3xl font-bold text-charcoal">Gram Ride</h1>
      <p className="mb-10 mt-2 text-charcoal/60">{t('tagline')}</p>
      <div className="space-y-3">
        <PrimaryButton onClick={() => router.push('/login')}>{t('login')}</PrimaryButton>
        <PrimaryButton tone="outline" onClick={() => router.push('/signup')}>{t('createAccountButton')}</PrimaryButton>
      </div>
    </Screen>
  )
}