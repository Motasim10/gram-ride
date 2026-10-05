'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { KpiCard, Panel, EmptyState } from '@/components/admin/AdminUI'
import { IconCar, IconWallet, IconTrendingUp, IconAutoRickshaw, IconMapPin } from '@/components/admin/Icons'

const dhakaDay = (value) => new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })

function lastNDays(n) {
  const days = []
  for (let i = n - 1; i >= 0; i--) days.push(dhakaDay(Date.now() - i * 24 * 60 * 60 * 1000))
  return days
}

function BarChart({ data, valueFmt }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex h-44 items-end gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <p className="font-num text-[11px] font-bold text-charcoal/50">{valueFmt ? valueFmt(d.value) : d.value}</p>
          <div className="relative flex w-full items-end rounded-md bg-mint" style={{ height: '110px' }}>
            <div className="w-full rounded-md bg-emerald" style={{ height: `${(d.value / max) * 100}%` }} />
          </div>
          <p className="text-[11.5px] font-bold text-charcoal/55">{d.label}</p>
        </div>
      ))}
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [week, setWeek] = useState([])
  const [topRoutes, setTopRoutes] = useState([])
  const [topDrivers, setTopDrivers] = useState([])
  const [typeSplit, setTypeSplit] = useState({ shared: 0, reserve: 0 })
  const [onlineToday, setOnlineToday] = useState(0)
  const [collectedWeek, setCollectedWeek] = useState(null)
  const channelRef = useRef(null)
  const timerRef = useRef(null)
  const router = useRouter()

  const loadData = async () => {
    const { data: rides } = await supabase.from('rides').select('*').eq('status', 'completed')
    const all = rides || []

    const days = lastNDays(7)
    const stamp = (r) => dhakaDay(r.completed_at || r.created_at)

    const { data: charges } = await supabase.from('driver_day_charges').select('day, driver_id, charge').gte('day', days[0])

    setWeek(days.map((day) => {
      const dayRides = all.filter((r) => stamp(r) === day)
      return {
        day,
        count: dayRides.length,
        fares: dayRides.reduce((s, r) => s + (r.fare || 0), 0),
        income: (charges || []).filter((c) => c.day === day).reduce((s, c) => s + (c.charge || 0), 0),
      }
    }))
    setOnlineToday((charges || []).filter((c) => c.day === days[days.length - 1]).length)

    const { data: payments, error: paymentsError } = await supabase
      .from('commission_payments').select('amount, created_at').gte('created_at', `${days[0]}T00:00:00+06:00`)
    setCollectedWeek(paymentsError ? null : (payments || []).reduce((s, p) => s + (p.amount || 0), 0))

    const routeCounts = {}
    all.forEach((r) => {
      const key = `${r.pickup} → ${r.destination}`
      routeCounts[key] = (routeCounts[key] || 0) + 1
    })
    setTopRoutes(Object.entries(routeCounts).sort((a, b) => b[1] - a[1]).slice(0, 4))

    setTypeSplit({
      shared: all.filter((r) => r.ride_type !== 'reserve').length,
      reserve: all.filter((r) => r.ride_type === 'reserve').length,
    })

    const byDriver = {}
    all.forEach((r) => {
      if (!r.driver_id) return
      const e = (byDriver[r.driver_id] = byDriver[r.driver_id] || { trips: 0, earnings: 0 })
      e.trips += 1
      e.earnings += r.fare || 0
    })
    const top = Object.entries(byDriver).sort((a, b) => b[1].earnings - a[1].earnings).slice(0, 5)
    const { data: people } = top.length
      ? await supabase.from('profiles').select('user_id, name').in('user_id', top.map(([id]) => id))
      : { data: [] }
    const nameMap = {}
    ;(people || []).forEach((p) => { nameMap[p.user_id] = p.name })
    setTopDrivers(top.map(([id, v]) => ({ id, name: nameMap[id] || 'Driver', ...v })))

    setLoading(false)
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      await loadData()

      channelRef.current = supabase
        .channel('admin-analytics-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' }, (payload) => {
          if (payload.new.status === 'completed') loadData()
        })
        .subscribe()
      timerRef.current = setInterval(loadData, 30000)
    }
    load()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  if (loading) return <p className="mt-16 text-center text-charcoal/60">Loading...</p>
  if (!authorized) return null

  const ridesWeek = week.reduce((s, d) => s + d.count, 0)
  const faresWeek = week.reduce((s, d) => s + d.fares, 0)
  const incomeWeek = week.reduce((s, d) => s + d.income, 0)
  const total = typeSplit.shared + typeSplit.reserve
  const sharedPct = total ? (typeSplit.shared / total) * 100 : 0
  const reservePct = total ? (typeSplit.reserve / total) * 100 : 0

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-[13px] text-charcoal/55">
        Days follow Bangladesh time and the page refreshes by itself. &quot;Fares paid&quot; is what passengers paid drivers.
        &quot;Platform income&quot; is what drivers were charged for each day (daily fees plus commission), whether or not they have paid yet.
        &quot;Collected&quot; is the cash you actually recorded on the Payouts page.
      </p>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <KpiCard icon={<IconCar size={16} />} label="Rides, last 7 days" value={ridesWeek} />
        <KpiCard icon={<IconWallet size={16} />} label="Fares paid, last 7 days" value={`৳${faresWeek}`} />
        <KpiCard
          icon={<IconTrendingUp size={16} />}
          label="Platform income, last 7 days"
          value={`৳${incomeWeek}`}
          tone="emerald"
          sub="Charged to drivers"
        />
        <KpiCard
          icon={<IconWallet size={16} />}
          label="Collected, last 7 days"
          value={collectedWeek === null ? '—' : `৳${collectedWeek}`}
          tone="emerald"
          sub="Payments recorded"
        />
        <KpiCard icon={<IconAutoRickshaw size={16} />} label="Drivers online today" value={onlineToday} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Completed rides, last 7 days">
          <BarChart data={week.map((d) => ({ label: d.day.slice(5), value: d.count }))} />
        </Panel>
        <Panel title="Fares paid (৳), last 7 days">
          <BarChart data={week.map((d) => ({ label: d.day.slice(5), value: d.fares }))} valueFmt={(v) => `৳${v}`} />
        </Panel>
        <Panel title="Platform income, charged (৳), last 7 days">
          <BarChart data={week.map((d) => ({ label: d.day.slice(5), value: d.income }))} valueFmt={(v) => `৳${v}`} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Ride type (all completed rides)">
          {total === 0 ? (
            <EmptyState icon={<IconCar size={28} />} text="No completed rides yet." />
          ) : (
            <div className="flex items-center gap-6">
              <svg viewBox="0 0 42 42" className="h-32 w-32 shrink-0">
                <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#E6F4EA" strokeWidth="6" />
                <circle
                  cx="21" cy="21" r="15.9" fill="transparent" stroke="#00875A" strokeWidth="6"
                  strokeDasharray={`${sharedPct} ${100 - sharedPct}`} strokeDashoffset="25"
                />
                <circle
                  cx="21" cy="21" r="15.9" fill="transparent" stroke="#F59E0B" strokeWidth="6"
                  strokeDasharray={`${reservePct} ${100 - reservePct}`} strokeDashoffset={`${25 - sharedPct}`}
                />
              </svg>
              <div className="space-y-2.5">
                <p className="flex items-center gap-2 text-[13.5px] font-semibold text-charcoal">
                  <span className="inline-block h-3 w-3 rounded-full bg-emerald" />
                  Shared: {typeSplit.shared} ({Math.round(sharedPct)}%)
                </p>
                <p className="flex items-center gap-2 text-[13.5px] font-semibold text-charcoal">
                  <span className="inline-block h-3 w-3 rounded-full bg-amber" />
                  Reserve: {typeSplit.reserve} ({Math.round(reservePct)}%)
                </p>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Top 5 drivers (by fares earned)">
          {topDrivers.length === 0 ? (
            <EmptyState icon={<IconAutoRickshaw size={28} />} text="No completed rides yet." />
          ) : (
            <div className="space-y-2.5">
              {topDrivers.map((d, i) => (
                <div key={d.id} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint font-num text-[12.5px] font-bold text-emerald-dark">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-[13.5px] font-bold text-charcoal">{d.name}</p>
                    <p className="text-[11.5px] font-semibold text-charcoal/45">{d.trips} {d.trips === 1 ? 'trip' : 'trips'}</p>
                  </div>
                  <p className="font-num text-[14px] font-extrabold text-emerald-dark">৳{d.earnings}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Busiest routes (all completed rides)">
        {topRoutes.length === 0 ? (
          <EmptyState icon={<IconMapPin size={28} />} text="No completed rides yet." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {topRoutes.map(([route, count]) => (
              <div key={route} className="rounded-xl bg-offwhite p-3.5">
                <p className="mb-1 text-[13px] font-bold text-charcoal">{route}</p>
                <p className="font-num text-[18px] font-extrabold text-emerald-dark">{count}</p>
                <p className="text-[11px] font-semibold text-charcoal/45">{count === 1 ? 'trip' : 'trips'}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}