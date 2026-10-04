'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import NotificationBell from '@/lib/NotificationBell'
import Screen from '@/components/ui/Screen'
import SectionCard from '@/components/ui/SectionCard'

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      setProfile(data)
    }
    load()
  }, [])

  if (!profile) return <Screen><p className="mt-24 text-center text-charcoal/60">...</p></Screen>

  const isDriver = profile.role === 'driver'
  const tiles = [
    { href: '/history', icon: '🕘', label: t('tripHistory') },
    ...(isDriver ? [{ href: '/wallet', icon: '💰', label: t('walletStats') }] : []),
    { href: '/complaints', icon: '📝', label: t('complaints') },
    { href: '/help', icon: '💬', label: t('helpSupport') },
  ]

  return (
    <Screen>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-mint text-xl font-bold text-emerald">
            {(profile.name || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-[13px] text-charcoal/60">{t('welcome')}</p>
            <p className="text-lg font-bold leading-tight text-charcoal">{profile.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <Link href="/profile" className="text-2xl" aria-label={t('profile')}>👤</Link>
        </div>
      </div>

      <span className="mt-3 inline-block rounded-full bg-mint px-3 py-1 text-[12px] font-bold text-emerald">
        {t(profile.role)}
      </span>

      <Link
        href={isDriver ? '/driver' : '/passenger'}
        className="rise-in mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald py-5 text-[17px] font-bold text-white active:bg-emerald-dark"
      >
        🚗 {isDriver ? t('viewRequests') : t('requestRide')}
      </Link>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href}>
            <SectionCard className="flex h-28 flex-col items-center justify-center gap-2 text-center active:bg-mint">
              <span className="text-3xl">{tile.icon}</span>
              <span className="text-[14px] font-bold text-charcoal">{tile.label}</span>
            </SectionCard>
          </Link>
        ))}
      </div>
    </Screen>
  )
}