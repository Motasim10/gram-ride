'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminLocationsPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pickups, setPickups] = useState([])
  const [destinations, setDestinations] = useState([])
  const [newPickup, setNewPickup] = useState('')
  const [newDestination, setNewDestination] = useState('')
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      await loadLocations()
      setLoading(false)
    }
    load()
  }, [])

  const loadLocations = async () => {
    const { data } = await supabase.from('locations').select('*').order('name')
    setPickups((data || []).filter((l) => l.type === 'pickup'))
    setDestinations((data || []).filter((l) => l.type === 'destination'))
  }

  const addLocation = async (type) => {
    const name = type === 'pickup' ? newPickup.trim() : newDestination.trim()
    if (!name) return
    await supabase.from('locations').insert({ name, type })
    type === 'pickup' ? setNewPickup('') : setNewDestination('')
    await loadLocations()
  }

  const deleteLocation = async (id) => {
    await supabase.from('locations').delete().eq('id', id)
    await loadLocations()
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>
  if (!authorized) return null

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <Link href="/admin">← Back to Dashboard</Link>
      <h1>Pickup Points & Destinations</h1>
      <p style={{ fontSize: 13, color: '#888' }}>These appear as dropdown choices for passengers booking a shared ride.</p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h3>Pickup Points</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={newPickup} onChange={(e) => setNewPickup(e.target.value)} placeholder="New pickup point" style={{ flex: 1, padding: 8 }} />
            <button onClick={() => addLocation('pickup')} style={{ padding: '8px 12px' }}>Add</button>
          </div>
          {pickups.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #eee', borderRadius: 6, padding: 8, marginBottom: 6 }}>
              <span>{p.name}</span>
              <button onClick={() => deleteLocation(p.id)} style={{ color: '#c00' }}>Delete</button>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <h3>Destinations</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={newDestination} onChange={(e) => setNewDestination(e.target.value)} placeholder="New destination" style={{ flex: 1, padding: 8 }} />
            <button onClick={() => addLocation('destination')} style={{ padding: '8px 12px' }}>Add</button>
          </div>
          {destinations.map((d) => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #eee', borderRadius: 6, padding: 8, marginBottom: 6 }}>
              <span>{d.name}</span>
              <button onClick={() => deleteLocation(d.id)} style={{ color: '#c00' }}>Delete</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}