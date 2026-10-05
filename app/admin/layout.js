'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  IconGrid, IconCar, IconClock, IconMapPin, IconAutoRickshaw, IconUser,
  IconAlertTriangle, IconWallet, IconBarChart, IconShieldCheck, IconLogOut,
  IconMenu, IconX,
} from '@/components/admin/Icons'

const NAV = [
  { href: '/admin', label: 'Overview', Icon: IconGrid, exact: true },
  { href: '/admin/rides', label: 'Live rides', Icon: IconCar, badge: 'rides' },
  { href: '/admin/trips', label: 'Active trips', Icon: IconClock },
  { href: '/admin/routes', label: 'Routes & fares', Icon: IconMapPin },
  { href: '/admin/drivers', label: 'Drivers', Icon: IconAutoRickshaw },
  { href: '/admin/passengers', label: 'Passengers', Icon: IconUser },
  { href: '/admin/disputes', label: 'Disputes', Icon: IconAlertTriangle, badge: 'disputes' },
  { href: '/admin/payouts', label: 'Payouts', Icon: IconWallet },
  { href: '/admin/analytics', label: 'Analytics', Icon: IconBarChart },
  { href: '/admin/sos', label: 'SOS alerts', Icon: IconShieldCheck, badge: 'sos' },
]

function isActive(item, pathname) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href)
}

function SidebarContent({ pathname, counts, onNavigate, onLogout }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald">
          <IconAutoRickshaw size={20} className="text-white" />
        </div>
        <div>
          <p className="font-num text-[16px] font-extrabold leading-none">Gram Ride</p>
          <p className="mt-0.5 text-[11.5px] font-semibold text-white/50">Admin panel</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.map((item) => {
          const active = isActive(item, pathname)
          const badge = item.badge ? counts[item.badge] : 0
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-bold transition-colors ${active ? 'bg-white text-emerald-dark' : 'text-white/70 hover:bg-white/10'}`}
            >
              <item.Icon size={18} className={active ? 'text-emerald' : 'text-white/60'} />
              <span className="flex-1 text-left">{item.label}</span>
              {badge > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 font-num text-[11px] font-extrabold ${active ? 'bg-amber/20 text-amber-dark' : 'bg-amber text-charcoal'}`}>
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-bold text-white/60 hover:bg-white/10"
        >
          <IconLogOut size={18} />
          Log out
        </button>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [admin, setAdmin] = useState(null)
  const [counts, setCounts] = useState({ rides: 0, disputes: 0, sos: 0 })
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('name, is_admin').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAdmin(profile)
    }
    check()
  }, [])

  useEffect(() => {
    if (!admin) return
    const loadCounts = async () => {
      const { count: rides } = await supabase.from('rides').select('*', { count: 'exact', head: true }).not('status', 'in', '(completed,cancelled)')
      const { count: disputes } = await supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open')
      const { count: sos } = await supabase.from('sos_alerts').select('*', { count: 'exact', head: true }).eq('status', 'open')
      setCounts({ rides: rides || 0, disputes: disputes || 0, sos: sos || 0 })
    }
    loadCounts()
    setMenuOpen(false)
  }, [admin, pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!admin) return <p className="mt-24 text-center text-charcoal/60">Loading...</p>

  const current = NAV.find((item) => isActive(item, pathname))

  return (
    <div className="flex min-h-screen bg-offwhite">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 lg:block">
        <SidebarContent pathname={pathname} counts={counts} onLogout={handleLogout} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-charcoal/45" onClick={() => setMenuOpen(false)} />
          <div className="relative h-full w-64">
            <SidebarContent pathname={pathname} counts={counts} onNavigate={() => setMenuOpen(false)} onLogout={handleLogout} />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-line-soft bg-offwhite/95 px-4 py-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-line-soft bg-white text-charcoal/60 lg:hidden"
            >
              <IconMenu size={18} />
            </button>
            <p className="text-[19px] font-bold text-charcoal">{current ? current.label : 'Admin'}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-emerald bg-mint">
              <IconUser size={16} className="text-emerald" />
            </div>
            <div className="hidden sm:block">
              <p className="text-[13px] font-bold leading-none text-charcoal">{admin.name}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-charcoal/45">Admin</p>
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-7">{children}</main>
      </div>
    </div>
  )
}