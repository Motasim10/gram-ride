'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminPassengersPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [passengers, setPassengers] = useState([])
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      await loadPassengers()
      setLoading(false)
    }
    load()
  }, [])

  const loadPassengers = async () => {
    const { data: passengerProfiles } = await supabase.from('profiles').select('*').eq('role', 'passenger').order('created_at', { ascending: false })

    const withStats = await Promise.all((passengerProfiles || []).map(async (p) => {
      const { data: rides } = await supabase.from('rides').select('fare').eq('passenger_id', p.user_id).eq('status', 'completed')
      const totalSpent = (rides || []).reduce((sum, r) => sum + (r.fare || 0), 0)
      return { ...p, tripCount: (rides || []).length, totalSpent }
    }))

    setPassengers(withStats)
  }

  const toggleFlag = async (passenger) => {
    await supabase.from('profiles').update({ flagged: !passenger.flagged }).eq('user_id', passenger.user_id)
    setPassengers((prev) => prev.map((p) => (p.user_id === passenger.user_id ? { ...p, flagged: !p.flagged } : p)))
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>
  if (!authorized) return null

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <Link href="/admin">← Back to Dashboard</Link>
      <h1>Passengers ({passengers.length})</h1>
      {passengers.length === 0 && <p style={{ color: '#888' }}>No passengers registered yet.</p>}
      {passengers.map((p) => (
        <div key={p.user_id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 10, background: p.flagged ? '#fff5f5' : '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{p.name} {p.flagged && '🚩'}</p>
              <p style={{ margin: '2px 0', fontSize: 13, color: '#888' }}>{p.phone}</p>
              <p style={{ margin: '2px 0', fontSize: 13 }}>
                Trips: {p.tripCount} · Total Spent: ৳{p.totalSpent}
              </p>
            </div>
            <button onClick={() => toggleFlag(p)} style={{ padding: '6px 12px', alignSelf: 'center' }}>
              {p.flagged ? 'Unflag' : 'Flag'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}