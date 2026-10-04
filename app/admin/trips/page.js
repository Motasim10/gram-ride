'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { StatusBadge, EmptyState } from '@/components/admin/AdminUI'
import { IconClock, IconMapPin } from '@/components/admin/Icons'
import { notify } from '@/lib/notify'

export default function AdminTripsPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [trips, setTrips] = useState([])
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      await loadTrips()
      subscribeToTrips()
      setLoading(false)
    }
    load()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  const channelRef = useRef(null)

  const loadTrips = async () => {
    const { data: tripRows } = await supabase.from('trips').select('*')
      .in('status', ['open', 'in_progress']).order('created_at', { ascending: true })

    const { data: routeRows } = await supabase.from('routes').select('*')
    const { data: profileRows } = await supabase.from('profiles').select('user_id, name, phone')

    const routeMap = {}
    ;(routeRows || []).forEach((r) => { routeMap[r.id] = r.name })
    const driverMap = {}
    ;(profileRows || []).forEach((p) => { driverMap[p.user_id] = p })

    setTrips((tripRows || []).map((t) => ({
      ...t,
      routeName: routeMap[t.route_id] || `Route #${t.route_id}`,
      driver: driverMap[t.driver_id] || {},
    })))
  }

    const subscribeToTrips = () => {
    const channel = supabase
      .channel('admin-trips-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        loadTrips()
      })
      .subscribe()
    channelRef.current = channel
  }

  const forceOffline = async (trip) => {
    if (!window.confirm(`Force "${trip.driver.name || trip.driver_id}" offline from ${trip.routeName}?`)) return
    const { data: released } = await supabase.from('rides')
      .update({ status: 'searching', driver_id: null, trip_id: null, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
      .eq('trip_id', trip.id).eq('status', 'accepted').select()
    for (const r of released || []) await notify(r.passenger_id, 'tripCancelledByDriver', {})
    await supabase.from('trips').update({ status: 'cancelled' }).eq('id', trip.id).select()
    await loadTrips()
  }

  if (loading) return <p className="mt-16 text-center text-charcoal/60">Loading...</p>
  if (!authorized) return null

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-[13px] text-charcoal/55">
        Every driver currently online or mid-trip. If a driver&apos;s phone lost connection or their browser closed
        without going offline properly, their trip can get stuck here. Use Force offline to clear it and let
        the next driver in that route&apos;s queue take over.
      </p>

      {trips.length === 0 && <EmptyState icon={<IconClock size={28} />} text="No drivers online right now." />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {trips.map((t) => (
          <div key={t.id} className="rounded-2xl border-2 border-line-soft bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint text-[15px] font-bold text-emerald">
                  {(t.driver.name || '?').trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-bold text-charcoal">{t.driver.name || t.driver_id}</p>
                  {t.driver.phone && (
                    <a href={`tel:${t.driver.phone}`} className="font-num text-[12.5px] font-semibold text-charcoal/55">{t.driver.phone}</a>
                  )}
                </div>
              </div>
              <StatusBadge tone={t.status === 'open' ? 'emerald' : 'amber'}>
                {t.status === 'open' ? 'Online' : 'On trip'}
              </StatusBadge>
            </div>

            <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[14px] font-bold text-charcoal">
              <IconMapPin size={13} className="shrink-0 text-emerald" />{t.routeName}
            </p>
            <div className="mb-3 mt-2 flex flex-wrap gap-1.5">
              <StatusBadge>{t.vehicle_type === 'auto' ? 'Auto' : 'CNG'}</StatusBadge>
              <StatusBadge>Online since {new Date(t.created_at).toLocaleString()}</StatusBadge>
            </div>

            <button
              onClick={() => forceOffline(t)}
              className="rounded-lg border-2 border-danger/40 px-3 py-1.5 text-[12.5px] font-bold text-danger hover:bg-danger/5"
            >
              Force offline
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}