'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { notify } from '@/lib/notify'
import { useLanguage } from '@/lib/i18n'
import NotificationBell from '@/lib/NotificationBell'
import Screen from '@/components/ui/Screen'
import PrimaryButton from '@/components/ui/PrimaryButton'
import SectionCard from '@/components/ui/SectionCard'

const CAPACITY = { cng: 5, auto: 2 }
const formatLeft = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

const selectClass = 'tap-target w-full rounded-xl border-2 border-line bg-white px-3 text-[15.5px] font-semibold text-charcoal focus:border-emerald focus:outline-none disabled:opacity-50'
const inputClass = 'tap-target w-full rounded-xl border-2 border-line bg-white px-3 text-[15.5px] font-semibold text-charcoal focus:border-emerald focus:outline-none'
const dangerButtonClass = 'tap-target w-full rounded-2xl border-2 border-danger bg-white text-[15px] font-bold text-danger active:bg-danger/10 disabled:opacity-40'

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-charcoal/50">{hint}</span>}
    </label>
  )
}

function Segmented({ options, value, onChange }) {
  return (
    <div className={`grid gap-2 ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`tap-target rounded-xl border-2 px-2 text-[14px] font-bold transition-colors ${value === o.value ? 'border-emerald bg-emerald text-white' : 'border-line bg-white text-charcoal/70 active:bg-mint'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Stepper({ value, onMinus, onPlus, minusDisabled, plusDisabled }) {
  return (
    <div className="flex items-center justify-between">
      <button type="button" onClick={onMinus} disabled={minusDisabled}
        className="tap-target w-14 rounded-xl bg-mint text-2xl font-bold text-emerald active:bg-emerald active:text-white disabled:opacity-40">−</button>
      <span className="font-num text-[28px] font-extrabold text-charcoal">{value}</span>
      <button type="button" onClick={onPlus} disabled={plusDisabled}
        className="tap-target w-14 rounded-xl bg-mint text-2xl font-bold text-emerald active:bg-emerald active:text-white disabled:opacity-40">+</button>
    </div>
  )
}

function Chip({ children, tone = 'plain' }) {
  const tones = {
    plain: 'bg-offwhite text-charcoal/70 border-line-soft',
    green: 'bg-mint text-emerald border-emerald/40',
    amber: 'bg-amber/15 text-amber-dark border-amber/50',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-bold ${tones[tone]}`}>{children}</span>
  )
}

function Avatar({ name }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mint text-lg font-bold text-emerald">
      {(name || '?').trim().charAt(0).toUpperCase()}
    </div>
  )
}

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
  const [womenCount, setWomenCount] = useState(0)
  const [waitMinutes, setWaitMinutes] = useState(10)
  const [nowMs, setNowMs] = useState(Date.now())
  useEffect(() => {
    if (activeRide?.status !== 'searching') return
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [activeRide?.status])
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
          setWomenCount(0)
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
          setWomenCount(0)
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

    const womenSeats = rideType === 'shared' ? Number(womenCount) || 0 : 0
    if (rideType === 'shared' && (womenSeats < 0 || womenSeats > Number(seats) || womenSeats > (vehicleType === 'cng' ? 3 : 2))) { setError(t('womenCountInvalid')); return }
    const expiresAtIso = (rideType === 'shared' || pickupMode === 'now')
      ? new Date(Date.now() + Number(waitMinutes) * 60000).toISOString()
      : null

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
              women_seats: womenSeats,
              expires_at: expiresAtIso,
            }
          : {
              passenger_id: userId, pickup, destination, seats: Number(seats),
              ride_type: rideType, vehicle_type: vehicleType, status: 'searching',
              fare: null,
              pickup_time: pickupTimeIso,
              expires_at: expiresAtIso,
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
      .update({ status: 'searching', driver_id: null, expires_at: activeRide.pickup_time ? null : new Date(Date.now() + Number(waitMinutes) * 60000).toISOString() }).eq('id', activeRide.id).eq('passenger_id', userId)
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

  const handleExtendWait = async () => {
    setLoading(true); setError('')
    const { error: updateError } = await supabase.from('rides')
      .update({ expires_at: new Date(Date.now() + Number(waitMinutes) * 60000).toISOString() })
      .eq('id', activeRide.id).eq('passenger_id', userId).eq('status', 'searching')
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
      <Screen>
        <h1 className="mb-4 text-[22px] font-bold text-charcoal">{t('rateYourTrip')}</h1>
        <SectionCard className="mb-6">
          <p className="font-bold text-charcoal">{ratingRide.pickup} → {ratingRide.destination}</p>
          <p className="mt-1 text-[14px] text-charcoal/60">
            {t('farePaid')}: <span className="font-num font-bold text-charcoal">৳{ratingRide.fare}</span>
          </p>
        </SectionCard>

        {!ratingSubmitted ? (
          <div className="space-y-4">
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStars(n)}
                  aria-label={String(n)}
                  className={`h-14 w-14 text-5xl leading-none ${n <= stars ? 'text-amber' : 'text-line'}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              placeholder={t('anyComments')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-24 w-full rounded-xl border-2 border-line bg-white p-3 text-[15px] font-semibold text-charcoal focus:border-emerald focus:outline-none"
            />
            <PrimaryButton onClick={handleSubmitRating} disabled={loading || !stars}>
              {loading ? t('submitting') : t('submitRating')}
            </PrimaryButton>
            <button onClick={closeRating} className="w-full py-2 text-[14px] font-semibold text-charcoal/50 underline">
              {t('skip')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-emerald/40 bg-mint px-4 py-3">
              <p className="font-bold text-emerald-dark">✅ {t('thanksForFeedback')}</p>
            </div>
            <PrimaryButton onClick={closeRating}>{t('done')}</PrimaryButton>
          </div>
        )}
      </Screen>
    )
  }

  if (activeRide) {
    const stepOrder = ['searching', 'negotiating', 'accepted', 'completed']
    const currentIndex = stepOrder.indexOf(activeRide.status)
    const uniqueSteps = [
      { key: 'requested', label: t('stepRequested'), active: currentIndex >= 0 },
      { key: 'matched', label: t('stepMatched'), active: currentIndex >= 2 },
      { key: 'done', label: t('stepDone'), active: currentIndex >= 3 },
    ]
    const expired = activeRide.expires_at && nowMs >= new Date(activeRide.expires_at).getTime()

    return (
      <Screen>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-bold text-charcoal">{t('trackingTitle')}</h1>
            <NotificationBell />
          </div>
          {!showSosConfirm && !sosSent && (
            <button
              onClick={() => setShowSosConfirm(true)}
              className="flex h-9 items-center gap-1 rounded-full bg-danger px-3 text-[12px] font-bold text-white active:bg-danger-dark"
            >
              🆘 {t('sos')}
            </button>
          )}
        </div>

        {showSosConfirm && (
          <div className="mb-4 rounded-2xl border-2 border-danger bg-danger/5 p-4">
            <p className="font-bold text-danger">{t('sosConfirmTitle')}</p>
            <p className="mb-3 mt-1 text-[13px] text-danger">{t('sosConfirmText')}</p>
            <div className="space-y-2">
              <PrimaryButton tone="red" onClick={handleSendSos}>{t('sosConfirmButton')}</PrimaryButton>
              <button onClick={() => setShowSosConfirm(false)} className="tap-target w-full rounded-2xl border-2 border-line bg-white text-[15px] font-bold text-charcoal/70">
                {t('sosCancelButton')}
              </button>
            </div>
          </div>
        )}

        {sosSent && (
          <div className="mb-4 rounded-xl border-2 border-emerald/40 bg-mint px-4 py-3">
            <p className="text-[14px] font-semibold text-emerald-dark">✅ {t('sosSent')}</p>
          </div>
        )}

        <div className="mb-5 flex items-start">
          {uniqueSteps.map((s, i) => (
            <div key={s.key} className="relative flex flex-1 flex-col items-center">
              {i > 0 && <span className={`absolute left-[-50%] top-3.5 h-0.5 w-full ${s.active ? 'bg-emerald' : 'bg-line'}`} />}
              <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold ${s.active ? 'bg-emerald text-white' : 'bg-line-soft text-charcoal/40'}`}>
                {s.active ? '✓' : i + 1}
              </span>
              <p className={`mt-1 text-[11.5px] font-semibold ${s.active ? 'text-emerald' : 'text-charcoal/40'}`}>{s.label}</p>
            </div>
          ))}
        </div>

        <SectionCard className="mb-4">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald" />
              <span className="my-1 w-px flex-1 bg-line" />
              <span className="h-3 w-3 rounded-full bg-amber" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[12px] text-charcoal/50">{t('from')}</p>
                <p className="font-bold text-charcoal">{activeRide.pickup}</p>
              </div>
              <div>
                <p className="text-[12px] text-charcoal/50">{t('to')}</p>
                <p className="font-bold text-charcoal">{activeRide.destination}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip tone="green">{t(activeRide.status)}</Chip>
            <Chip>{typeLabel(activeRide.ride_type)}</Chip>
            <Chip>{vehicleLabel(activeRide.vehicle_type)}</Chip>
            <Chip>{activeRide.seats} {t('seats')}</Chip>
            {activeRide.pickup_time && (
              <Chip tone="amber">
                {t('pickupAt')}: {new Date(activeRide.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Chip>
            )}
          </div>
        </SectionCard>

        {activeRide.driver_id && driverProfile && (
          <SectionCard className="mb-4">
            <div className="flex items-center gap-3">
              <Avatar name={driverProfile.name} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-charcoal/50">{t('yourDriver')}</p>
                <p className="truncate font-bold text-charcoal">{driverProfile.name}</p>
                <p className="text-[13px] text-charcoal/60">
                  {driverProfile.avgRating ? `★ ${driverProfile.avgRating} (${driverProfile.ratingCount})` : t('noRatingYet')}
                </p>
              </div>
            </div>
            {driverProfile.phone ? (
              <a
                href={`tel:${driverProfile.phone}`}
                className="tap-target mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald text-[16px] font-bold text-white active:bg-emerald-dark"
              >
                📞 {t('callDriver')}
              </a>
            ) : (
              <p className="mt-3 text-[12px] text-charcoal/50">{t('noPhoneAvailable')}</p>
            )}
          </SectionCard>
        )}

        {error && <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">{error}</p>}

        {activeRide.status === 'searching' && (
          <div className="space-y-3">
            {expired ? (
              <SectionCard className="border-danger/40 bg-danger/5">
                <p className="font-bold text-danger">{t('noDriverFound')}</p>
                <div className="mt-3">
                  <PrimaryButton onClick={handleExtendWait} disabled={loading}>
                    {t('keepWaiting')} {waitMinutes} {t('minutesShort')}
                  </PrimaryButton>
                </div>
              </SectionCard>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border-2 border-amber/50 bg-amber/15 px-3.5 py-3">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="live-dot absolute inline-flex h-2.5 w-2.5 rounded-full bg-amber" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber" />
                </span>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold leading-snug text-amber-dark">
                    {activeRide.ride_type === 'shared' ? t('waitingForAcceptShared') : t('waitingForQuote')}
                  </p>
                  {activeRide.expires_at && (
                    <p className="mt-0.5 text-[13px] text-amber-dark">
                      {t('waitingTimeLeft')}:{' '}
                      <span className="font-num font-bold">{formatLeft(new Date(activeRide.expires_at).getTime() - nowMs)}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
            <button onClick={handleCancelSearching} disabled={loading} className={dangerButtonClass}>
              {t('cancelRequest')}
            </button>
          </div>
        )}

        {activeRide.status === 'negotiating' && (
          <SectionCard className="space-y-3">
            {bids.length === 1 && (
              <>
                <div>
                  <p className="text-[13px] font-semibold text-charcoal/60">{t('driverQuoted')}</p>
                  <p className="font-num text-[32px] font-extrabold text-emerald">৳{latestBid.amount}</p>
                </div>
                <PrimaryButton onClick={handleAcceptBid} disabled={loading}>
                  {t('accept')} ৳{latestBid.amount}
                </PrimaryButton>
                <form onSubmit={handleCounter} className="space-y-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={t('yourCounterOffer')}
                    value={counterAmount}
                    onChange={(e) => setCounterAmount(e.target.value)}
                    className={`${inputClass} font-num`}
                  />
                  <PrimaryButton type="submit" tone="outline" disabled={loading}>{t('sendCounterOffer')}</PrimaryButton>
                </form>
              </>
            )}

            {bids.length === 2 && (
              <>
                <div>
                  <p className="text-[13px] font-semibold text-charcoal/60">{t('youOffered')}</p>
                  <p className="font-num text-[32px] font-extrabold text-charcoal">৳{latestBid.amount}</p>
                </div>
                <p className="text-[14px] text-charcoal/60">{t('waitingForDriverResponse')}</p>
              </>
            )}

            {bids.length >= 3 && (
              <>
                <div>
                  <p className="text-[13px] font-semibold text-charcoal/60">{t('driversFinalOffer')}</p>
                  <p className="font-num text-[32px] font-extrabold text-emerald">৳{latestBid.amount}</p>
                </div>
                <p className="text-[13px] text-charcoal/60">{t('finalOfferNote')}</p>
                <PrimaryButton onClick={handleAcceptBid} disabled={loading}>
                  {t('accept')} ৳{latestBid.amount}
                </PrimaryButton>
                <PrimaryButton tone="outline" onClick={handleCancelRide} disabled={loading}>
                  {t('cancelFindAnother')}
                </PrimaryButton>
              </>
            )}
          </SectionCard>
        )}

        {activeRide.status === 'accepted' && (
          <div className="rounded-xl border-2 border-emerald/40 bg-mint px-4 py-3">
            <p className="font-bold text-emerald-dark">
              ✅ {t('confirmedAt')} <span className="font-num">৳{activeRide.fare}</span>
            </p>
          </div>
        )}

        {(activeRide.status === 'negotiating' || activeRide.status === 'accepted') && (
          <button onClick={handleCancelAnytime} disabled={loading} className={`${dangerButtonClass} mt-4`}>
            {t('cancelRideAnytime')}
          </button>
        )}
      </Screen>
    )
  }

  const maxWomen = Math.min(Number(seats) || 1, vehicleType === 'cng' ? 3 : 2)

  return (
    <Screen>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-charcoal">{t('requestRideTitle')}</h1>
        <NotificationBell />
      </div>

      {isFlagged && (
        <div className="mb-4 rounded-2xl border-2 border-danger/40 bg-danger/5 p-4">
          <p className="font-bold text-danger">⚠️ Account Flagged</p>
          <p className="mt-1 text-[13px] text-danger">
            Your account has been flagged by an admin and cannot request new rides right now. Please contact support.
          </p>
        </div>
      )}

      <form onSubmit={handleRequest} className="space-y-4">
        <Segmented
          value={rideType}
          onChange={setRideType}
          options={[
            { value: 'shared', label: t('shared') },
            { value: 'reserve', label: t('reserve') },
          ]}
        />

        <SectionCard className="space-y-4">
          {rideType === 'shared' ? (
            <>
              <Field label={t('routeLabel')}>
                <select
                  value={routeId}
                  onChange={(e) => { setRouteId(e.target.value); setPickupStopId(''); setDropStopId('') }}
                  required
                  className={selectClass}
                >
                  <option value="" disabled>{routes.length === 0 ? t('noRoutesYet') : t('selectPlaceholder')}</option>
                  {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <Field label={t('pickupStopLabel')}>
                <select
                  value={pickupStopId}
                  onChange={(e) => { setPickupStopId(e.target.value); setDropStopId('') }}
                  required
                  disabled={!routeId}
                  className={selectClass}
                >
                  <option value="" disabled>{t('selectPlaceholder')}</option>
                  {routeStops.slice(0, -1).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label={t('dropStopLabel')}>
                <select
                  value={dropStopId}
                  onChange={(e) => setDropStopId(e.target.value)}
                  required
                  disabled={!pickupStopId}
                  className={selectClass}
                >
                  <option value="" disabled>{t('selectPlaceholder')}</option>
                  {dropOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </>
          ) : (
            <>
              <Field label={t('pickup')}>
                <input value={pickup} onChange={(e) => setPickup(e.target.value)} required className={inputClass} />
              </Field>
              <Field label={t('destination')}>
                <input value={destination} onChange={(e) => setDestination(e.target.value)} required className={inputClass} />
              </Field>
            </>
          )}
        </SectionCard>

        <SectionCard className="space-y-4">
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-charcoal/60">{t('vehicle')}</p>
            <div className="grid grid-cols-2 gap-3">
              {[['cng', '🚕', t('cng5')], ['auto', '🛺', t('auto2')]].map(([v, icon, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleSelectVehicle(v)}
                  className={`tap-target flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-[13px] font-bold ${vehicleType === v ? 'border-emerald bg-mint text-emerald' : 'border-line bg-white text-charcoal/70'}`}
                >
                  <span className="text-2xl">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-charcoal/60">
              {rideType === 'reserve' ? t('peopleTraveling') : t('seatsNeeded')}
            </p>
            <Stepper
              value={seats}
              onMinus={() => setSeats(Math.max(1, Number(seats) - 1))}
              onPlus={() => setSeats(Math.min(capacity, Number(seats) + 1))}
              minusDisabled={Number(seats) <= 1}
              plusDisabled={Number(seats) >= capacity}
            />
            <p className="mt-1 text-center text-[12px] text-charcoal/50">{t('maxFor')} {capacity} {vehicleLabel(vehicleType)}</p>
          </div>

          {rideType === 'shared' && (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-charcoal/60">{t('womenCountLabel')}</p>
              <Stepper
                value={womenCount}
                onMinus={() => setWomenCount(Math.max(0, Number(womenCount) - 1))}
                onPlus={() => setWomenCount(Math.min(maxWomen, Number(womenCount) + 1))}
                minusDisabled={Number(womenCount) <= 0}
                plusDisabled={Number(womenCount) >= maxWomen}
              />
              <p className="mt-1 text-center text-[12px] text-charcoal/50">{t('womenCountHint')}</p>
            </div>
          )}
        </SectionCard>

        {rideType === 'reserve' && (
          <SectionCard className="space-y-3">
            <p className="text-[13px] font-semibold text-charcoal/60">{t('pickupTimeLabel')}</p>
            <Segmented
              value={pickupMode}
              onChange={setPickupMode}
              options={[
                { value: 'now', label: t('pickupNow') },
                { value: 'later', label: t('pickupLater') },
              ]}
            />
            {pickupMode === 'later' && (
              <input
                type="time"
                value={pickupTimeInput}
                onChange={(e) => setPickupTimeInput(e.target.value)}
                required
                className={`${inputClass} font-num`}
              />
            )}
          </SectionCard>
        )}

        {(rideType === 'shared' || pickupMode === 'now') && (
          <SectionCard className="space-y-3">
            <p className="text-[13px] font-semibold text-charcoal/60">{t('waitTimeLabel')}</p>
            <Segmented
              value={waitMinutes}
              onChange={setWaitMinutes}
              options={[5, 10, 15].map((m) => ({ value: m, label: `${m} ${t('minutesShort')}` }))}
            />
          </SectionCard>
        )}

        {rideType === 'shared' && pickupStopId && dropStopId && (
          fixedFare ? (
            <div className="rounded-2xl border-2 border-emerald bg-mint px-4 py-3">
              <p className="text-[13px] font-semibold text-emerald-dark">{t('fare')}</p>
              <p className="font-num text-[30px] font-extrabold text-emerald">৳{fixedFare}</p>
              <p className="text-[12px] text-emerald-dark">{t('cannotNegotiate')}</p>
            </div>
          ) : (
            <p className="rounded-xl bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">{t('routeNotAvailable')}</p>
          )
        )}

        {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">{error}</p>}

        <PrimaryButton
          type="submit"
          disabled={loading || (rideType === 'shared' && (!pickupStopId || !dropStopId || !fixedFare))}
        >
          {loading ? t('requesting') : t('findRide')}
        </PrimaryButton>
      </form>
    </Screen>
  )
}