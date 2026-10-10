'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import HeaderActions from '@/components/ui/HeaderActions'
import Screen from '@/components/ui/Screen'
import SectionCard from '@/components/ui/SectionCard'
import { IconClock, IconWallet, IconMessageSquare, IconHelpCircle, IconCar, IconNavigation } from '@/components/ui/Icons'

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
    { href: '/history', Icon: IconClock, label: t('tripHistory') },
    ...(isDriver ? [{ href: '/wallet', Icon: IconWallet, label: t('walletStats') }] : []),
    { href: '/complaints', Icon: IconMessageSquare, label: t('complaints') },
    { href: '/help', Icon: IconHelpCircle, label: t('helpSupport') },
  ]

  return (
    <Screen>
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mint text-xl font-bold text-emerald">
            {(profile.name || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] text-charcoal/60">{t('welcome')}</p>
            <p className="truncate text-lg font-bold leading-tight text-charcoal">{profile.name}</p>
          </div>
        </div>
        <HeaderActions profile />
      </div>

      <span className="mt-3 inline-block rounded-full bg-mint px-3 py-1 text-[12px] font-bold text-emerald">
        {t(profile.role)}
      </span>

      <Link
        href={isDriver ? '/driver' : '/passenger'}
        className="rise-in mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald py-5 text-[17px] font-bold text-white active:bg-emerald-dark"
      >
        {isDriver ? <IconNavigation size={22} /> : <IconCar size={22} />}
        {isDriver ? t('viewRequests') : t('requestRide')}
      </Link>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href}>
            <SectionCard className="flex h-28 flex-col items-center justify-center gap-2 text-center active:bg-mint">
              <tile.Icon size={30} className="text-emerald" />
              <span className="text-[14px] font-bold text-charcoal">{tile.label}</span>
            </SectionCard>
          </Link>
        ))}
      </div>
    </Screen>
  )
}