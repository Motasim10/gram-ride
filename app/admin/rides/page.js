'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Tabs, StatusBadge, EmptyState } from '@/components/admin/AdminUI'
import { IconCar, IconMapPin } from '@/components/admin/Icons'

export default function AdminRidesPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rides, setRides] = useState([])
  const [profileMap, setProfileMap] = useState({})
  const [routeMap, setRouteMap] = useState({})
  const router = useRouter()
  const channelRef = useRef(null)
  const [tab, setTab] = useState('all')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      const { data: allProfiles } = await supabase.from('profiles').select('user_id, name')
      const map = {}
      ;(allProfiles || []).forEach((p) => { map[p.user_id] = p.name })
      setProfileMap(map)

      const { data: routeRows } = await supabase.from('routes').select('id, name')
      const rMap = {}
      ;(routeRows || []).forEach((rt) => { rMap[rt.id] = rt.name })
      setRouteMap(rMap)

      await loadRides()
      subscribe()
      setLoading(false)
    }
    load()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  const loadRides = async () => {
    const { data } = await supabase
      .from('rides')
      .select('*')
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
    setRides(data || [])
  }

  const forceCancel = async (ride) => {
    if (!window.confirm(`Force-cancel this ride (${ride.pickup} → ${ride.destination})?`)) return
    const { data, error } = await supabase.from('rides').update({ status: 'cancelled' }).eq('id', ride.id).select()
    if (error) { alert('Cancel failed: ' + error.message) }
    else if (!data || data.length === 0) { alert('Cancel did not go through: 0 rows were updated.') }
    await loadRides()
  }

  const subscribe = () => {
    const channel = supabase
      .channel('admin-rides-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => {
        loadRides()
      })
      .subscribe()
    channelRef.current = channel
  }

  const nameFor = (id) => (id ? profileMap[id] || id : '—')

  const statusLabel = { searching: 'Searching', negotiating: 'Negotiating', accepted: 'Accepted' }
  const statusTone = { searching: 'amber', negotiating: 'amber', accepted: 'emerald' }
  const countOf = (s) => rides.filter((r) => r.status === s).length
  const filtered = tab === 'all' ? rides : rides.filter((r) => r.status === tab)

  if (loading) return <p className="mt-16 text-center text-charcoal/60">Loading...</p>
  if (!authorized) return null

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-charcoal/55">Updates automatically as rides change status.</p>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: 'All', count: rides.length },
          { value: 'searching', label: 'Searching', count: countOf('searching') },
          { value: 'negotiating', label: 'Negotiating', count: countOf('negotiating') },
          { value: 'accepted', label: 'Accepted', count: countOf('accepted') },
        ]}
      />

      {filtered.length === 0 && <EmptyState icon={<IconCar size={28} />} text="No active rides right now." />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((r) => (
          <div key={r.id} className="rounded-2xl border-2 border-line-soft bg-white p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="font-num text-[12.5px] font-bold text-charcoal/45">#{r.id}</p>
              <div className="flex items-center gap-1.5">
                {r.ride_type === 'reserve' && <StatusBadge tone="amber">Reserve</StatusBadge>}
                <StatusBadge tone={statusTone[r.status] || 'gray'}>
                  {r.status === 'searching' || r.status === 'negotiating' ? (
                    <span className="flex items-center gap-1">
                      <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-dark" />
                      {statusLabel[r.status]}
                    </span>
                  ) : (statusLabel[r.status] || r.status)}
                </StatusBadge>
              </div>
            </div>

            <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[14px] font-bold text-charcoal">
              <IconMapPin size={13} className="shrink-0 text-emerald" />
              {r.pickup} <span className="text-charcoal/30">→</span> {r.destination}
            </p>
            <p className="mb-1 text-[12.5px] font-semibold text-charcoal/55">
              Passenger: {nameFor(r.passenger_id)} · Driver: {nameFor(r.driver_id)}
            </p>
            {r.ride_type === 'shared' && (
              <p className="mb-1 text-[12.5px] font-semibold text-charcoal/55">
                Route: {routeMap[r.route_id] || '—'}{r.trip_id ? ` · Trip #${r.trip_id}` : ' · not yet on a trip'}
              </p>
            )}

            <div className="mb-3 mt-2 flex flex-wrap gap-1.5">
              <StatusBadge>{r.vehicle_type === 'auto' ? 'Auto' : 'CNG'}</StatusBadge>
              <StatusBadge>{r.seats} {r.seats === 1 ? 'seat' : 'seats'}</StatusBadge>
              {r.women_seats > 0 && <StatusBadge tone="amber">{r.women_seats} women</StatusBadge>}
              {r.pickup_time && (
                <StatusBadge tone="amber">
                  Pickup {new Date(r.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </StatusBadge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="font-num text-[16px] font-extrabold text-emerald-dark">{r.fare ? `৳${r.fare}` : '—'}</p>
              <button
                onClick={() => forceCancel(r)}
                className="rounded-lg border-2 border-danger/40 px-3 py-1.5 text-[12.5px] font-bold text-danger hover:bg-danger/5"
              >
                Force cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}