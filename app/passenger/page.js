'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { notify } from '@/lib/notify'
import { useLanguage } from '@/lib/i18n'
import NotificationBell from '@/lib/NotificationBell'

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
  const [showSosConfirm, setShowSosConfirm] = useState(false)
  const [sosSent, setSosSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isFlagged, setIsFlagged] = useState(false)
  const [routes, setRoutes] = useState([])
  const [stopsByRoute, setStopsByRoute] = useState({})
  const [routeFares, setRouteFares] = useState({})
  const [driverProfile, setDriverProfile] = useState(null)
  const [routeId, setRouteId] = useState('')
  const [pickupStopId, setPickupStopId] = useState('')
  const [dropStopId, setDropStopId] = useState('')
  const [pickupMode, setPickupMode] = useState('now')
  const [pickupTimeInput, setPickupTimeInput] = useState('')
  const router = useRouter()
  const rideChannelRef = useRef(null)
  const bidsChannelRef = useRef(null)
  const { t } = useLanguage()

  const capacity = CAPACITY[vehicleType]
  const routeStops = stopsByRoute[routeId] || []
  const pickupStop = routeStops.find((s) => String(s.id) === String(pickupStopId))
  const dropStop = routeStops.find((s) => String(s.id) === String(dropStopId))
  const dropOptions = pickupStop ? routeStops.filter((s) => s.position > pickupStop.position) : []
  const farePerSeat = routeId && pickupStopId && dropStopId ? routeFares[`${routeId}|${pickupStopId}|${dropStopId}`] : null
  const fixedFare = farePerSeat ? farePerSeat * seats : null

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('flagged').eq('user_id', user.id).single()
      setIsFlagged(profile?.flagged || false)

      const { data: routeRows } = await supabase.from('routes').select('*').order('id')
      const { data: stopRows } = await supabase.from('route_stops').select('*').order('position')
      const { data: fareRows } = await supabase.from('route_fares').select('*')
      const stops = {}
      ;(stopRows || []).forEach((s) => { (stops[s.route_id] = stops[s.route_id] || []).push(s) })
      const fareLookup = {}
      ;(fareRows || []).forEach((f) => { fareLookup[`${f.route_id}|${f.from_stop_id}|${f.to_stop_id}`] = f.fare_per_seat })
      setRoutes(routeRows || [])
      setStopsByRoute(stops)
      setRouteFares(fareLookup)

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
    const loadDriver = async () => {
      if (!activeRide || !activeRide.driver_id) { setDriverProfile(null); return }
      const { data, error: profileError } = await supabase.from('profiles').select('name, phone').eq('user_id', activeRide.driver_id).single()
      if (profileError) { console.log('driver profile load error:', profileError.message); setDriverProfile(null); return }
      setDriverProfile(data)

      const { data: ratings } = await supabase.from('ratings').select('stars').eq('driver_id', activeRide.driver_id)
      if (ratings && ratings.length > 0) {
        const avg = (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1)
        setDriverProfile((prev) => (prev ? { ...prev, avgRating: avg, ratingCount: ratings.length } : prev))
      }
    }
    loadDriver()
  }, [activeRide?.id, activeRide?.driver_id])


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
      .neq('status', 'completed').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(1).maybeSingle()
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
          setRouteId('')
          setPickupStopId('')
          setDropStopId('')
          setSosSent(false)
          setShowSosConfirm(false)
        } else if (payload.new.status === 'cancelled') {
          setActiveRide(null)
          setPickup('')
          setDestination('')
          setSeats(1)
          setRouteId('')
          setPickupStopId('')
          setDropStopId('')
          setSosSent(false)
          setShowSosConfirm(false)
        } else {
          setActiveRide(payload.new)
        }},
      )
      .subscribe()
    rideChannelRef.current = channel
  }

  const handleSelectVehicle = (v) => {
    setVehicleType(v)
    setSeats((s) => Math.min(s, CAPACITY[v]))
  }

  const handleRequest = async (e) => {
    e.preventDefault()
    if (isFlagged) { setError('Your account has been flagged and cannot request rides right now. Contact support.'); return }
    if (rideType === 'shared' && (!fixedFare || !pickupStop || !dropStop)) { setError(t('routeNotAvailable')); return }

    let pickupTimeIso = null
    if (rideType === 'reserve' && pickupMode === 'later') {
      const [hh, mm] = (pickupTimeInput || '').split(':').map(Number)
      const when = new Date()
      when.setHours(hh, mm, 0, 0)
      if (!pickupTimeInput || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) { setError(t('pickupTimeInvalid')); return }
      pickupTimeIso = when.toISOString()
    }

    setError('')
    setSosSent(false)
    setShowSosConfirm(false)
    setLoading(true)
    const { data, error: insertError } = await supabase
      .from('rides')
      .insert(
        rideType === 'shared'
          ? {
              passenger_id: userId,
              pickup: pickupStop.name, destination: dropStop.name,
              seats: Number(seats),
              ride_type: 'shared', vehicle_type: vehicleType, status: 'searching',
              fare: fixedFare,
              route_id: Number(routeId),
              pickup_pos: pickupStop.position, drop_pos: dropStop.position,
            }
          : {
              passenger_id: userId, pickup, destination, seats: Number(seats),
              ride_type: rideType, vehicle_type: vehicleType, status: 'searching',
              fare: null,
              pickup_time: pickupTimeIso,
            }
      )
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
    if (!updateError) await notify(activeRide.driver_id, 'rideConfirmedForDriver', { amount: latestBid.amount })
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
    if (!bidError) await notify(activeRide.driver_id, 'countered', { amount: counterAmount })
    if (bidError) setError(bidError.message)
    setCounterAmount('')
    setLoading(false)
  }

  const handleCancelRide = async () => {
    setLoading(true); setError('')
    const previousDriverId = activeRide.driver_id
    if (previousDriverId) await notify(previousDriverId, 'cancelled', {})
    await supabase.from('bids').delete().eq('ride_id', activeRide.id)
    setBids([])
    const { error: updateError } = await supabase.from('rides')
      .update({ status: 'searching', driver_id: null }).eq('id', activeRide.id).eq('passenger_id', userId)
    if (updateError) setError(updateError.message)
    setLoading(false)
  }

    const handleCancelAnytime = async () => {
    setLoading(true); setError('')
    const driverId = activeRide.driver_id
    await supabase.from('bids').delete().eq('ride_id', activeRide.id)
    const { error: updateError } = await supabase.from('rides')
      .update({ status: 'cancelled' }).eq('id', activeRide.id).eq('passenger_id', userId)
    if (updateError) { setError(updateError.message); setLoading(false); return }
    if (driverId) await notify(driverId, 'passengerCancelledRide', {})
    setLoading(false)
  }

    const handleCancelSearching = async () => {
    setLoading(true); setError('')
    const { error: updateError } = await supabase.from('rides')
      .update({ status: 'cancelled' }).eq('id', activeRide.id).eq('passenger_id', userId)
    if (updateError) setError(updateError.message)
    setLoading(false)
  }

    const handleSendSos = async () => {
    await supabase.from('sos_alerts').insert({
      user_id: userId,
      ride_id: activeRide.id,
      details: `Pickup: ${activeRide.pickup}, Destination: ${activeRide.destination}, Status: ${activeRide.status}`,
    })
    setShowSosConfirm(false)
    setSosSent(true)
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
    await notify(ratingRide.driver_id, 'ratingReceived', { stars })
    setRatingSubmitted(true)
    setLoading(false)
  }

  const closeRating = () => {
    setRatingRide(null)
    setStars(0)
    setComment('')
    setRatingSubmitted(false)
  }

  const typeLabel = (rt) => (rt === 'reserve' ? t('reserve') : t('shared'))
  const vehicleLabel = (v) => (v === 'auto' ? t('auto2') : t('cng5'))

  if (ratingRide) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
        <h1>{t('rateYourTrip')}</h1>
        <p>{ratingRide.pickup} → {ratingRide.destination}</p>
        <p><b>{t('farePaid')}:</b> ৳{ratingRide.fare}</p>

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
              placeholder={t('anyComments')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ width: '100%', padding: 8, marginBottom: 12, minHeight: 80 }}
            />
            <button onClick={handleSubmitRating} disabled={loading || !stars} style={{ padding: 10, width: '100%', marginBottom: 8 }}>
              {loading ? t('submitting') : t('submitRating')}
            </button>
            <button onClick={closeRating} style={{ padding: 8, width: '100%', background: 'none', border: 'none', color: '#888', textDecoration: 'underline' }}>
              {t('skip')}
            </button>
          </>
        ) : (
          <>
            <p style={{ color: 'green' }}>✅ {t('thanksForFeedback')}</p>
            <button onClick={closeRating} style={{ padding: 10, width: '100%' }}>{t('done')}</button>
          </>
        )}
      </div>
    )
  }

  if (activeRide) {
    const steps = [
      { key: 'searching', label: t('stepRequested') },
      { key: 'negotiating', label: t('stepRequested') },
      { key: 'accepted', label: t('stepOnTheWay') },
      { key: 'completed', label: t('stepDone') },
    ]
    const stepOrder = ['searching', 'negotiating', 'accepted', 'completed']
    const currentIndex = stepOrder.indexOf(activeRide.status)
    const uniqueSteps = [
      { key: 'requested', label: t('stepRequested'), active: currentIndex >= 0 },
      { key: 'matched', label: t('stepMatched'), active: currentIndex >= 2 },
      { key: 'done', label: t('stepDone'), active: currentIndex >= 3 },
    ]

    return (
      <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1>{t('trackingTitle')}</h1>
            <NotificationBell />
          </div>
          {!showSosConfirm && !sosSent && (
            <button onClick={() => setShowSosConfirm(true)} style={{ padding: '8px 14px', background: '#c00', color: 'white', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>
              🆘 {t('sos')}
            </button>
          )}
        </div>

        {showSosConfirm && (
          <div style={{ border: '2px solid #c00', background: '#fff5f5', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <p style={{ margin: '0 0 6px', fontWeight: 'bold', color: '#c00' }}>{t('sosConfirmTitle')}</p>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#c00' }}>{t('sosConfirmText')}</p>
            <button onClick={handleSendSos} style={{ padding: 10, width: '100%', marginBottom: 6, background: '#c00', color: 'white', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>
              {t('sosConfirmButton')}
            </button>
            <button onClick={() => setShowSosConfirm(false)} style={{ padding: 8, width: '100%', background: 'none', border: '1px solid #ccc', borderRadius: 6 }}>
              {t('sosCancelButton')}
            </button>
          </div>
        )}

        {sosSent && (
          <div style={{ border: '2px solid #2e7d32', background: '#f5fff5', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#2e7d32' }}>✅ {t('sosSent')}</p>
          </div>
        )}

        <div style={{ display: 'flex', marginBottom: 20 }}>
          {uniqueSteps.map((s, i) => (
            <div key={s.key} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', margin: '0 auto 4px',
                background: s.active ? '#0066cc' : '#ddd', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 13,
              }}>{i + 1}</div>
              <p style={{ margin: 0, fontSize: 11, color: s.active ? '#0066cc' : '#999' }}>{s.label}</p>
            </div>
          ))}
        </div>

        <p><b>{t('from')}:</b> {activeRide.pickup}</p>
        <p><b>{t('to')}:</b> {activeRide.destination}</p>
        <p><b>{t('type')}:</b> {typeLabel(activeRide.ride_type)}</p>
        <p><b>{t('vehicle')}:</b> {vehicleLabel(activeRide.vehicle_type)}</p>
        {activeRide.pickup_time && (
          <p><b>{t('pickupAt')}:</b> {new Date(activeRide.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        )}
        <p><b>{activeRide.ride_type === 'reserve' ? t('peopleTraveling') : t('seats')}:</b> {activeRide.seats}</p>
        <p><b>{t('status')}:</b> {t(activeRide.status)}</p>

        {activeRide.driver_id && driverProfile && (
          <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, margin: '16px 0' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 'bold' }}>{t('yourDriver')}: {driverProfile.name}</p>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: '#555' }}>
              {t('driverRating')}: {driverProfile.avgRating ? `★ ${driverProfile.avgRating} (${driverProfile.ratingCount})` : t('noRatingYet')}
            </p>
            {driverProfile.phone ? (
              <a href={`tel:${driverProfile.phone}`} style={{ display: 'inline-block', marginTop: 6, padding: '8px 14px', background: '#0066cc', color: 'white', borderRadius: 6, textDecoration: 'none', fontSize: 14 }}>
                📞 {t('callDriver')}
              </a>
            ) : (
              <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>{t('noPhoneAvailable')}</p>
            )}
          </div>
        )}

        {activeRide.status === 'searching' && (
          <div style={{ marginTop: 20 }}>
            <p style={{ color: '#888' }}>
              {activeRide.ride_type === 'shared' ? t('waitingForAcceptShared') : t('waitingForQuote')}
            </p>
            <button onClick={handleCancelSearching} disabled={loading} style={{ padding: 10, width: '100%' }}>
              {t('cancelRequest')}
            </button>
          </div>
        )}

        {activeRide.status === 'negotiating' && (
          <div style={{ marginTop: 20, border: '1px solid #ccc', padding: 12, borderRadius: 8 }}>
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {bids.length === 1 && (
              <>
                <p><b>{t('driverQuoted')}:</b> ৳{latestBid.amount}</p>
                <button onClick={handleAcceptBid} disabled={loading} style={{ padding: 10, width: '100%', marginBottom: 8 }}>
                  {t('accept')} ৳{latestBid.amount}
                </button>
                <form onSubmit={handleCounter}>
                  <input type="number" placeholder={t('yourCounterOffer')} value={counterAmount}
                    onChange={(e) => setCounterAmount(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8 }} />
                  <button type="submit" disabled={loading} style={{ padding: 10, width: '100%' }}>{t('sendCounterOffer')}</button>
                </form>
              </>
            )}

            {bids.length === 2 && (
              <>
                <p><b>{t('youOffered')}:</b> ৳{latestBid.amount}</p>
                <p style={{ color: '#888' }}>{t('waitingForDriverResponse')}</p>
              </>
            )}

            {bids.length >= 3 && (
              <>
                <p><b>{t('driversFinalOffer')}:</b> ৳{latestBid.amount}</p>
                <p style={{ color: '#888', fontSize: 13 }}>{t('finalOfferNote')}</p>
                <button onClick={handleAcceptBid} disabled={loading} style={{ padding: 10, width: '100%', marginBottom: 8 }}>
                  {t('accept')} ৳{latestBid.amount}
                </button>
                <button onClick={handleCancelRide} disabled={loading} style={{ padding: 10, width: '100%' }}>
                  {t('cancelFindAnother')}
                </button>
              </>
            )}
          </div>
        )}

        {activeRide.status === 'accepted' && <p style={{ color: 'green', marginTop: 20 }}>✅ {t('confirmedAt')} ৳{activeRide.fare}</p>}

        {(activeRide.status === 'negotiating' || activeRide.status === 'accepted') && (
          <button onClick={handleCancelAnytime} disabled={loading} style={{ padding: 8, width: '100%', marginTop: 16, background: 'none', border: '1px solid #c00', color: '#c00', borderRadius: 6 }}>
            {t('cancelRideAnytime')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1>{t('requestRideTitle')}</h1>
        <NotificationBell />
      </div>
      {isFlagged && (
        <div style={{ background: '#fff5f5', border: '1px solid #f5c6c6', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <p style={{ margin: 0, color: '#c00', fontWeight: 'bold' }}>⚠️ Account Flagged</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#c00' }}>
            Your account has been flagged by an admin and cannot request new rides right now. Please contact support.
          </p>
        </div>
      )}
      <form onSubmit={handleRequest}>
        <div style={{ marginBottom: 12 }}>
          <label>{t('rideType')}</label><br/>
          <button type="button" onClick={() => setRideType('shared')}
            style={{ padding: 8, marginRight: 8, fontWeight: rideType === 'shared' ? 'bold' : 'normal' }}>{t('shared')}</button>
          <button type="button" onClick={() => setRideType('reserve')}
            style={{ padding: 8, fontWeight: rideType === 'reserve' ? 'bold' : 'normal' }}>{t('reserve')}</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>{t('vehicle')}</label><br/>
          <button type="button" onClick={() => handleSelectVehicle('cng')}
            style={{ padding: 8, marginRight: 8, fontWeight: vehicleType === 'cng' ? 'bold' : 'normal' }}>{t('cng5')}</button>
          <button type="button" onClick={() => handleSelectVehicle('auto')}
            style={{ padding: 8, fontWeight: vehicleType === 'auto' ? 'bold' : 'normal' }}>{t('auto2')}</button>
        </div>
        {rideType === 'reserve' && (
          <div style={{ marginBottom: 12 }}>
            <label>{t('pickupTimeLabel')}</label><br/>
            <button type="button" onClick={() => setPickupMode('now')}
              style={{ padding: 8, marginRight: 8, fontWeight: pickupMode === 'now' ? 'bold' : 'normal' }}>{t('pickupNow')}</button>
            <button type="button" onClick={() => setPickupMode('later')}
              style={{ padding: 8, fontWeight: pickupMode === 'later' ? 'bold' : 'normal' }}>{t('pickupLater')}</button>
            {pickupMode === 'later' && (
              <input type="time" value={pickupTimeInput} onChange={(e) => setPickupTimeInput(e.target.value)} required
                style={{ width: '100%', padding: 8, marginTop: 8 }} />
            )}
          </div>
        )}
        {rideType === 'shared' ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <label>{t('routeLabel')}</label><br/>
              <select value={routeId} onChange={(e) => { setRouteId(e.target.value); setPickupStopId(''); setDropStopId('') }} required style={{ width: '100%', padding: 8 }}>
                <option value="" disabled>{routes.length === 0 ? t('noRoutesYet') : t('selectPlaceholder')}</option>
                {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>{t('pickupStopLabel')}</label><br/>
              <select value={pickupStopId} onChange={(e) => { setPickupStopId(e.target.value); setDropStopId('') }} required disabled={!routeId} style={{ width: '100%', padding: 8 }}>
                <option value="" disabled>{t('selectPlaceholder')}</option>
                {routeStops.slice(0, -1).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>{t('dropStopLabel')}</label><br/>
              <select value={dropStopId} onChange={(e) => setDropStopId(e.target.value)} required disabled={!pickupStopId} style={{ width: '100%', padding: 8 }}>
                <option value="" disabled>{t('selectPlaceholder')}</option>
                {dropOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <label>{t('pickup')}</label><br/>
              <input value={pickup} onChange={(e) => setPickup(e.target.value)} required style={{ width: '100%', padding: 8 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>{t('destination')}</label><br/>
              <input value={destination} onChange={(e) => setDestination(e.target.value)} required style={{ width: '100%', padding: 8 }} />
            </div>
          </>
        )}
        <div style={{ marginBottom: 12 }}>
          <label>{rideType === 'reserve' ? t('peopleTraveling') : t('seatsNeeded')}</label><br/>
          <input type="number" min="1" max={capacity} value={seats}
            onChange={(e) => setSeats(Math.min(capacity, Math.max(1, Number(e.target.value))))}
            style={{ width: '100%', padding: 8 }} />
          <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{t('maxFor')} {capacity} {vehicleLabel(vehicleType)}</p>
        </div>
        {rideType === 'shared' && pickupStopId && dropStopId && (
          fixedFare ? (
            <p style={{ fontSize: 14, fontWeight: 'bold', color: '#0066cc', marginBottom: 12 }}>{t('fare')}: ৳{fixedFare} ({t('cannotNegotiate')})</p>
          ) : (
            <p style={{ fontSize: 13, color: '#c00', marginBottom: 12 }}>{t('routeNotAvailable')}</p>
          )
        )}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading || (rideType === 'shared' && (!pickupStopId || !dropStopId || !fixedFare))} style={{ padding: 10, width: '100%' }}>
          {loading ? t('requesting') : t('findRide')}
        </button>
      </form>
    </div>
  )
}