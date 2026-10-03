'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminFaresPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pickups, setPickups] = useState([])
  const [destinations, setDestinations] = useState([])
  const [fareMap, setFareMap] = useState({})
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      const { data: locs } = await supabase.from('locations').select('*').order('name')
      setPickups((locs || []).filter((l) => l.type === 'pickup'))
      setDestinations((locs || []).filter((l) => l.type === 'destination'))

      const { data: fares } = await supabase.from('fares').select('*')
      const map = {}
      ;(fares || []).forEach((f) => { map[`${f.pickup}|${f.destination}`] = f.fare_per_seat })
      setFareMap(map)

      setLoading(false)
    }
    load()
  }, [])

  const updateFare = async (pickup, destination, value) => {
    const fare = Number(value)
    setFareMap((prev) => ({ ...prev, [`${pickup}|${destination}`]: value }))
    if (!fare || fare <= 0) return

    const { data: existing } = await supabase.from('fares').select('id').eq('pickup', pickup).eq('destination', destination).maybeSingle()
    if (existing) {
      await supabase.from('fares').update({ fare_per_seat: fare }).eq('id', existing.id)
    } else {
      await supabase.from('fares').insert({ pickup, destination, fare_per_seat: fare })
    }
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>
  if (!authorized) return null

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <Link href="/admin">← Back to Dashboard</Link>
      <h1>Fare Table (per seat, ৳)</h1>
      <p style={{ fontSize: 13, color: '#888' }}>
        Shown to passengers as a suggested fare for shared rides. Drivers still send their own quote and can negotiate.
      </p>

      {(pickups.length === 0 || destinations.length === 0) ? (
        <p style={{ color: '#c00' }}>Add pickup points and destinations first, on the Locations page.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: 8 }}></th>
                {destinations.map((d) => (
                  <th key={d.id} style={{ border: '1px solid #ccc', padding: 8, fontSize: 13 }}>{d.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pickups.map((p) => (
                <tr key={p.id}>
                  <td style={{ border: '1px solid #ccc', padding: 8, fontWeight: 'bold', fontSize: 13 }}>{p.name}</td>
                  {destinations.map((d) => (
                    <td key={d.id} style={{ border: '1px solid #ccc', padding: 4 }}>
                      <input
                        type="number"
                        value={fareMap[`${p.name}|${d.name}`] ?? ''}
                        onChange={(e) => updateFare(p.name, d.name, e.target.value)}
                        style={{ width: 60, padding: 6, textAlign: 'center' }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}