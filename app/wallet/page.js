'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function WalletPage() {
  const [loading, setLoading] = useState(true)
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [totalTrips, setTotalTrips] = useState(0)
  const [avgRating, setAvgRating] = useState(null)
  const [ratingCount, setRatingCount] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: trips } = await supabase
        .from('rides')
        .select('fare')
        .eq('driver_id', user.id)
        .eq('status', 'completed')

      const total = (trips || []).reduce((sum, t) => sum + (t.fare || 0), 0)
      setTotalEarnings(total)
      setTotalTrips((trips || []).length)

      const { data: ratings } = await supabase
        .from('ratings')
        .select('stars')
        .eq('driver_id', user.id)

      if (ratings && ratings.length > 0) {
        const avg = ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length
        setAvgRating(avg.toFixed(1))
        setRatingCount(ratings.length)
      }

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Wallet & Stats</h1>

      <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Total Earnings</p>
        <p style={{ fontSize: 28, fontWeight: 'bold', margin: '4px 0' }}>৳{totalEarnings}</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Total Trips</p>
          <p style={{ fontSize: 20, fontWeight: 'bold', margin: '4px 0' }}>{totalTrips}</p>
        </div>
        <div style={{ flex: 1, border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Rating</p>
          <p style={{ fontSize: 20, fontWeight: 'bold', margin: '4px 0' }}>
            {avgRating ? `★ ${avgRating}` : 'No ratings yet'}
          </p>
          {avgRating && <p style={{ fontSize: 11, color: '#888', margin: 0 }}>({ratingCount} rating{ratingCount !== 1 ? 's' : ''})</p>}
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#888', textAlign: 'center', marginTop: 24 }}>
        Cash payouts and subscription billing aren't set up yet — this screen shows your real trip and rating stats today.
      </p>
    </div>
  )
}