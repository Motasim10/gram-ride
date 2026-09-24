'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminDriversPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState([])
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      await loadDrivers()
      setLoading(false)
    }
    load()
  }, [])

  const loadDrivers = async () => {
    const { data: driverProfiles } = await supabase.from('profiles').select('*').eq('role', 'driver').order('created_at', { ascending: false })

    const withStats = await Promise.all((driverProfiles || []).map(async (d) => {
      const { data: rides } = await supabase.from('rides').select('fare').eq('driver_id', d.user_id).eq('status', 'completed')
      const { data: ratings } = await supabase.from('ratings').select('stars').eq('driver_id', d.user_id)
      const totalEarnings = (rides || []).reduce((sum, r) => sum + (r.fare || 0), 0)
      const avgRating = ratings && ratings.length > 0 ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1) : null
      return { ...d, tripCount: (rides || []).length, totalEarnings, avgRating }
    }))

    setDrivers(withStats)
  }

  const toggleFlag = async (driver) => {
    await supabase.from('profiles').update({ flagged: !driver.flagged }).eq('user_id', driver.user_id)
    setDrivers((prev) => prev.map((d) => (d.user_id === driver.user_id ? { ...d, flagged: !d.flagged } : d)))
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>
  if (!authorized) return null

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <Link href="/admin">← Back to Dashboard</Link>
      <h1>Drivers ({drivers.length})</h1>
      {drivers.length === 0 && <p style={{ color: '#888' }}>No drivers registered yet.</p>}
      {drivers.map((d) => (
        <div key={d.user_id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 10, background: d.flagged ? '#fff5f5' : '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{d.name} {d.flagged && '🚩'}</p>
              <p style={{ margin: '2px 0', fontSize: 13, color: '#888' }}>{d.phone}</p>
              <p style={{ margin: '2px 0', fontSize: 13 }}>
                Trips: {d.tripCount} · Earnings: ৳{d.totalEarnings} · Rating: {d.avgRating ? `★ ${d.avgRating}` : 'N/A'}
              </p>
            </div>
            <button onClick={() => toggleFlag(d)} style={{ padding: '6px 12px', alignSelf: 'center' }}>
              {d.flagged ? 'Unflag' : 'Flag'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}