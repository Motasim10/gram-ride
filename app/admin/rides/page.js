'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const STATUS_COLORS = {
  searching: '#888',
  negotiating: '#c98a00',
  accepted: '#0066cc',
  completed: '#2e7d32',
}

export default function AdminRidesPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rides, setRides] = useState([])
  const [profileMap, setProfileMap] = useState({})
  const router = useRouter()
  const channelRef = useRef(null)

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
      .order('created_at', { ascending: false })
    setRides(data || [])
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

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>
  if (!authorized) return null

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <Link href="/admin">← Back to Dashboard</Link>
      <h1>Live Rides ({rides.length})</h1>
      <p style={{ color: '#888', fontSize: 13 }}>Updates automatically as rides change status.</p>
      {rides.length === 0 && <p style={{ color: '#888' }}>No active rides right now.</p>}
      {rides.map((r) => (
        <div key={r.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{r.pickup} → {r.destination}</p>
              <p style={{ margin: '2px 0', fontSize: 13, color: '#888' }}>
                Passenger: {nameFor(r.passenger_id)} · Driver: {nameFor(r.driver_id)}
              </p>
              <p style={{ margin: '2px 0', fontSize: 13 }}>
                {r.ride_type === 'reserve' ? 'Reserve' : 'Shared'} · {r.vehicle_type === 'auto' ? 'Auto' : 'CNG'} · Seats: {r.seats}
                {r.fare ? ` · ৳${r.fare}` : ''}
              </p>
            </div>
            <span style={{ alignSelf: 'center', fontWeight: 'bold', color: STATUS_COLORS[r.status] || '#333' }}>
              {r.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}