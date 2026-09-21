'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

const typeLabel = (t) => (t === 'reserve' ? 'রিজার্ভ (পুরো গাড়ি)' : 'শেয়ার্ড')
const vehicleLabel = (v) => (v === 'auto' ? 'অটো' : 'সিএনজি')

export default function HistoryPage() {
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('rides')
        .select('*')
        .or(`passenger_id.eq.${user.id},driver_id.eq.${user.id}`)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })

      setTrips(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const totalFare = trips.reduce((sum, t) => sum + (t.fare || 0), 0)

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Trip History</h1>
      <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <div><b>Total Trips</b><br/>{trips.length}</div>
        <div><b>Total Fare</b><br/>৳{totalFare}</div>
      </div>

      {trips.length === 0 && <p style={{ color: '#888' }}>No completed trips yet.</p>}

      {trips.map((t) => (
        <div key={t.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <p style={{ marginBottom: 4 }}><b>{t.pickup} → {t.destination}</b></p>
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
            {typeLabel(t.ride_type)} · {vehicleLabel(t.vehicle_type)} · {new Date(t.created_at).toLocaleDateString()}
          </p>
          <p style={{ marginTop: 6, fontWeight: 'bold' }}>৳{t.fare}</p>
        </div>
      ))}
    </div>
  )
}