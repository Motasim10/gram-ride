'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { notify } from '@/lib/notify'
import { useLanguage } from '@/lib/i18n'
import NotificationBell from '@/lib/NotificationBell'

const CAPACITY = { cng: 5, auto: 2 }

export default function DriverPage() {
  const [userId, setUserId] = useState(null)
  const [isFlagged, setIsFlagged] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { t } = useLanguage()
  const router = useRouter()

  // Reserve-ride state (unchanged from before)
  const [negotiatingRide, setNegotiatingRide] = useState(null)
  const [reserveRequests, setReserveRequests] = useState([])
  const [bids, setBids] = useState([])
  const [quoteInputs, setQuoteInputs] = useState({})
  const [finalOfferAmount, setFinalOfferAmount] = useState('')
  const negotiatingRideIdRef = useRef(null)
  const bidsChannelRef = useRef(null)

  // Shared-ride / trip state
  const [routes, setRoutes] = useState([])
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [vehicleType, setVehicleType] = useState('cng')
  const [activeTrip, setActiveTrip] = useState(null)
  const [tripPassengers, setTripPassengers] = useState([])
  const [waitingPassengers, setWaitingPassengers] = useState([])
  const [confirmingRideId, setConfirmingRideId] = useState(null)
  const [activeReserveRide, setActiveReserveRide] = useState(null)
  const [confirmingReserveComplete, setConfirmingReserveComplete] = useState(false)

  const ridesChannelRef = useRef(null)
  const tripChannelRef = useRef(null)
  const queueChannelRef = useRef(null)
  const isActiveDriverRef = useRef(false)
  const activeRouteIdRef = useRef(null)
  const [routeTrips, setRouteTrips] = useState([])
  const myTripChannelRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('flagged').eq('user_id', user.id).single()
      setIsFlagged(profile?.flagged || false)

      const { data: routeRows } = await supabase.from('routes').select('*').order('id')
      setRoutes(routeRows || [])

      const { data: openTrip } = await supabase.from('trips').select('*')
        .eq('driver_id', user.id).in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (openTrip) {
        setActiveTrip(openTrip)
        setSelectedRouteId(String(openTrip.route_id))
        setVehicleType(openTrip.vehicle_type)
      }

      const myTripChannel = supabase
        .channel('my-trip-' + user.id + '-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `driver_id=eq.${user.id}` }, (payload) => {
          const row = payload.new
          if (row.status === 'open' || row.status === 'in_progress') {
            setActiveTrip(row)
          } else {
            setActiveTrip(null)
            setTripPassengers([])
            setWaitingPassengers([])
          }
        })
        .subscribe()
      myTripChannelRef.current = myTripChannel

      await loadReserveRequests()
      subscribeToRideChanges(user.id)
      setLoading(false)
    }
    load()
    return () => {
      if (ridesChannelRef.current) supabase.removeChannel(ridesChannelRef.current)
      if (bidsChannelRef.current) supabase.removeChannel(bidsChannelRef.current)
      if (tripChannelRef.current) supabase.removeChannel(tripChannelRef.current)
      if (queueChannelRef.current) supabase.removeChannel(queueChannelRef.current)
      if (myTripChannelRef.current) supabase.removeChannel(myTripChannelRef.current)
    }
  }, [])

  useEffect(() => {
    negotiatingRideIdRef.current = negotiatingRide ? negotiatingRide.id : null
  }, [negotiatingRide])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && userId) loadReserveRequests()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [userId])

  // Load/subscribe to the trip's own passenger list whenever activeTrip changes
  useEffect(() => {
    if (tripChannelRef.current) { supabase.removeChannel(tripChannelRef.current); tripChannelRef.current = null }
    if (!activeTrip) { setTripPassengers([]); return }
    loadTripPassengers(activeTrip.id)
    const channel = supabase
      .channel('trip-passengers-' + activeTrip.id + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: `trip_id=eq.${activeTrip.id}` }, () => {
        loadTripPassengers(activeTrip.id)
      })
      .subscribe()
    tripChannelRef.current = channel
  }, [activeTrip?.id])

  // Load/subscribe to waiting passengers on the selected route, while online and no active trip
  const queueIndex = routeTrips.findIndex((t) => t.id === activeTrip?.id)
  const isActiveDriver = queueIndex === 0
  const queuePosition = queueIndex + 1

  useEffect(() => { isActiveDriverRef.current = isActiveDriver }, [isActiveDriver])
  useEffect(() => { activeRouteIdRef.current = activeTrip ? Number(activeTrip.route_id) : null }, [activeTrip?.route_id])

  useEffect(() => {
    if (queueChannelRef.current) { supabase.removeChannel(queueChannelRef.current); queueChannelRef.current = null }
    if (!activeTrip || activeTrip.status !== 'open') { setRouteTrips([]); return }
    loadRouteQueue(activeTrip.route_id)
    const channel = supabase
      .channel('route-queue-' + activeTrip.route_id + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `route_id=eq.${activeTrip.route_id}` }, () => {
        loadRouteQueue(activeTrip.route_id)
      })
      .subscribe()
    queueChannelRef.current = channel
  }, [activeTrip?.id, activeTrip?.status])

  useEffect(() => {
    if (!activeTrip || activeTrip.status !== 'open' || !isActiveDriver) { setWaitingPassengers([]); return }
    loadWaitingPassengers(activeTrip.route_id)
  }, [activeTrip?.id, activeTrip?.status, isActiveDriver])

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

  const loadReserveRequests = async () => {
    const { data: accepted } = await supabase.from('rides').select('*')
      .eq('driver_id', userId).eq('status', 'accepted').eq('ride_type', 'reserve')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    setActiveReserveRide(accepted || null)

    const { data: negotiating } = await supabase.from('rides').select('*')
      .eq('driver_id', userId).eq('status', 'negotiating').eq('ride_type', 'reserve')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    setNegotiatingRide(negotiating || null)

    const { data: open } = await supabase.from('rides').select('*')
      .eq('status', 'searching').eq('ride_type', 'reserve')
      .or(`pickup_time.is.null,pickup_time.gt.${new Date(Date.now() - 30 * 60 * 1000).toISOString()}`)
      .order('created_at', { ascending: true })
    setReserveRequests(open || [])
  }

  const loadWaitingPassengers = async (routeId) => {
    const { data } = await supabase.from('rides').select('*')
      .eq('status', 'searching').eq('ride_type', 'shared').eq('route_id', routeId)
      .order('created_at', { ascending: true })
    setWaitingPassengers(data || [])
  }

  const loadRouteQueue = async (routeId) => {
    const { data } = await supabase.from('trips').select('id, created_at')
      .eq('route_id', routeId).eq('status', 'open').order('created_at', { ascending: true })
    setRouteTrips(data || [])
  }

  const loadTripPassengers = async (tripId) => {
    const { data } = await supabase.from('rides').select('*')
      .eq('trip_id', tripId).neq('status', 'completed').neq('status', 'cancelled').order('pickup_pos')
    setTripPassengers(data || [])
  }

  const loadBids = async (rideId) => {
    const { data } = await supabase.from('bids').select('*').eq('ride_id', rideId).order('created_at', { ascending: false })
    setBids(data || [])
  }

  const subscribeToRideChanges = (uid) => {
    const channel = supabase
      .channel('driver-rides-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides' }, (payload) => {
        const row = payload.new
        if (row.status !== 'searching') return
        if (row.ride_type === 'reserve') {
          setReserveRequests((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]))
        } else if (isActiveDriverRef.current && Number(row.route_id) === activeRouteIdRef.current) {
          setWaitingPassengers((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' }, (payload) => {
        const row = payload.new
        if (row.status !== 'searching') {
          setReserveRequests((prev) => prev.filter((r) => r.id !== row.id))
          setWaitingPassengers((prev) => prev.filter((r) => r.id !== row.id))
        }
        if (row.status === 'searching' && row.ride_type === 'reserve') {
          setReserveRequests((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]))
        }
        if (row.status === 'searching' && row.ride_type === 'shared' && isActiveDriverRef.current && Number(row.route_id) === activeRouteIdRef.current) {
          setWaitingPassengers((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]))
        }
        if (row.status === 'cancelled') {
          setTripPassengers((prev) => prev.filter((r) => r.id !== row.id))
          setReserveRequests((prev) => prev.filter((r) => r.id !== row.id))
          setWaitingPassengers((prev) => prev.filter((r) => r.id !== row.id))
        }
        if (row.driver_id === uid && row.status === 'negotiating' && row.ride_type === 'reserve') setNegotiatingRide(row)
        if (row.driver_id === uid && row.status === 'accepted' && row.ride_type === 'reserve') {
          setNegotiatingRide(null)
          setActiveReserveRide(row)
        }
        if (row.driver_id === uid && row.status === 'cancelled' && row.ride_type === 'reserve') {
          if (negotiatingRideIdRef.current === row.id) setNegotiatingRide(null)
          setActiveReserveRide((prev) => (prev && prev.id === row.id ? null : prev))
        }
        if (row.driver_id !== uid && row.ride_type === 'reserve' && negotiatingRideIdRef.current === row.id) {
          setNegotiatingRide(null)
          setQuoteInputs((prev) => { const next = { ...prev }; delete next[row.id]; return next })
        }
      })
      .subscribe()
    ridesChannelRef.current = channel
  }

  // ---- Reserve ride handlers (unchanged behavior) ----
  const handleSendQuote = async (ride) => {
    if (isFlagged) { setError('Your account has been flagged and cannot accept rides right now. Contact support.'); return }
    const amount = Number(quoteInputs[ride.id])
    if (!amount || amount <= 0) { setError('Enter a valid fare amount first.'); return }
    setLoading(true); setError('')

    const { data, error: updateError } = await supabase.from('rides')
      .update({ driver_id: userId, status: 'negotiating' }).eq('id', ride.id).eq('status', 'searching').select().maybeSingle()

    if (!data) {
      setError(updateError ? updateError.message : 'This ride is no longer available.')
      setReserveRequests((prev) => prev.filter((r) => r.id !== ride.id))
      await loadReserveRequests()
      setLoading(false)
      return
    }

    await supabase.from('bids').insert({ ride_id: ride.id, driver_id: userId, amount, by: 'driver', status: 'pending' })
    await notify(ride.passenger_id, 'quoted', { amount, destination: ride.destination })
    setReserveRequests((prev) => prev.filter((r) => r.id !== ride.id))
    setNegotiatingRide(data)
    setLoading(false)
  }

  const latestBid = bids[0] || null

  const handleAcceptCounter = async () => {
    setLoading(true); setError('')
    const { error: updateError } = await supabase.from('rides')
      .update({ status: 'accepted', fare: latestBid.amount }).eq('id', negotiatingRide.id).eq('driver_id', userId)
    if (!updateError) await notify(negotiatingRide.passenger_id, 'rideConfirmedForPassenger', { amount: latestBid.amount })
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
    if (!bidError) await notify(negotiatingRide.passenger_id, 'finalOffer', { amount })
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
    setQuoteInputs((prev) => { const next = { ...prev }; delete next[rideId]; return next })
    await loadReserveRequests()
    setLoading(false)
  }

  // A reserve ride's own "complete trip" flow stays a simple one-shot confirm, same as before
  const handleCompleteReserve = async () => {
    setLoading(true)
    await supabase.from('rides').update({ status: 'completed' }).eq('id', activeReserveRide.id).select()
    await notify(activeReserveRide.passenger_id, 'tripComplete', { destination: activeReserveRide.destination, amount: activeReserveRide.fare })
    setActiveReserveRide(null)
    setConfirmingReserveComplete(false)
    setLoading(false)
  }

  // ---- Shared trip handlers ----
  const capacity = CAPACITY[vehicleType]

  const handleGoOnline = async () => {
    if (isFlagged) { setError('Your account has been flagged and cannot accept rides right now. Contact support.'); return }
    if (!selectedRouteId) { setError(t('selectRouteFirst')); return }
    setLoading(true); setError('')
    const { data, error: insertError } = await supabase.from('trips').insert({
      driver_id: userId, route_id: Number(selectedRouteId), vehicle_type: vehicleType, status: 'open',
    }).select().single()
    if (insertError) { setError(insertError.message); setLoading(false); return }
    setActiveTrip(data)
    setLoading(false)
  }

  const handleGoOffline = async () => {
    setLoading(true)
    const { data: toRelease } = await supabase.from('rides').select('id, passenger_id')
      .eq('trip_id', activeTrip.id).eq('status', 'accepted')
    for (const r of toRelease || []) await notify(r.passenger_id, 'tripCancelledByDriver', {})
    await supabase.from('rides')
      .update({ status: 'searching', driver_id: null, trip_id: null })
      .eq('trip_id', activeTrip.id).eq('status', 'accepted')
    await supabase.from('trips').update({ status: 'cancelled' }).eq('id', activeTrip.id).select()
    setActiveTrip(null)
    setTripPassengers([])
    setWaitingPassengers([])
    setLoading(false)
  }

  const filledSeats = tripPassengers.reduce((sum, r) => sum + r.seats, 0)

  const handleAcceptPassenger = async (ride) => {
    if (filledSeats + ride.seats > capacity) { setError('Not enough seats left for this passenger.'); return }
    setLoading(true); setError('')
    const { data, error: updateError } = await supabase.from('rides')
      .update({ driver_id: userId, status: 'accepted', trip_id: activeTrip.id })
      .eq('id', ride.id).eq('status', 'searching').select().maybeSingle()
    if (!data) {
      setError('This ride is no longer available.')
      setWaitingPassengers((prev) => prev.filter((r) => r.id !== ride.id))
      setLoading(false)
      return
    }
    await notify(ride.passenger_id, 'rideConfirmedForPassenger', { amount: ride.fare })
    setWaitingPassengers((prev) => prev.filter((r) => r.id !== ride.id))
    setLoading(false)
  }

  const handleStartTrip = async () => {
    setLoading(true)
    await supabase.from('trips').update({ status: 'in_progress' }).eq('id', activeTrip.id).select()
    setActiveTrip((prev) => ({ ...prev, status: 'in_progress' }))
    setLoading(false)
  }

  const handleConfirmCash = async (ride) => {
    setLoading(true)
    const { error: updateError } = await supabase.from('rides').update({ status: 'completed' }).eq('id', ride.id)
    if (updateError) { setError(updateError.message); setLoading(false); return }
    await notify(ride.passenger_id, 'tripComplete', { destination: ride.destination, amount: ride.fare })
    setTripPassengers((prev) => prev.filter((p) => p.id !== ride.id))
    setConfirmingRideId(null)
    setLoading(false)
  }

  const handleFinishTrip = async () => {
    setLoading(true)
    await supabase.from('trips').update({ status: 'completed' }).eq('id', activeTrip.id).select()
    setActiveTrip(null)
    setTripPassengers([])
    setWaitingPassengers([])
    setLoading(false)
  }

  const typeLabel = (rt) => (rt === 'reserve' ? t('reserve') : t('shared'))
  const vehicleLabel = (v) => (v === 'auto' ? t('auto2') : t('cng5'))

  if (loading && !activeTrip && !negotiatingRide) return <p style={{ textAlign: 'center', marginTop: 80 }}>{t('loading')}</p>

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      {isFlagged && (
        <div style={{ background: '#fff5f5', border: '1px solid #f5c6c6', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <p style={{ margin: 0, color: '#c00', fontWeight: 'bold' }}>⚠️ Account Flagged</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#c00' }}>
            Your account has been flagged by an admin and cannot accept new rides right now. Please contact support.
          </p>
        </div>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* ---------- Shared route / trip section ---------- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1>{t('rideRequestsTitle')}</h1>
        <NotificationBell />
      </div>

      {!activeTrip && (
        <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 20 }}>
          <div style={{ marginBottom: 10 }}>
            <label>{t('routeLabel')}</label><br/>
            <select value={selectedRouteId} onChange={(e) => setSelectedRouteId(e.target.value)} style={{ width: '100%', padding: 8 }}>
              <option value="">{routes.length === 0 ? t('noRoutesYet') : t('selectPlaceholder')}</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>{t('vehicle')}</label><br/>
            <button type="button" onClick={() => setVehicleType('cng')} style={{ padding: 8, marginRight: 8, fontWeight: vehicleType === 'cng' ? 'bold' : 'normal' }}>{t('cng5')}</button>
            <button type="button" onClick={() => setVehicleType('auto')} style={{ padding: 8, fontWeight: vehicleType === 'auto' ? 'bold' : 'normal' }}>{t('auto2')}</button>
          </div>
          <button onClick={handleGoOnline} disabled={loading || isFlagged} style={{ padding: 10, width: '100%' }}>{t('goOnline')}</button>
        </div>
      )}

      {activeTrip && activeTrip.status === 'open' && (
        <div style={{ border: '1px solid #0066cc', borderRadius: 8, padding: 12, marginBottom: 20 }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>
            {t('onlineOnRoute')}: {routes.find((r) => r.id === activeTrip.route_id)?.name}
          </p>
          <p style={{ margin: '4px 0 12px', fontSize: 13, color: '#555' }}>
            {vehicleLabel(activeTrip.vehicle_type)} · {filledSeats}/{capacity} {t('seatsFilled')}
          </p>

          <button onClick={handleGoOffline} disabled={loading} style={{ padding: 8, width: '100%', marginBottom: 12, background: 'none', border: '1px solid #c00', color: '#c00' }}>
            {t('goOffline')}
          </button>

          {isActiveDriver ? (
            <>
              {tripPassengers.length > 0 && (
                <>
                  <h3 style={{ marginBottom: 6 }}>{t('passengersOnBoard')} ({filledSeats}/{capacity})</h3>
                  {tripPassengers.map((p) => (
                    <div key={p.id} style={{ border: '1px solid #eee', borderRadius: 6, padding: 8, marginBottom: 6, fontSize: 13 }}>
                      {t('boardsAt')}: {p.pickup} · {t('getsOffAt')}: {p.destination} · {p.seats} {t('seats')} · ৳{p.fare}
                    </div>
                  ))}
                </>
              )}

              <h3 style={{ marginBottom: 6 }}>{t('waitingPassengersOnRoute')}</h3>
              {waitingPassengers.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>{t('noWaitingPassengers')}</p>}
              {waitingPassengers.map((r) => (
                <div key={r.id} style={{ border: '1px solid #eee', borderRadius: 6, padding: 8, marginBottom: 6 }}>
                  <p style={{ margin: 0, fontSize: 13 }}>{t('boardsAt')}: <b>{r.pickup}</b> · {t('getsOffAt')}: <b>{r.destination}</b></p>
                  <p style={{ margin: '2px 0 8px', fontSize: 13 }}>{r.seats} {t('seats')} · ৳{r.fare}</p>
                  <button onClick={() => handleAcceptPassenger(r)} disabled={loading || filledSeats + r.seats > capacity}
                    style={{ padding: 8, width: '100%' }}>
                    {t('accept')}
                  </button>
                </div>
              ))}

              {tripPassengers.length > 0 && (
                <button onClick={handleStartTrip} disabled={loading} style={{ padding: 10, width: '100%', marginTop: 12 }}>
                  {t('startTrip')}
                </button>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: 18 }}>🚦 {t('inQueue')}</p>
              <p style={{ margin: '6px 0', fontSize: 14 }}>{t('queuePosition')}: #{queuePosition}</p>
              <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{t('waitingForTurn')}</p>
            </div>
          )}
        </div>
      )}

      {activeTrip && activeTrip.status === 'in_progress' && (
        <div style={{ border: '1px solid #2e7d32', borderRadius: 8, padding: 12, marginBottom: 20 }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{t('tripInProgress')}</p>
          <p style={{ margin: '4px 0 12px', fontSize: 13, color: '#555' }}>
            {routes.find((r) => r.id === activeTrip.route_id)?.name} · {tripPassengers.length} {t('passengersOnBoard')}
          </p>

          {tripPassengers.map((p) => (
            <div key={p.id} style={{ border: '1px solid #eee', borderRadius: 6, padding: 8, marginBottom: 6 }}>
              <p style={{ margin: 0, fontSize: 13 }}>{t('boardsAt')}: <b>{p.pickup}</b> → {t('getsOffAt')}: <b>{p.destination}</b></p>
              <p style={{ margin: '2px 0 8px', fontSize: 13, fontWeight: 'bold' }}>৳{p.fare}</p>
              {confirmingRideId === p.id ? (
                <>
                  <p style={{ fontSize: 13 }}>{t('confirmCashFrom')} ৳{p.fare}?</p>
                  <button onClick={() => handleConfirmCash(p)} disabled={loading} style={{ padding: 8, width: '100%', marginBottom: 6 }}>
                    {t('yesReceived')}{p.fare}
                  </button>
                  <button onClick={() => setConfirmingRideId(null)} disabled={loading} style={{ padding: 8, width: '100%' }}>
                    {t('noGoBack')}
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmingRideId(p.id)} style={{ padding: 8, width: '100%' }}>
                  {t('confirmCashFrom')}
                </button>
              )}
            </div>
          ))}

          {tripPassengers.length === 0 ? (
            <p style={{ color: 'green', fontSize: 13 }}>{t('allPassengersSettled')}</p>
          ) : null}

          <button onClick={handleFinishTrip} disabled={loading || tripPassengers.length > 0} style={{ padding: 10, width: '100%', marginTop: 12 }}>
            {t('finishTrip')}
          </button>
        </div>
      )}

      {/* ---------- Reserve section (unchanged) ---------- */}
            {activeReserveRide && (
        <div style={{ border: '1px solid #2e7d32', borderRadius: 8, padding: 12, marginBottom: 20 }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{t('yourActiveRide')}</p>
          <p style={{ margin: '4px 0' }}><b>{t('from')}:</b> {activeReserveRide.pickup}</p>
          <p style={{ margin: '4px 0' }}><b>{t('to')}:</b> {activeReserveRide.destination}</p>
          <p style={{ margin: '4px 0' }}><b>{t('fare')}:</b> ৳{activeReserveRide.fare}</p>

          {!confirmingReserveComplete ? (
            <button onClick={() => setConfirmingReserveComplete(true)} style={{ padding: 10, width: '100%', marginTop: 8 }}>
              {t('completeTrip')}
            </button>
          ) : (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 13 }}>{t('didYouReceive')}{activeReserveRide.fare} {t('inCash')}</p>
              <button onClick={handleCompleteReserve} disabled={loading} style={{ padding: 10, width: '100%', marginBottom: 6 }}>
                {t('yesReceived')}{activeReserveRide.fare}
              </button>
              <button onClick={() => setConfirmingReserveComplete(false)} disabled={loading} style={{ padding: 8, width: '100%' }}>
                {t('noGoBack')}
              </button>
            </div>
          )}
        </div>
      )}

      <h2>{t('reserveRequestsTitle')}</h2>

      {negotiatingRide ? (
        <div>
          <p><b>{t('from')}:</b> {negotiatingRide.pickup}</p>
          <p><b>{t('to')}:</b> {negotiatingRide.destination}</p>
          <p><b>{negotiatingRide.seats}</b> {t('seats')}</p>

          {bids.length === 1 && (
            <>
              <p><b>{t('youQuoted')}:</b> ৳{latestBid.amount}</p>
              <p style={{ color: '#888' }}>{t('waitingForPassengerResponse')}</p>
            </>
          )}

          {bids.length === 2 && (
            <>
              <p><b>{t('passengerCountered')}:</b> ৳{latestBid.amount}</p>
              <button onClick={handleAcceptCounter} disabled={loading} style={{ padding: 10, width: '100%', marginBottom: 8 }}>
                {t('accept')} ৳{latestBid.amount}
              </button>
              <input type="number" placeholder={t('yourFinalOffer')} value={finalOfferAmount}
                onChange={(e) => setFinalOfferAmount(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8 }} />
              <button onClick={handleSendFinalOffer} disabled={loading} style={{ padding: 10, width: '100%', marginBottom: 8 }}>
                {t('sendFinalOffer')}
              </button>
              <button onClick={handleRejectCounter} disabled={loading}
                style={{ padding: 8, width: '100%', background: 'none', border: 'none', color: '#888', textDecoration: 'underline' }}>
                {t('notInterestedRelease')}
              </button>
            </>
          )}

          {bids.length >= 3 && (
            <>
              <p><b>{t('youSentFinalOffer')}:</b> ৳{latestBid.amount}</p>
              <p style={{ color: '#888' }}>{t('waitingForPassengerDecision')}</p>
            </>
          )}
        </div>
      ) : (
        <>
          {reserveRequests.length === 0 && <p>{t('noRequestsWaiting')}</p>}
          {reserveRequests.map((r) => (
            <div key={r.id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 12, borderRadius: 8 }}>
              <p><b>{t('from')}:</b> {r.pickup}</p>
              <p><b>{t('to')}:</b> {r.destination}</p>
              <p><b>{r.seats}</b> {t('seats')}</p>
              <p><b>{t('pickupAt')}:</b> {r.pickup_time ? new Date(r.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('pickupNow')}</p>
              <input type="number" placeholder={t('yourFareQuote')} value={quoteInputs[r.id] || ''}
                onChange={(e) => setQuoteInputs((prev) => ({ ...prev, [r.id]: e.target.value }))}
                style={{ width: '100%', padding: 8, marginBottom: 8 }} />
              <button onClick={() => handleSendQuote(r)} disabled={loading} style={{ padding: 8, width: '100%' }}>
                {t('sendQuote')}
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}