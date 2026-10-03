'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
    await supabase.from('trips').update({ status: 'cancelled' }).eq('id', trip.id).select()
    await loadTrips()
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>
  if (!authorized) return null

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <Link href="/admin">← Back to Dashboard</Link>
      <h1>Active Trips ({trips.length})</h1>
      <p style={{ fontSize: 13, color: '#888' }}>
        Every driver currently online or mid-trip. If a driver's phone lost connection or their browser closed
        without going offline properly, their trip can get stuck here — use "Force Offline" to clear it and let
        the next driver in that route's queue take over.
      </p>

      {trips.length === 0 && <p style={{ color: '#888' }}>No drivers online right now.</p>}
      {trips.map((t) => (
        <div key={t.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{t.driver.name || t.driver_id}</p>
          <p style={{ margin: '2px 0', fontSize: 13, color: '#888' }}>{t.driver.phone || ''}</p>
          <p style={{ margin: '4px 0', fontSize: 13 }}>
            Route: {t.routeName} · Vehicle: {t.vehicle_type === 'auto' ? 'Auto' : 'CNG'} · Status: <b>{t.status}</b>
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888' }}>Online since {new Date(t.created_at).toLocaleString()}</p>
          <button onClick={() => forceOffline(t)} style={{ padding: '6px 12px', color: '#c00' }}>Force Offline</button>
        </div>
      ))}
    </div>
  )
}