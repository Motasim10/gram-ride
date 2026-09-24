'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [stats, setStats] = useState({
    totalDrivers: 0,
    totalPassengers: 0,
    completedRides: 0,
    totalRevenue: 0,
    openDisputes: 0,
  })
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) {
        router.push('/dashboard')
        return
      }
      setAuthorized(true)

      const { count: driverCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'driver')
      const { count: passengerCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'passenger')
      const { data: completedRides } = await supabase.from('rides').select('fare').eq('status', 'completed')
      const { count: disputeCount } = await supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open')

      const totalRevenue = (completedRides || []).reduce((sum, r) => sum + (r.fare || 0), 0)

      setStats({
        totalDrivers: driverCount || 0,
        totalPassengers: passengerCount || 0,
        completedRides: (completedRides || []).length,
        totalRevenue,
        openDisputes: disputeCount || 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>
  if (!authorized) return null

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <h1>Admin Dashboard</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Drivers" value={stats.totalDrivers} />
        <StatCard label="Total Passengers" value={stats.totalPassengers} />
        <StatCard label="Completed Rides" value={stats.completedRides} />
        <StatCard label="Total Revenue" value={`৳${stats.totalRevenue}`} />
        <StatCard label="Open Disputes" value={stats.openDisputes} highlight={stats.openDisputes > 0} />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a href="/admin/drivers"><button style={{ padding: 10 }}>Manage Drivers</button></a>
        <a href="/admin/passengers"><button style={{ padding: 10 }}>Manage Passengers</button></a>
        <a href="/admin/rides"><button style={{ padding: 10 }}>Live Rides</button></a>
        <a href="/admin/disputes"><button style={{ padding: 10 }}>Disputes</button></a>
      </div>
    </div>
  )
}

function StatCard({ label, value, highlight }) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, minWidth: 140, background: highlight ? '#fff5f5' : '#fff' }}>
      <p style={{ fontSize: 13, color: '#888', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 'bold', margin: '4px 0' }}>{value}</p>
    </div>
  )
}