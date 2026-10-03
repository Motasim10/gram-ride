'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function lastNDays(n) {
  const days = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

export default function AdminAnalyticsPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dailyRides, setDailyRides] = useState([])
  const [dailyRevenue, setDailyRevenue] = useState([])
  const [topRoutes, setTopRoutes] = useState([])
  const [typeSplit, setTypeSplit] = useState({ shared: 0, reserve: 0 })
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      const { data: rides } = await supabase.from('rides').select('*').eq('status', 'completed')
      const all = rides || []

      const days = lastNDays(7)
      const rideCounts = days.map((day) => ({
        day,
        count: all.filter((r) => r.created_at?.slice(0, 10) === day).length,
      }))
      const revenueByDay = days.map((day) => ({
        day,
        total: all.filter((r) => r.created_at?.slice(0, 10) === day).reduce((s, r) => s + (r.fare || 0), 0),
      }))
      setDailyRides(rideCounts)
      setDailyRevenue(revenueByDay)

      const routeCounts = {}
      all.forEach((r) => {
        const key = `${r.pickup} → ${r.destination}`
        routeCounts[key] = (routeCounts[key] || 0) + 1
      })
      const sortedRoutes = Object.entries(routeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
      setTopRoutes(sortedRoutes)

      const sharedCount = all.filter((r) => r.ride_type !== 'reserve').length
      const reserveCount = all.filter((r) => r.ride_type === 'reserve').length
      setTypeSplit({ shared: sharedCount, reserve: reserveCount })

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>
  if (!authorized) return null

  const maxRides = Math.max(1, ...dailyRides.map((d) => d.count))
  const maxRevenue = Math.max(1, ...dailyRevenue.map((d) => d.total))
  const totalTyped = typeSplit.shared + typeSplit.reserve || 1

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <Link href="/admin">← Back to Dashboard</Link>
      <h1>Analytics</h1>

      <h3>Completed Rides — Last 7 Days</h3>
      <div style={{ marginBottom: 24 }}>
        {dailyRides.map((d) => (
          <div key={d.day} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ width: 90, fontSize: 12, color: '#888' }}>{d.day.slice(5)}</span>
            <div style={{ flex: 1, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(d.count / maxRides) * 100}%`, background: '#0066cc', color: 'white', fontSize: 11, padding: '2px 6px', minWidth: d.count > 0 ? 18 : 0 }}>
                {d.count > 0 ? d.count : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h3>Revenue (৳) — Last 7 Days</h3>
      <div style={{ marginBottom: 24 }}>
        {dailyRevenue.map((d) => (
          <div key={d.day} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ width: 90, fontSize: 12, color: '#888' }}>{d.day.slice(5)}</span>
            <div style={{ flex: 1, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(d.total / maxRevenue) * 100}%`, background: '#2e7d32', color: 'white', fontSize: 11, padding: '2px 6px', minWidth: d.total > 0 ? 18 : 0 }}>
                {d.total > 0 ? `৳${d.total}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h3>Top Routes</h3>
      {topRoutes.length === 0 && <p style={{ color: '#888' }}>No completed rides yet.</p>}
      <ol style={{ paddingLeft: 20 }}>
        {topRoutes.map(([route, count]) => (
          <li key={route} style={{ marginBottom: 4 }}>{route} — {count} trip{count !== 1 ? 's' : ''}</li>
        ))}
      </ol>

      <h3>Ride Type Split</h3>
      <p>Shared: {typeSplit.shared} ({Math.round((typeSplit.shared / totalTyped) * 100)}%) · Reserve: {typeSplit.reserve} ({Math.round((typeSplit.reserve / totalTyped) * 100)}%)</p>
    </div>
  )
}