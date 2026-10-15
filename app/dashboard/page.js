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

const TEXT = {
  bn: {
    tagline: 'আপনার যাত্রা, GramJatra-এর সাথে',
    salam: 'আসসালামু আলাইকুম!',
    askPassenger: 'কোথায় যেতে চান?',
    askDriver: 'যাত্রী নিতে প্রস্তুত?',
  },
  en: {
    tagline: 'Your journey, with GramJatra',
    salam: 'Assalamu Alaikum!',
    askPassenger: 'Where would you like to go?',
    askDriver: 'Ready to pick up passengers?',
  },
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const router = useRouter()
  const { t, lang } = useLanguage()
  const T = lang === 'en' ? TEXT.en : TEXT.bn

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
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald text-white">
            <IconCar size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[17px] font-extrabold leading-tight text-charcoal">{lang === 'bn' ? 'গ্রামযাত্রা' : 'GramJatra'}</p>
            <p className="text-[11px] font-semibold leading-tight text-charcoal/55">{T.tagline}</p>
          </div>
        </div>
        <HeaderActions profile />
      </div>

      <div
        className="relative mt-4 overflow-hidden rounded-3xl px-5 pb-16 pt-5"
        style={{ background: 'linear-gradient(135deg, #CDEFDB 0%, #DDF5E6 60%, #EBFAF1 100%)' }}
      >
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/70" />
        <div className="pointer-events-none absolute -bottom-16 right-8 h-32 w-32 rounded-full bg-white/70" />
        <h2 className="relative text-[21px] font-bold leading-snug text-emerald-deep">
          {T.salam}
          <br />
          {isDriver ? T.askDriver : T.askPassenger}
        </h2>
      </div>

      <div className="relative mx-2 -mt-7 rounded-2xl border border-line-soft bg-white p-4 shadow-md">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mint text-xl font-bold text-emerald">
            {(profile.name || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-charcoal/60">{t('welcome')}</p>
            <p className="line-clamp-2 break-words text-lg font-bold leading-tight text-charcoal">{profile.name}</p>
          </div>
          <span className="shrink-0 rounded-full bg-mint px-3 py-1 text-[12px] font-bold text-emerald">
            {t(profile.role)}
          </span>
        </div>
      </div>

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