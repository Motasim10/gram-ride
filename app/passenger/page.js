'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

const CAPACITY = { cng: 5, auto: 2 }

export default function PassengerPage() {
  const [userId, setUserId] = useState(null)
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [rideType, setRideType] = useState('shared')
  const [vehicleType, setVehicleType] = useState('cng')
  const [seats, setSeats] = useState(1)
  const [activeRide, setActiveRide] = useState(null)
  const [bids, setBids] = useState([])
  const [counterAmount, setCounterAmount] = useState('')
  const [ratingRide, setRatingRide] = useState(null)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const rideChannelRef = useRef(null)
  const bidsChannelRef = useRef(null)

  const capacity = CAPACITY[vehicleType]

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      await checkActiveRide(user.id)
      subscribeToRideChanges(user.id)
    }
    load()
    return () => {
      if (rideChannelRef.current) supabase.removeChannel(rideChannelRef.current)
      if (bidsChannelRef.current) supabase.removeChannel(bidsChannelRef.current)
    }
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && userId) checkActiveRide(userId)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [userId])

  useEffect(() => {
    if (bidsChannelRef.current) { supabase.removeChannel(bidsChannelRef.current); bidsChannelRef.current = null }
    if (!activeRide) { setBids([]); return }
    loadBids(activeRide.id)
    const channel = supabase
      .channel('bids-for-ride-' + activeRide.id + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `ride_id=eq.${activeRide.id}` }, (payload) => {
        setBids((prev) => (prev.some((b) => b.id === payload.new.id) ? prev : [payload.new, ...prev]))
      })
      .subscribe()
    bidsChannelRef.current = channel
  }, [activeRide?.id])

  const checkActiveRide = async (uid) => {
    const { data } = await supabase.from('rides').select('*').eq('passenger_id', uid)
      .neq('status', 'completed').order('created_at', { ascending: false }).limit(1).maybeSingle()
    setActiveRide(data)
  }

  const loadBids = async (rideId) => {
    const { data } = await supabase.from('bids').select('*').eq('ride_id', rideId).order('created_at', { ascending: false })
    setBids(data || [])
  }

  const subscribeToRideChanges = (uid) => {
    const channel = supabase
      .channel('passenger-rides-' + uid + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: `passenger_id=eq.${uid}` }, (payload) => {
        if (payload.eventType === 'DELETE') return
                if (payload.new.status === 'completed') {
          setRatingRide(payload.new)
          setActiveRide(null)
          setPickup('')
          setDestination('')
          setSeats(1)
                } else {
          setActiveRide(payload.new)
        }
      })
      .subscribe()
    rideChannelRef.current = channel
  }

  const handleSelectVehicle = (v) => {
    setVehicleType(v)
    setSeats((s) => Math.min(s, CAPACITY[v]))
  }

  const handleRequest = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: insertError } = await supabase
      .from('rides')
      .insert({
        passenger_id: userId, pickup, destination, seats: Number(seats),
        ride_type: rideType, vehicle_type: vehicleType, status: 'searching',
      })
      .select().single()
    if (insertError) { setError(insertError.message); setLoading(false); return }
    setActiveRide(data)
    setLoading(false)
  }

  const latestBid = bids[0] || null

  const handleAcceptBid = async () => {
    setLoading(true); setError('')
    const { error: updateError } = await supabase.from('rides')
      .update({ status: 'accepted', fare: latestBid.amount }).eq('id', activeRide.id).eq('passenger_id', userId)
    if (updateError) setError(updateError.message)
    setLoading(false)
  }

  const handleCounter = async (e) => {
    e.preventDefault()
    setError('')
    if (!counterAmount || Number(counterAmount) <= 0) return
    setLoading(true)
    const { error: bidError } = await supabase.from('bids').insert({
      ride_id: activeRide.id, driver_id: activeRide.driver_id, amount: Number(counterAmount), by: 'passenger', status: 'pending',
    })
    if (bidError) setError(bidError.message)
    setCounterAmount('')
    setLoading(false)
  }

  const handleCancelRide = async () => {
    setLoading(true); setError('')
    await supabase.from('bids').delete().eq('ride_id', activeRide.id)
    setBids([])
    const { error: updateError } = await supabase.from('rides')
      .update({ status: 'searching', driver_id: null }).eq('id', activeRide.id).eq('passenger_id', userId)
    if (updateError) setError(updateError.message)
    setLoading(false)
  }

    const handleSubmitRating = async () => {
    if (!stars) return
    setLoading(true)
    await supabase.from('ratings').insert({
      ride_id: ratingRide.id,
      passenger_id: userId,
      driver_id: ratingRide.driver_id,
      stars,
      comment,
    })
    setRatingSubmitted(true)
    setLoading(false)
  }

  const closeRating = () => {
    setRatingRide(null)
    setStars(0)
    setComment('')
    setRatingSubmitted(false)
  }

  const typeLabel = (t) => (t === 'reserve' ? 'রিজার্ভ (পুরো গাড়ি)' : 'শেয়ার্ড')
  const vehicleLabel = (v) => (v === 'auto' ? 'অটো' : 'সিএনজি')

    if (ratingRide) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
        <h1>Rate Your Trip</h1>
        <p>{ratingRide.pickup} → {ratingRide.destination}</p>
        <p><b>Fare paid:</b> ৳{ratingRide.fare}</p>

        {!ratingSubmitted ? (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} onClick={() => setStars(n)} style={{ cursor: 'pointer', color: n <= stars ? '#f5a623' : '#ccc' }}>
                  ★
                </span>
              ))}
            </div>
            <textarea
              placeholder="Any comments? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ width: '100%', padding: 8, marginBottom: 12, minHeight: 80 }}
            />
            <button onClick={handleSubmitRating} disabled={loading || !stars} style={{ padding: 10, width: '100%', marginBottom: 8 }}>
              {loading ? 'Submitting...' : 'Submit Rating'}
            </button>
            <button onClick={closeRating} style={{ padding: 8, width: '100%', background: 'none', border: 'none', color: '#888', textDecoration: 'underline' }}>
              Skip
            </button>
          </>
        ) : (
          <>
            <p style={{ color: 'green' }}>✅ Thanks for your feedback!</p>
            <button onClick={closeRating} style={{ padding: 10, width: '100%' }}>Done</button>
          </>
        )}
      </div>
    )
  }

  if (activeRide) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
        <h1>Your Ride</h1>
        <p><b>From:</b> {activeRide.pickup}</p>
        <p><b>To:</b> {activeRide.destination}</p>
        <p><b>Type:</b> {typeLabel(activeRide.ride_type)}</p>
        <p><b>Vehicle:</b> {vehicleLabel(activeRide.vehicle_type)}</p>
        <p><b>{activeRide.ride_type === 'reserve' ? 'People traveling' : 'Seats'}:</b> {activeRide.seats}</p>
        <p><b>Status:</b> {activeRide.status}</p>

        {activeRide.status === 'searching' && (
          <p style={{ color: '#888', marginTop: 20 }}>Waiting for a driver to send a fare quote...</p>
        )}

        {activeRide.status === 'negotiating' && (
          <div style={{ marginTop: 20, border: '1px solid #ccc', padding: 12, borderRadius: 8 }}>
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {bids.length === 1 && (
              <>
                <p><b>Driver quoted:</b> ৳{latestBid.amount}</p>
                <button onClick={handleAcceptBid} disabled={loading} style={{ padding: 10, width: '100%', marginBottom: 8 }}>
                  Accept ৳{latestBid.amount}
                </button>
                <form onSubmit={handleCounter}>
                  <input type="number" placeholder="Your counter-offer (৳)" value={counterAmount}
                    onChange={(e) => setCounterAmount(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8 }} />
                  <button type="submit" disabled={loading} style={{ padding: 10, width: '100%' }}>Send Counter-Offer</button>
                </form>
              </>
            )}

            {bids.length === 2 && (
              <>
                <p><b>You offered:</b> ৳{latestBid.amount}</p>
                <p style={{ color: '#888' }}>Waiting for the driver's response...</p>
              </>
            )}

            {bids.length >= 3 && (
              <>
                <p><b>Driver's final offer:</b> ৳{latestBid.amount}</p>
                <p style={{ color: '#888', fontSize: 13 }}>This is the driver's final price — accept it, or cancel and look for another driver.</p>
                <button onClick={handleAcceptBid} disabled={loading} style={{ padding: 10, width: '100%', marginBottom: 8 }}>
                  Accept ৳{latestBid.amount}
                </button>
                <button onClick={handleCancelRide} disabled={loading} style={{ padding: 10, width: '100%' }}>
                  Cancel &amp; Find Another Driver
                </button>
              </>
            )}
          </div>
        )}

        {activeRide.status === 'accepted' && <p style={{ color: 'green', marginTop: 20 }}>✅ Confirmed at ৳{activeRide.fare}</p>}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Request a Ride</h1>
      <form onSubmit={handleRequest}>
        <div style={{ marginBottom: 12 }}>
          <label>Ride Type</label><br/>
          <button type="button" onClick={() => setRideType('shared')}
            style={{ padding: 8, marginRight: 8, fontWeight: rideType === 'shared' ? 'bold' : 'normal' }}>শেয়ার্ড</button>
          <button type="button" onClick={() => setRideType('reserve')}
            style={{ padding: 8, fontWeight: rideType === 'reserve' ? 'bold' : 'normal' }}>রিজার্ভ (পুরো গাড়ি)</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Vehicle</label><br/>
          <button type="button" onClick={() => handleSelectVehicle('cng')}
            style={{ padding: 8, marginRight: 8, fontWeight: vehicleType === 'cng' ? 'bold' : 'normal' }}>সিএনজি (5 seats)</button>
          <button type="button" onClick={() => handleSelectVehicle('auto')}
            style={{ padding: 8, fontWeight: vehicleType === 'auto' ? 'bold' : 'normal' }}>অটো (2 seats)</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Pickup</label><br/>
          <input value={pickup} onChange={(e) => setPickup(e.target.value)} required style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Destination</label><br/>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} required style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>{rideType === 'reserve' ? 'How many people are traveling?' : 'Seats needed'}</label><br/>
          <input type="number" min="1" max={capacity} value={seats}
            onChange={(e) => setSeats(Math.min(capacity, Math.max(1, Number(e.target.value))))}
            style={{ width: '100%', padding: 8 }} />
          <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Max {capacity} for {vehicleLabel(vehicleType)}</p>
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: 10, width: '100%' }}>
          {loading ? 'Requesting...' : 'Find a Ride'}
        </button>
      </form>
    </div>
  )
}