'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { KpiCard, Panel, StatusBadge, EmptyState } from '@/components/admin/AdminUI'
import {
  IconAutoRickshaw, IconUser, IconCar, IconWallet, IconAlertTriangle, IconShieldCheck,
  IconClock, IconChevronRight,
} from '@/components/admin/Icons'

const STATUS_TONE = { searching: 'gray', negotiating: 'amber', accepted: 'emerald', completed: 'emerald', cancelled: 'red' }

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [stats, setStats] = useState({
    totalDrivers: 0,
    totalPassengers: 0,
    completedRides: 0,
    totalRevenue: 0,
    openDisputes: 0,
  })
  const [attention, setAttention] = useState({ liveRides: 0, sos: 0 })
  const [recent, setRecent] = useState([])
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) {
        router.push('/dashboard')
        return
      }
      setAuthorized(true)

      const { count: driverCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'driver')
      const { count: passengerCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'passenger')
      const { data: completedRides } = await supabase.from('rides').select('fare').eq('status', 'completed')
      const { count: disputeCount } = await supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open')

      const totalRevenue = (completedRides || []).reduce((sum, r) => sum + (r.fare || 0), 0)

      setStats({
        totalDrivers: driverCount || 0,
        totalPassengers: passengerCount || 0,
        completedRides: (completedRides || []).length,
        totalRevenue,
        openDisputes: disputeCount || 0,
      })

      const { count: liveCount } = await supabase.from('rides').select('*', { count: 'exact', head: true }).not('status', 'in', '(completed,cancelled)')
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count: sosCount } = await supabase.from('sos_alerts').select('*', { count: 'exact', head: true }).gte('created_at', dayAgo)
      setAttention({ liveRides: liveCount || 0, sos: sosCount || 0 })

      const { data: recentRides } = await supabase
        .from('rides')
        .select('id, pickup, destination, status, ride_type, fare, created_at')
        .order('created_at', { ascending: false })
        .limit(6)
      setRecent(recentRides || [])

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p className="mt-16 text-center text-charcoal/60">Loading...</p>
  if (!authorized) return null

  const attentionRows = [
    { href: '/admin/disputes', label: 'Open disputes', value: stats.openDisputes, hot: stats.openDisputes > 0, Icon: IconAlertTriangle },
    { href: '/admin/sos', label: 'SOS alerts (last 24h)', value: attention.sos, hot: attention.sos > 0, danger: true, Icon: IconShieldCheck },
    { href: '/admin/rides', label: 'Rides in progress', value: attention.liveRides, hot: false, Icon: IconCar },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard icon={<IconAutoRickshaw size={16} />} label="Drivers" value={stats.totalDrivers} />
        <KpiCard icon={<IconUser size={16} />} label="Passengers" value={stats.totalPassengers} />
        <KpiCard icon={<IconCar size={16} />} label="Completed rides" value={stats.completedRides} tone="emerald" />
        <KpiCard icon={<IconWallet size={16} />} label="Total revenue" value={`৳${stats.totalRevenue}`} tone="emerald" />
        <KpiCard
          icon={<IconAlertTriangle size={16} />}
          label="Open disputes"
          value={stats.openDisputes}
          tone={stats.openDisputes > 0 ? 'amber' : 'charcoal'}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Needs attention">
          <div className="space-y-2.5">
            {attentionRows.map((row) => (
              <Link
                key={row.href}
                href={row.href}
                className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 ${row.hot ? (row.danger ? 'border-danger/40 bg-danger/5' : 'border-amber/50 bg-amber/10') : 'border-line-soft bg-offwhite'}`}
              >
                <row.Icon size={18} className={row.hot ? (row.danger ? 'text-danger' : 'text-amber-dark') : 'text-charcoal/50'} />
                <span className="flex-1 text-[13.5px] font-bold text-charcoal">{row.label}</span>
                <span className="font-num text-[18px] font-extrabold text-charcoal">{row.value}</span>
                <IconChevronRight size={16} className="text-charcoal/35" />
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Recent rides" className="xl:col-span-2" flush>
          {recent.length === 0 ? (
            <EmptyState icon={<IconClock size={28} />} text="No rides yet." />
          ) : (
            <div className="divide-y-2 divide-line-soft">
              {recent.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-charcoal">{r.pickup} → {r.destination}</p>
                    <p className="mt-0.5 text-[12px] font-semibold text-charcoal/45">
                      {r.ride_type === 'reserve' ? 'Reserve' : 'Shared'} · {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                  {r.fare ? <span className="font-num text-[14px] font-extrabold text-charcoal">৳{r.fare}</span> : null}
                  <StatusBadge tone={STATUS_TONE[r.status] || 'gray'}>{r.status}</StatusBadge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}