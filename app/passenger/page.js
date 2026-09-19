'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function PassengerPage() {
  const [userId, setUserId] = useState(null)
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [seats, setSeats] = useState(1)
  const [activeRide, setActiveRide] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const channelRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
      await checkActiveRide(user.id)
      subscribeToChanges(user.id)
    }
    load()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  const checkActiveRide = async (uid) => {
    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq('passenger_id', uid)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setActiveRide(data)
  }

  const subscribeToChanges = (uid) => {
    const channel = supabase
      .channel('passenger-rides-' + uid)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `passenger_id=eq.${uid}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          if (payload.new.status === 'completed') {
            setActiveRide(null)
          } else {
            setActiveRide(payload.new)
          }
        }
      )
      .subscribe()
    channelRef.current = channel
  }

  const handleRequest = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const fare = seats * 25

    const { data, error: insertError } = await supabase
      .from('rides')
      .insert({ passenger_id: userId, pickup, destination, seats: Number(seats), fare, status: 'searching' })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setActiveRide(data)
    setLoading(false)
  }

  if (activeRide) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
        <h1>Your Ride</h1>
        <p><b>From:</b> {activeRide.pickup}</p>
        <p><b>To:</b> {activeRide.destination}</p>
        <p><b>Seats:</b> {activeRide.seats}</p>
        <p><b>Fare:</b> ৳{activeRide.fare}</p>
        <p><b>Status:</b> {activeRide.status}</p>
        {activeRide.status === 'searching' && <p style={{ color: '#888', marginTop: 20 }}>Waiting for a driver to accept...</p>}
        {activeRide.status === 'accepted' && <p style={{ color: 'green', marginTop: 20 }}>✅ A driver accepted your ride!</p>}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Request a Ride</h1>
      <form onSubmit={handleRequest}>
        <div style={{ marginBottom: 12 }}>
          <label>Pickup</label><br/>
          <input value={pickup} onChange={(e) => setPickup(e.target.value)} required style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Destination</label><br/>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} required style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Seats</label><br/>
          <input type="number" min="1" max="5" value={seats} onChange={(e) => setSeats(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: 10, width: '100%' }}>
          {loading ? 'Requesting...' : 'Find a Ride'}
        </button>
      </form>
    </div>
  )
}