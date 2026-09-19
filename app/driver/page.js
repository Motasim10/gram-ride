'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function DriverPage() {
  const [userId, setUserId] = useState(null)
  const [activeRide, setActiveRide] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
      await loadRequests()
      subscribeToChanges()
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
      .eq('driver_id', uid)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setActiveRide(data)
  }

  const loadRequests = async () => {
    const { data } = await supabase.from('rides').select('*').eq('status', 'searching').order('created_at', { ascending: true })
    setRequests(data || [])
  }

  const subscribeToChanges = () => {
    const channel = supabase
      .channel('driver-rides')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides' }, (payload) => {
        if (payload.new.status === 'searching') setRequests((prev) => [...prev, payload.new])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' }, (payload) => {
        if (payload.new.status !== 'searching') setRequests((prev) => prev.filter((r) => r.id !== payload.new.id))
      })
      .subscribe()
    channelRef.current = channel
  }

  const handleAccept = async (rideId) => {
    setLoading(true)
    setError('')

    const { data, error: updateError } = await supabase
      .from('rides')
      .update({ driver_id: userId, status: 'accepted' })
      .eq('id', rideId)
      .eq('status', 'searching')
      .select()
      .single()

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }
    if (!data) {
      setError('Another driver already accepted this one.')
      await loadRequests()
      setLoading(false)
      return
    }

    setActiveRide(data)
    setRequests((prev) => prev.filter((r) => r.id !== rideId))
    setLoading(false)
  }

  const handleComplete = async () => {
    setLoading(true)
    await supabase.from('rides').update({ status: 'completed' }).eq('id', activeRide.id)
    setActiveRide(null)
    setLoading(false)
    loadRequests()
  }

  if (activeRide) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
        <h1>Your Active Ride</h1>
        <p><b>From:</b> {activeRide.pickup}</p>
        <p><b>To:</b> {activeRide.destination}</p>
        <p><b>Seats:</b> {activeRide.seats}</p>
        <p><b>Fare:</b> ৳{activeRide.fare}</p>
        <p><b>Status:</b> {activeRide.status}</p>
        <button onClick={handleComplete} disabled={loading} style={{ padding: 10, width: '100%', marginTop: 12 }}>
          {loading ? 'Completing...' : 'Complete Trip'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Ride Requests</h1>
      <p style={{ color: '#888', fontSize: 13 }}>New requests appear here automatically.</p>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {requests.length === 0 && <p>No requests waiting right now.</p>}
      {requests.map((r) => (
        <div key={r.id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 12, borderRadius: 8 }}>
          <p><b>From:</b> {r.pickup}</p>
          <p><b>To:</b> {r.destination}</p>
          <p><b>Seats:</b> {r.seats}</p>
          <p><b>Fare:</b> ৳{r.fare}</p>
          <button onClick={() => handleAccept(r.id)} disabled={loading} style={{ padding: 8, width: '100%' }}>Accept</button>
        </div>
      ))}
    </div>
  )
}