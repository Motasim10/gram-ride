'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useLanguage } from '@/lib/i18n'

const SHOW_ON = ['/dashboard', '/passenger', '/driver', '/history', '/wallet', '/profile', '/notifications', '/help', '/complaints']

export default function BottomNav() {
  const pathname = usePathname()
  const { t } = useLanguage()
  const [role, setRole] = useState(null)

  useEffect(() => {
    if (!SHOW_ON.includes(pathname)) { setRole(null); return }
    let active = true
    const loadRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
      if (active && data) setRole(data.role)
    }
    loadRole()
    return () => { active = false }
  }, [pathname])

  if (!SHOW_ON.includes(pathname) || !role) return null

  const tabs = role === 'driver'
    ? [
        { href: '/dashboard', icon: '🏠', label: t('navHome') },
        { href: '/driver', icon: '🚕', label: t('navDrive') },
        { href: '/wallet', icon: '💰', label: t('navWallet') },
        { href: '/help', icon: '💬', label: t('navHelp') },
        { href: '/profile', icon: '👤', label: t('profile') },
      ]
    : [
        { href: '/dashboard', icon: '🏠', label: t('navHome') },
        { href: '/passenger', icon: '🚗', label: t('navRide') },
        { href: '/history', icon: '🕘', label: t('navHistory') },
        { href: '/help', icon: '💬', label: t('navHelp') },
        { href: '/profile', icon: '👤', label: t('profile') },
      ]

  return (
    <>
      <div className="h-20" aria-hidden="true" />
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] border-t-2 border-line bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {tabs.map((tab) => {
            const active = pathname === tab.href
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[11.5px] font-bold ${active ? 'text-emerald' : 'text-charcoal/50'}`}
                >
                  <span className={`flex h-8 w-12 items-center justify-center rounded-full text-xl ${active ? 'bg-mint' : ''}`}>{tab.icon}</span>
                  {tab.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}