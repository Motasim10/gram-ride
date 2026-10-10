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
import HeaderActions from '@/components/ui/HeaderActions'
import { IconCar, IconAutoRickshaw } from '@/components/ui/Icons'

const CAPACITY = { cng: 5, auto: 2 }
const BACK_SEATS = { cng: 3, auto: 2 }
const notExpired = (r) => !r.expires_at || new Date(r.expires_at).getTime() > Date.now()

const selectClass = 'tap-target w-full rounded-xl border-2 border-line bg-white px-3 text-[15.5px] font-semibold text-charcoal focus:border-emerald focus:outline-none disabled:opacity-50'
const inputClass = 'tap-target w-full rounded-xl border-2 border-line bg-white px-3 text-[15.5px] font-semibold text-charcoal focus:border-emerald focus:outline-none'
const dangerButtonClass = 'tap-target w-full rounded-2xl border-2 border-danger bg-white text-[15px] font-bold text-danger active:bg-danger/10 disabled:opacity-40'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{label}</span>
      {children}
    </label>
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

function Gauge({ label, value, max }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12.5px] font-semibold text-charcoal/60">
        <span>{label}</span>
        <span className="font-num font-bold text-charcoal">{value}/{max}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-line-soft">
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-amber' : 'bg-emerald'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function StopPair({ fromLabel, from, toLabel, to }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1.5">
        <span className="h-3 w-3 rounded-full bg-emerald" />
        <span className="my-1 w-px flex-1 bg-line" />
        <span className="h-3 w-3 rounded-full bg-amber" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-[12px] text-charcoal/50">{fromLabel}</p>
          <p className="font-bold text-charcoal">{from}</p>
        </div>
        <div>
          <p className="text-[12px] text-charcoal/50">{toLabel}</p>
          <p className="font-bold text-charcoal">{to}</p>
        </div>
      </div>
    </div>
  )
}

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
  const [queueStatus, setQueueStatus] = useState([])
  const myTripChannelRef = useRef(null)
  const profileChannelRef = useRef(null)
  const routeChannelRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('flagged').eq('user_id', user.id).single()
      setIsFlagged(profile?.flagged || false)

      const profileChannel = supabase
        .channel('my-profile-' + user.id + '-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` }, (payload) => {
          setIsFlagged(payload.new.flagged || false)
        })
        .subscribe()
      profileChannelRef.current = profileChannel

      const { data: routeRows } = await supabase.from('routes').select('*').order('id')
      setRoutes(routeRows || [])
      routeChannelRef.current = supabase
        .channel('route-list-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'routes' }, async () => {
          const { data } = await supabase.from('routes').select('*').order('id')
          setRoutes(data || [])
        })
        .subscribe()

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

      await loadReserveRequests(user.id)
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
      if (profileChannelRef.current) supabase.removeChannel(profileChannelRef.current)
      if (routeChannelRef.current) supabase.removeChannel(routeChannelRef.current)
    }
  }, [])

  useEffect(() => {
    negotiatingRideIdRef.current = negotiatingRide ? negotiatingRide.id : null
  }, [negotiatingRide])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && userId) {
        loadReserveRequests()
        supabase.from('profiles').select('flagged').eq('user_id', userId).single()
          .then(({ data }) => setIsFlagged(data?.flagged || false))
      }
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

  useEffect(() => { isActiveDriverRef.current = !!activeTrip && activeTrip.status === 'open' }, [activeTrip?.id, activeTrip?.status])
  useEffect(() => { activeRouteIdRef.current = activeTrip ? Number(activeTrip.route_id) : null }, [activeTrip?.route_id])
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 5000)
    return () => clearInterval(timer)
  }, [])

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
    if (!activeTrip || activeTrip.status !== 'open') { setWaitingPassengers([]); return }
    loadWaitingPassengers(activeTrip.route_id)
  }, [activeTrip?.id, activeTrip?.status])

  useEffect(() => {
    if (!activeTrip || activeTrip.status !== 'open') return
    const timer = setInterval(() => {
      loadRouteQueue(activeTrip.route_id)
      loadWaitingPassengers(activeTrip.route_id)
    }, 5000)
    return () => clearInterval(timer)
  }, [activeTrip?.id, activeTrip?.status])

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

  const loadReserveRequests = async (uid = userId) => {
    const { data: accepted } = await supabase.from('rides').select('*')
      .eq('driver_id', uid).eq('status', 'accepted').eq('ride_type', 'reserve')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    setActiveReserveRide(accepted || null)

    const { data: negotiating } = await supabase.from('rides').select('*')
      .eq('driver_id', uid).eq('status', 'negotiating').eq('ride_type', 'reserve')
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
    const { data, error: rpcError } = await supabase.rpc('route_queue_status', { p_route_id: routeId })
    if (rpcError) { console.error(rpcError); return }
    const rows = data || []
    setQueueStatus(rows)
    setRouteTrips(rows.map((q) => ({ id: q.trip_id })))
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
        .update({ status: 'searching', driver_id: null, expires_at: negotiatingRide.pickup_time ? null : new Date(Date.now() + 10 * 60 * 1000).toISOString() }).eq('id', rideId).eq('driver_id', userId)
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
      .update({ status: 'searching', driver_id: null, trip_id: null, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
      .eq('trip_id', activeTrip.id).eq('status', 'accepted')
    await supabase.from('trips').update({ status: 'cancelled' }).eq('id', activeTrip.id).select()
    setActiveTrip(null)
    setTripPassengers([])
    setWaitingPassengers([])
    setLoading(false)
  }

  const filledSeats = tripPassengers.reduce((sum, r) => sum + r.seats, 0)
  const womenSeats = tripPassengers.reduce((sum, r) => sum + (r.women_seats || 0), 0)
  const backSeats = BACK_SEATS[vehicleType]
  const canFit = (ride) => filledSeats + ride.seats <= capacity && womenSeats + (ride.women_seats || 0) <= backSeats
  const myPos = queueStatus.find((q) => q.trip_id === activeTrip?.id)?.queue_pos ?? 1
  const aheadCanFit = (ride) => queueStatus.some((q) =>
    q.queue_pos < myPos &&
    Number(q.filled_seats) + ride.seats <= CAPACITY[q.vehicle_type] &&
    Number(q.women_seats) + (ride.women_seats || 0) <= BACK_SEATS[q.vehicle_type])
  const visibleWaiting = waitingPassengers.filter((r) => notExpired(r) && !aheadCanFit(r))

  const handleAcceptPassenger = async (ride) => {
    if (filledSeats + ride.seats > capacity) { setError('Not enough seats left for this passenger.'); return }
    if (womenSeats + (ride.women_seats || 0) > backSeats) { setError(t('notEnoughBackSeats')); return }
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

  if (loading && !activeTrip && !negotiatingRide) {
    return <Screen><p className="mt-24 text-center text-charcoal/60">{t('loading')}</p></Screen>
  }

  const routeName = (id) => routes.find((r) => r.id === id)?.name
  const timeLabel = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <Screen>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-charcoal">{t('rideRequestsTitle')}</h1>
        <HeaderActions />
      </div>

      {isFlagged && (
        <div className="mb-4 rounded-2xl border-2 border-danger/40 bg-danger/5 p-4">
          <p className="font-bold text-danger">⚠️ Account Flagged</p>
          <p className="mt-1 text-[13px] text-danger">
            Your account has been flagged by an admin and cannot accept new rides right now. Please contact support.
          </p>
        </div>
      )}
      {error && <p className="mb-4 rounded-xl bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">{error}</p>}

      {/* ---------- Shared route / trip section ---------- */}
      {!activeTrip && (
        <SectionCard className="mb-4 space-y-4">
          <Field label={t('routeLabel')}>
            <select value={selectedRouteId} onChange={(e) => setSelectedRouteId(e.target.value)} className={selectClass}>
              <option value="">{routes.length === 0 ? t('noRoutesYet') : t('selectPlaceholder')}</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-charcoal/60">{t('vehicle')}</p>
            <div className="grid grid-cols-2 gap-3">
              {[['cng', IconCar, t('cng5')], ['auto', IconAutoRickshaw, t('auto2')]].map(([v, Icon, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVehicleType(v)}
                  className={`tap-target flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-[13px] font-bold ${vehicleType === v ? 'border-emerald bg-mint text-emerald' : 'border-line bg-white text-charcoal/70'}`}
                >
                  <Icon size={28} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <PrimaryButton onClick={handleGoOnline} disabled={loading || isFlagged}>{t('goOnline')}</PrimaryButton>
        </SectionCard>
      )}

      {activeTrip && activeTrip.status === 'open' && (
        <div className="mb-4 space-y-4">
          <SectionCard className="border-emerald">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald" />
                <p className="font-bold text-charcoal">{t('onlineOnRoute')}</p>
              </div>
              <Chip tone="green">{t('queuePosition')}: #{queuePosition}</Chip>
            </div>
            <p className="mt-1 text-[16px] font-bold text-emerald">{routeName(activeTrip.route_id)}</p>
            <p className="text-[13px] text-charcoal/60">{vehicleLabel(activeTrip.vehicle_type)}</p>
            <div className="mt-4 space-y-3">
              <Gauge label={t('seatsFilled')} value={filledSeats} max={capacity} />
              {activeTrip.vehicle_type === 'cng' && <Gauge label={t('womenAboard')} value={womenSeats} max={backSeats} />}
            </div>
            <button onClick={handleGoOffline} disabled={loading} className={`${dangerButtonClass} mt-4`}>
              {t('goOffline')}
            </button>
          </SectionCard>

          {tripPassengers.length > 0 && (
            <div>
              <h3 className="mb-2 text-[15px] font-bold text-charcoal">{t('passengersOnBoard')} ({filledSeats}/{capacity})</h3>
              <div className="space-y-2">
                {tripPassengers.map((p) => (
                  <div key={p.id} className="rounded-xl border-2 border-line-soft bg-white p-3">
                    <StopPair fromLabel={t('boardsAt')} from={p.pickup} toLabel={t('getsOffAt')} to={p.destination} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Chip>{p.seats} {t('seats')}</Chip>
                      {p.women_seats > 0 && <Chip tone="amber">{p.women_seats} {t('womenShort')}</Chip>}
                      <Chip tone="green">৳{p.fare}</Chip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-[15px] font-bold text-charcoal">{t('waitingPassengersOnRoute')}</h3>
            {visibleWaiting.length === 0 && (
              <p className="rounded-xl border-2 border-line-soft bg-white px-3 py-4 text-center text-[14px] text-charcoal/50">
                {t('noWaitingPassengers')}
              </p>
            )}
            <div className="space-y-3">
              {visibleWaiting.map((r) => (
                <SectionCard key={r.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <StopPair fromLabel={t('boardsAt')} from={r.pickup} toLabel={t('getsOffAt')} to={r.destination} />
                    </div>
                    <p className="font-num text-[24px] font-extrabold text-emerald">৳{r.fare}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Chip>{r.seats} {t('seats')}</Chip>
                    {r.women_seats > 0 && <Chip tone="amber">{r.women_seats} {t('womenShort')}</Chip>}
                  </div>
                  {!canFit(r) && <p className="text-[13px] font-semibold text-danger">{t('noRoomForThis')}</p>}
                  <PrimaryButton onClick={() => handleAcceptPassenger(r)} disabled={loading || !canFit(r)}>
                    {t('accept')}
                  </PrimaryButton>
                </SectionCard>
              ))}
            </div>
          </div>

          {tripPassengers.length > 0 && (
            <PrimaryButton onClick={handleStartTrip} disabled={loading}>{t('startTrip')}</PrimaryButton>
          )}
        </div>
      )}

      {activeTrip && activeTrip.status === 'in_progress' && (
        <div className="mb-4 space-y-4">
          <SectionCard className="border-emerald">
            <p className="font-bold text-emerald">{t('tripInProgress')}</p>
            <p className="mt-1 text-[14px] text-charcoal/70">
              {routeName(activeTrip.route_id)} · {tripPassengers.length} {t('passengersOnBoard')}
            </p>
          </SectionCard>

          {tripPassengers.map((p) => (
            <SectionCard key={p.id} className="space-y-3">
              <StopPair fromLabel={t('boardsAt')} from={p.pickup} toLabel={t('getsOffAt')} to={p.destination} />
              <p className="font-num text-[24px] font-extrabold text-emerald">৳{p.fare}</p>
              {confirmingRideId === p.id ? (
                <div className="space-y-2">
                  <p className="text-[14px] font-semibold text-charcoal">{t('confirmCashFrom')} ৳{p.fare}?</p>
                  <PrimaryButton onClick={() => handleConfirmCash(p)} disabled={loading}>
                    {t('yesReceived')}{p.fare}
                  </PrimaryButton>
                  <PrimaryButton tone="outline" onClick={() => setConfirmingRideId(null)} disabled={loading}>
                    {t('noGoBack')}
                  </PrimaryButton>
                </div>
              ) : (
                <PrimaryButton tone="amber" onClick={() => setConfirmingRideId(p.id)}>{t('confirmCashFrom')}</PrimaryButton>
              )}
            </SectionCard>
          ))}

          {tripPassengers.length === 0 && (
            <p className="rounded-xl border-2 border-emerald/40 bg-mint px-4 py-3 font-semibold text-emerald-dark">
              {t('allPassengersSettled')}
            </p>
          )}

          <PrimaryButton onClick={handleFinishTrip} disabled={loading || tripPassengers.length > 0}>
            {t('finishTrip')}
          </PrimaryButton>
        </div>
      )}

      {/* ---------- Reserve section ---------- */}
      {activeReserveRide && (
        <SectionCard className="mb-4 space-y-3 border-emerald">
          <p className="font-bold text-emerald">{t('yourActiveRide')}</p>
          <StopPair fromLabel={t('from')} from={activeReserveRide.pickup} toLabel={t('to')} to={activeReserveRide.destination} />
          <p className="text-[14px] text-charcoal/60">
            {t('fare')}: <span className="font-num text-[22px] font-extrabold text-emerald">৳{activeReserveRide.fare}</span>
          </p>

          {!confirmingReserveComplete ? (
            <PrimaryButton onClick={() => setConfirmingReserveComplete(true)}>{t('completeTrip')}</PrimaryButton>
          ) : (
            <div className="space-y-2">
              <p className="text-[14px] font-semibold text-charcoal">{t('didYouReceive')}{activeReserveRide.fare} {t('inCash')}</p>
              <PrimaryButton onClick={handleCompleteReserve} disabled={loading}>
                {t('yesReceived')}{activeReserveRide.fare}
              </PrimaryButton>
              <PrimaryButton tone="outline" onClick={() => setConfirmingReserveComplete(false)} disabled={loading}>
                {t('noGoBack')}
              </PrimaryButton>
            </div>
          )}
        </SectionCard>
      )}

      <h2 className="mb-3 mt-6 text-[18px] font-bold text-charcoal">{t('reserveRequestsTitle')}</h2>

      {negotiatingRide ? (
        <SectionCard className="space-y-3">
          <StopPair fromLabel={t('from')} from={negotiatingRide.pickup} toLabel={t('to')} to={negotiatingRide.destination} />
          <div className="flex flex-wrap gap-2">
            <Chip>{negotiatingRide.seats} {t('seats')}</Chip>
            {negotiatingRide.pickup_time && <Chip tone="amber">{t('pickupAt')}: {timeLabel(negotiatingRide.pickup_time)}</Chip>}
          </div>

          {bids.length === 1 && (
            <>
              <div>
                <p className="text-[13px] font-semibold text-charcoal/60">{t('youQuoted')}</p>
                <p className="font-num text-[32px] font-extrabold text-charcoal">৳{latestBid.amount}</p>
              </div>
              <p className="text-[14px] text-charcoal/60">{t('waitingForPassengerResponse')}</p>
            </>
          )}

          {bids.length === 2 && (
            <>
              <div>
                <p className="text-[13px] font-semibold text-charcoal/60">{t('passengerCountered')}</p>
                <p className="font-num text-[32px] font-extrabold text-emerald">৳{latestBid.amount}</p>
              </div>
              <PrimaryButton onClick={handleAcceptCounter} disabled={loading}>
                {t('accept')} ৳{latestBid.amount}
              </PrimaryButton>
              <input
                type="number"
                inputMode="numeric"
                placeholder={t('yourFinalOffer')}
                value={finalOfferAmount}
                onChange={(e) => setFinalOfferAmount(e.target.value)}
                className={`${inputClass} font-num`}
              />
              <PrimaryButton tone="outline" onClick={handleSendFinalOffer} disabled={loading}>
                {t('sendFinalOffer')}
              </PrimaryButton>
              <button onClick={handleRejectCounter} disabled={loading} className="w-full py-2 text-[14px] font-semibold text-charcoal/50 underline">
                {t('notInterestedRelease')}
              </button>
            </>
          )}

          {bids.length >= 3 && (
            <>
              <div>
                <p className="text-[13px] font-semibold text-charcoal/60">{t('youSentFinalOffer')}</p>
                <p className="font-num text-[32px] font-extrabold text-charcoal">৳{latestBid.amount}</p>
              </div>
              <p className="text-[14px] text-charcoal/60">{t('waitingForPassengerDecision')}</p>
            </>
          )}
        </SectionCard>
      ) : (
        <>
          {reserveRequests.filter(notExpired).length === 0 && (
            <p className="rounded-xl border-2 border-line-soft bg-white px-3 py-4 text-center text-[14px] text-charcoal/50">
              {t('noRequestsWaiting')}
            </p>
          )}
          <div className="space-y-3">
            {reserveRequests.filter(notExpired).map((r) => (
              <SectionCard key={r.id} className="space-y-3">
                <StopPair fromLabel={t('from')} from={r.pickup} toLabel={t('to')} to={r.destination} />
                <div className="flex flex-wrap gap-2">
                  <Chip>{r.seats} {t('seats')}</Chip>
                  <Chip tone="amber">{t('pickupAt')}: {r.pickup_time ? timeLabel(r.pickup_time) : t('pickupNow')}</Chip>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder={t('yourFareQuote')}
                  value={quoteInputs[r.id] || ''}
                  onChange={(e) => setQuoteInputs((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className={`${inputClass} font-num`}
                />
                <PrimaryButton onClick={() => handleSendQuote(r)} disabled={loading}>{t('sendQuote')}</PrimaryButton>
              </SectionCard>
            ))}
          </div>
        </>
      )}
    </Screen>
  )
}