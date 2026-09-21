'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

const typeLabel = (t) => (t === 'reserve' ? 'রিজার্ভ (পুরো গাড়ি)' : 'শেয়ার্ড')
const vehicleLabel = (v) => (v === 'auto' ? 'অটো' : 'সিএনজি')

export default function DriverPage() {
  const [userId, setUserId] = useState(null)
  const [activeRide, setActiveRide] = useState(null)
  const [negotiatingRide, setNegotiatingRide] = useState(null)
  const [requests, setRequests] = useState([])
  const [bids, setBids] = useState([])
  const [quoteInputs, setQuoteInputs] = useState({})
  const [finalOfferAmount, setFinalOfferAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmingComplete, setConfirmingComplete] = useState(false)
  const router = useRouter()
  const ridesChannelRef = useRef(null)
  const bidsChannelRef = useRef(null)
  const negotiatingRideIdRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      await refreshAll(user.id)
      subscribeToRideChanges(user.id)
    }
    load()
    return () => {
      if (ridesChannelRef.current) supabase.removeChannel(ridesChannelRef.current)
      if (bidsChannelRef.current) supabase.removeChannel(bidsChannelRef.current)
    }
  }, [])

  useEffect(() => {
    negotiatingRideIdRef.current = negotiatingRide ? negotiatingRide.id : null
  }, [negotiatingRide])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && userId) refreshAll(userId)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [userId])

  useEffect(() => {
    if (bidsChannelRef.current) { supabase.removeChannel(bidsChannelRef.current); bidsChannelRef.current = null }
    if (!negotiatingRide) { setBids([]); return }
    loadBids(negotiatingRide.id)
    const channel = supabase
      .channel('driver-bids-for-ride-' + negotiatingRide.id + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `ride_id=eq.${negotiatingRide.id}` }, (payload) => {
        setBids((prev) => (prev.some((b) => b.id === payload.new.id) ? prev : [payload.new, ...prev]))
      })
      .subscribe()
    bidsChannelRef.current = channel
  }, [negotiatingRide?.id])

  const refreshAll = async (uid) => {
    const { data: accepted } = await supabase.from('rides').select('*').eq('driver_id', uid).eq('status', 'accepted')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    setActiveRide(accepted)

    const { data: negotiating } = await supabase.from('rides').select('*').eq('driver_id', uid).eq('status', 'negotiating')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    setNegotiatingRide(negotiating)

    const { data: open } = await supabase.from('rides').select('*').eq('status', 'searching').order('created_at', { ascending: true })
    setRequests(open || [])
  }

  const loadBids = async (rideId) => {
    const { data } = await supabase.from('bids').select('*').eq('ride_id', rideId).order('created_at', { ascending: false })
    setBids(data || [])
  }

  const subscribeToRideChanges = (uid) => {
    const channel = supabase
      .channel('driver-rides-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides' }, (payload) => {
        if (payload.new.status === 'searching') {
          setRequests((prev) => (prev.some((r) => r.id === payload.new.id) ? prev : [...prev, payload.new]))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' }, (payload) => {
        const row = payload.new
        if (row.status !== 'searching') {
          setRequests((prev) => prev.filter((r) => r.id !== row.id))
        } else {
          setRequests((prev) => (prev.find((r) => r.id === row.id) ? prev : [...prev, row]))
        }
        if (row.driver_id === uid && row.status === 'negotiating') setNegotiatingRide(row)
        if (row.driver_id === uid && row.status === 'accepted') { setNegotiatingRide(null); setActiveRide(row) }
        if (row.driver_id !== uid && negotiatingRideIdRef.current === row.id) {
          setNegotiatingRide(null)
          setQuoteInputs((prev) => {
            const next = { ...prev }
            delete next[row.id]
            return next
          })
        }
      })
      .subscribe()
    ridesChannelRef.current = channel
  }

  const handleSendQuote = async (ride) => {
    const amount = Number(quoteInputs[ride.id])
    if (!amount || amount <= 0) { setError('Enter a valid fare amount first.'); return }
    setLoading(true); setError('')

    const { data, error: updateError } = await supabase.from('rides')
      .update({ driver_id: userId, status: 'negotiating' }).eq('id', ride.id).eq('status', 'searching').select().single()

    if (updateError || !data) {
      setError(updateError ? updateError.message : 'Someone else already quoted this one.')
      await refreshAll(userId)
      setLoading(false)
      return
    }

    await supabase.from('bids').insert({ ride_id: ride.id, driver_id: userId, amount, by: 'driver', status: 'pending' })
    setRequests((prev) => prev.filter((r) => r.id !== ride.id))
    setNegotiatingRide(data)
    setLoading(false)
  }

  const latestBid = bids[0] || null

  const handleAcceptCounter = async () => {
    setLoading(true); setError('')
    const { error: updateError } = await supabase.from('rides')
      .update({ status: 'accepted', fare: latestBid.amount }).eq('id', negotiatingRide.id).eq('driver_id', userId)
    if (updateError) setError(updateError.message)
    setLoading(false)
  }

  const handleSendFinalOffer = async () => {
    const amount = Number(finalOfferAmount)
    if (!amount || amount <= 0) { setError('Enter a valid amount first.'); return }
    setLoading(true); setError('')
    const { error: bidError } = await supabase.from('bids').insert({
      ride_id: negotiatingRide.id, driver_id: userId, amount, by: 'driver', status: 'pending',
    })
    if (bidError) setError(bidError.message)
    setFinalOfferAmount('')
    setLoading(false)
  }

  const handleRejectCounter = async () => {
    setLoading(true); setError('')
    const rideId = negotiatingRide.id
    await supabase.from('bids').delete().eq('ride_id', rideId)
    setBids([])
    const { error: updateError } = await supabase.from('rides')
      .update({ status: 'searching', driver_id: null }).eq('id', rideId).eq('driver_id', userId)
    if (updateError) setError(updateError.message)
    setNegotiatingRide(null)
    setQuoteInputs((prev) => {
      const next = { ...prev }
      delete next[rideId]
      return next
    })
    await refreshAll(userId)
    setLoading(false)
  }

    const handleComplete = async () => {
    setLoading(true)
    await supabase.from('rides').update({ status: 'completed' }).eq('id', activeRide.id)
    setActiveRide(null)
    setConfirmingComplete(false)
    setLoading(false)
    refreshAll(userId)
  }

    if (activeRide) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
        <h1>Your Active Ride</h1>
        <p><b>From:</b> {activeRide.pickup}</p>
        <p><b>To:</b> {activeRide.destination}</p>
        <p><b>Type:</b> {typeLabel(activeRide.ride_type)}</p>
        <p><b>Vehicle:</b> {vehicleLabel(activeRide.vehicle_type)}</p>
        <p><b>{activeRide.ride_type === 'reserve' ? 'People traveling' : 'Seats'}:</b> {activeRide.seats}</p>
        <p><b>Fare:</b> ৳{activeRide.fare}</p>

        {!confirmingComplete ? (
          <button onClick={() => setConfirmingComplete(true)} style={{ padding: 10, width: '100%', marginTop: 12 }}>
            Complete Trip
          </button>
        ) : (
          <div style={{ marginTop: 12, border: '1px solid #ccc', padding: 12, borderRadius: 8 }}>
            <p><b>Confirm cash received: ৳{activeRide.fare}?</b></p>
            <p style={{ color: '#888', fontSize: 13 }}>Did you receive ৳{activeRide.fare} in cash from the passenger?</p>
            <button onClick={handleComplete} disabled={loading} style={{ padding: 10, width: '100%', marginBottom: 8 }}>
              {loading ? 'Confirming...' : `Yes, I received ৳${activeRide.fare}`}
            </button>
            <button onClick={() => setConfirmingComplete(false)} disabled={loading} style={{ padding: 8, width: '100%' }}>
              No, go back
            </button>
          </div>
        )}
      </div>
    )
  }

  if (negotiatingRide) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
        <h1>Negotiating</h1>
        <p><b>From:</b> {negotiatingRide.pickup}</p>
        <p><b>To:</b> {negotiatingRide.destination}</p>
        <p><b>Type:</b> {typeLabel(negotiatingRide.ride_type)}</p>
        <p><b>Vehicle:</b> {vehicleLabel(negotiatingRide.vehicle_type)}</p>
        <p><b>{negotiatingRide.ride_type === 'reserve' ? 'People traveling' : 'Seats'}:</b> {negotiatingRide.seats}</p>
        {error && <p style={{ color: 'red' }}>{error}</p>}

        {bids.length === 1 && (
          <>
            <p><b>You quoted:</b> ৳{latestBid.amount}</p>
            <p style={{ color: '#888' }}>Waiting for the passenger's response...</p>
          </>
        )}

        {bids.length === 2 && (
          <>
            <p><b>Passenger countered:</b> ৳{latestBid.amount}</p>
            <button onClick={handleAcceptCounter} disabled={loading} style={{ padding: 10, width: '100%', marginBottom: 8 }}>
              Accept ৳{latestBid.amount}
            </button>
            <input type="number" placeholder="Your final offer (৳)" value={finalOfferAmount}
              onChange={(e) => setFinalOfferAmount(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8 }} />
            <button onClick={handleSendFinalOffer} disabled={loading} style={{ padding: 10, width: '100%', marginBottom: 8 }}>
              Send Final Offer
            </button>
            <button onClick={handleRejectCounter} disabled={loading}
              style={{ padding: 8, width: '100%', background: 'none', border: 'none', color: '#888', textDecoration: 'underline' }}>
              Not interested — release ride
            </button>
          </>
        )}

        {bids.length >= 3 && (
          <>
            <p><b>You sent final offer:</b> ৳{latestBid.amount}</p>
            <p style={{ color: '#888' }}>Waiting for the passenger's decision...</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Ride Requests</h1>
      <p style={{ color: '#888', fontSize: 13 }}>Send a fare quote to claim a request.</p>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {requests.length === 0 && <p>No requests waiting right now.</p>}
      {requests.map((r) => (
        <div key={r.id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 12, borderRadius: 8 }}>
          <p><b>From:</b> {r.pickup}</p>
          <p><b>To:</b> {r.destination}</p>
          <p><b>Type:</b> {typeLabel(r.ride_type)}</p>
          <p><b>Vehicle:</b> {vehicleLabel(r.vehicle_type)}</p>
          <p><b>{r.ride_type === 'reserve' ? 'People traveling' : 'Seats'}:</b> {r.seats}</p>
          <input type="number" placeholder="Your fare quote (৳)" value={quoteInputs[r.id] || ''}
            onChange={(e) => setQuoteInputs((prev) => ({ ...prev, [r.id]: e.target.value }))}
            style={{ width: '100%', padding: 8, marginBottom: 8 }} />
          <button onClick={() => handleSendQuote(r)} disabled={loading} style={{ padding: 8, width: '100%' }}>
            Send Quote
          </button>
        </div>
      ))}
    </div>
  )
}