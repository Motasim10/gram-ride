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
import { localName, stopText, money, num, formatTime, formatDate } from '@/lib/names'

const CAPACITY = { cng: 5, auto: 2 }
const BACK_SEATS = { cng: 3, auto: 2 }
// "15 minutes" / "12 hours" (Bangla digits in Bangla)
const durText = (mins, lang) => {
  if (mins >= 60 && mins % 60 === 0) {
    const h = mins / 60
    return `${num(h, lang)} ${lang === 'bn' ? 'ঘণ্টা' : h === 1 ? 'hour' : 'hours'}`
  }
  return `${num(mins, lang)} ${lang === 'bn' ? 'মিনিট' : 'minutes'}`
}
const DEFAULT_RULES = { min_ahead: 15, max_ahead: 720, gap: 15, start_before: 10, auto_cancel: 30, cancel_lock: 15 }

const pickLang = (msg, lang) => {
  if (typeof msg !== 'string' || !msg.includes(' / ')) return msg
  const [bn, ...rest] = msg.split(' / ')
  return lang === 'bn' ? bn : rest.join(' / ')
}

// Time picker: hour + minute + AM/PM, where AM = সকাল and PM = বিকাল
const to24 = (ampm, h) => (ampm === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12))
const defaultDeparture = () => {
  const d = new Date(Date.now() + 30 * 60000)
  let m = Math.ceil(d.getMinutes() / 5) * 5
  if (m === 60) { d.setHours(d.getHours() + 1); m = 0 }
  const h24 = d.getHours()
  return { ampm: h24 < 12 ? 'AM' : 'PM', hour: h24 % 12 || 12, minute: m }
}

const notExpired = (r) => !r.expires_at || new Date(r.expires_at).getTime() > Date.now()
const pickupAt = (r) => new Date(r.pickup_time || r.created_at).getTime()
const sortByPickup = (rows) => [...rows].sort((a, b) => pickupAt(a) - pickupAt(b))

const selectClass = 'tap-target w-full rounded-xl border-2 border-line bg-white px-3 text-[15.5px] font-semibold text-charcoal focus:border-emerald focus:outline-none disabled:opacity-50'
const inputClass = 'tap-target w-full rounded-xl border-2 border-line bg-white px-3 text-[15.5px] font-semibold text-charcoal focus:border-emerald focus:outline-none'
const dangerButtonClass = 'tap-target w-full rounded-2xl border-2 border-danger bg-white text-[15px] font-bold text-danger active:bg-danger/10 disabled:opacity-40'

function TimePicker({ value, onChange, t, lang }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <select value={value.hour} onChange={(e) => onChange({ ...value, hour: Number(e.target.value) })} className={selectClass} aria-label={t('hourLabel')}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{num(h, lang)} {t('hourLabel')}</option>)}
        </select>
        <select value={value.minute} onChange={(e) => onChange({ ...value, minute: Number(e.target.value) })} className={selectClass} aria-label={t('minuteLabel')}>
          {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => <option key={m} value={m}>{num(String(m).padStart(2, '0'), lang)} {t('minuteLabel')}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[['AM', t('pAM')], ['PM', t('pPM')]].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ ...value, ampm: key })}
            className={`tap-target rounded-xl border-2 px-2 text-[14px] font-bold ${value.ampm === key ? 'border-emerald bg-emerald text-white' : 'border-line bg-white text-charcoal/70'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

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

function Gauge({ label, value, max, lang }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12.5px] font-semibold text-charcoal/60">
        <span>{label}</span>
        <span className="font-num font-bold text-charcoal">{num(value, lang)}/{num(max, lang)}</span>
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
  const { t, lang } = useLanguage()
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
  const [stopsByRoute, setStopsByRoute] = useState({})
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [vehicleType, setVehicleType] = useState('cng')
  const [activeTrip, setActiveTrip] = useState(null)
  const [tripPassengers, setTripPassengers] = useState([])
  const [waitingPassengers, setWaitingPassengers] = useState([])
  const [confirmingRideId, setConfirmingRideId] = useState(null)
  const [activeReserveRides, setActiveReserveRides] = useState([])
  const [confirmingReserveId, setConfirmingReserveId] = useState(null)
  const [reserveBlocks, setReserveBlocks] = useState([])
  const [goMode, setGoMode] = useState('now')
  const [dep, setDep] = useState(defaultDeparture)
  const [askReason, setAskReason] = useState(false)
  const [rules, setRules] = useState(DEFAULT_RULES)
  const activeDepartureIdRef = useRef(null)

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

  // Admin can change these numbers at any time, so the page re-reads them regularly
  const loadRules = async () => {
    const { data: ruleRows } = await supabase.rpc('departure_rules')
    if (Array.isArray(ruleRows) && ruleRows[0]) setRules({ ...DEFAULT_RULES, ...ruleRows[0] })
  }

  const loadRouteData = async () => {
    const { data: routeRows } = await supabase.from('routes').select('*').order('id')
    const { data: stopRows } = await supabase.from('route_stops').select('*').order('position')
    const stops = {}
    ;(stopRows || []).forEach((s) => { (stops[s.route_id] = stops[s.route_id] || []).push(s) })
    setRoutes(routeRows || [])
    setStopsByRoute(stops)
  }

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

      await loadRouteData()
      routeChannelRef.current = supabase
        .channel('route-list-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'routes' }, () => loadRouteData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'route_stops' }, () => loadRouteData())
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
      await refreshReserveBlocks()
      await loadRules()
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
        refreshReserveBlocks()
        loadRules()
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
  useEffect(() => { activeDepartureIdRef.current = activeTrip && activeTrip.departure_at ? activeTrip.id : null }, [activeTrip?.id, activeTrip?.departure_at])
  useEffect(() => {
    const timer = setInterval(() => { supabase.rpc('expire_departures').then(() => {}); loadRules() }, 15000)
    const channel = supabase
      .channel('departure-rules-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => loadRules())
      .subscribe()
    return () => { clearInterval(timer); supabase.removeChannel(channel) }
  }, [])
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
    loadWaitingPassengers(activeTrip.route_id, activeTrip)
  }, [activeTrip?.id, activeTrip?.status])

  useEffect(() => {
    if (!activeTrip || activeTrip.status !== 'open') return
    const timer = setInterval(() => {
      loadRouteQueue(activeTrip.route_id)
      loadWaitingPassengers(activeTrip.route_id, activeTrip)
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
    setActiveReserveRides(sortByPickup(accepted || []))

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

  // Time windows around this driver's accepted reserve rides (set by admin in Ride rules)
  const refreshReserveBlocks = async () => {
    const { data } = await supabase.rpc('my_reserve_blocks')
    setReserveBlocks(Array.isArray(data) ? data : [])
  }

  const loadWaitingPassengers = async (routeId, trip) => {
    let q = supabase.from('rides').select('*')
      .eq('status', 'searching').eq('ride_type', 'shared').eq('route_id', routeId)
    // a scheduled departure only sees requests made for it; a go-now driver never sees those
    q = trip && trip.departure_at ? q.eq('requested_trip_id', trip.id) : q.is('requested_trip_id', null)
    const { data } = await q.order('created_at', { ascending: true })
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

  const matchesMyList = (row) => (activeDepartureIdRef.current ? row.requested_trip_id === activeDepartureIdRef.current : row.requested_trip_id == null)

  const subscribeToRideChanges = (uid) => {
    const channel = supabase
      .channel('driver-rides-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides' }, (payload) => {
        const row = payload.new
        if (row.status !== 'searching') return
        if (row.ride_type === 'reserve') {
          setReserveRequests((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]))
        } else if (isActiveDriverRef.current && Number(row.route_id) === activeRouteIdRef.current && matchesMyList(row)) {
          setWaitingPassengers((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' }, (payload) => {
        const row = payload.new
        if (row.driver_id === uid && row.ride_type === 'reserve') refreshReserveBlocks()
        if (row.status !== 'searching') {
          setReserveRequests((prev) => prev.filter((r) => r.id !== row.id))
          setWaitingPassengers((prev) => prev.filter((r) => r.id !== row.id))
        }
        if (row.status === 'searching' && row.ride_type === 'reserve') {
          setReserveRequests((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]))
        }
        if (row.status === 'searching' && row.ride_type === 'shared' && isActiveDriverRef.current && Number(row.route_id) === activeRouteIdRef.current && matchesMyList(row)) {
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
          setActiveReserveRides((prev) => sortByPickup([...prev.filter((r) => r.id !== row.id), row]))
        }
        if (row.ride_type === 'reserve' && row.status !== 'accepted') {
          setActiveReserveRides((prev) => prev.filter((r) => r.id !== row.id))
        }
        if (row.driver_id === uid && row.status === 'cancelled' && row.ride_type === 'reserve') {
          if (negotiatingRideIdRef.current === row.id) setNegotiatingRide(null)
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
  const handleCompleteReserve = async (ride) => {
    setLoading(true)
    const { error: updateError } = await supabase.from('rides').update({ status: 'completed' }).eq('id', ride.id)
    if (updateError) { setError(updateError.message); setLoading(false); return }
    await notify(ride.passenger_id, 'tripComplete', { destination: ride.destination, amount: ride.fare })
    setActiveReserveRides((prev) => prev.filter((r) => r.id !== ride.id))
    setConfirmingReserveId(null)
    await refreshReserveBlocks()
    setLoading(false)
  }

  // ---- Shared trip handlers ----
  const capacity = CAPACITY[vehicleType]

  const handleGoOnline = async () => {
    if (isFlagged) { setError('Your account has been flagged and cannot accept rides right now. Contact support.'); return }
    if (!selectedRouteId) { setError(t('selectRouteFirst')); return }
    let departureIso = null
    if (goMode === 'time' || reserveLocked) {
      const when = new Date()
      when.setHours(to24(dep.ampm, dep.hour), dep.minute, 0, 0)
      if (when.getTime() <= Date.now()) when.setDate(when.getDate() + 1)   // that time tomorrow
      const diffMin = (when.getTime() - Date.now()) / 60000
      if (diffMin < rules.min_ahead || diffMin > rules.max_ahead) { setError({ key: 'departureTimeInvalid' }); return }
      departureIso = when.toISOString()
    }
    setLoading(true); setError('')
    const { data, error: insertError } = await supabase.from('trips').insert({
      driver_id: userId, route_id: Number(selectedRouteId), vehicle_type: vehicleType, status: 'open',
      departure_at: departureIso,
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

  const handleCancelDeparture = async (reason) => {
    setLoading(true); setError('')
    const { error: cancelError } = await supabase.from('trips').update({ status: 'cancelled', cancel_reason: reason }).eq('id', activeTrip.id)
    if (cancelError) { setError(cancelError.message); setLoading(false); return }
    setAskReason(false)
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
  const blockAt = (ms) => {
    const hits = reserveBlocks.filter((b) => ms > new Date(b.start_at).getTime() && ms < new Date(b.end_at).getTime())
    return hits.find((b) => b.kind !== 'departure') || hits[0] || null
  }
  const nowBlock = blockAt(Date.now())
  const reserveLocked = !!nowBlock && nowBlock.kind !== 'departure'
  const reserveLockAt = nowBlock ? nowBlock.ride_at : null
  const visibleWaiting = reserveLocked ? [] : waitingPassengers.filter((r) => notExpired(r) && !aheadCanFit(r))
  const openReserve = reserveRequests.filter(notExpired)
  const shownReserve = openReserve.filter((r) => !blockAt(r.pickup_time ? new Date(r.pickup_time).getTime() : Date.now()))
  const hiddenReserveCount = openReserve.length - shownReserve.length

  const handleAcceptPassenger = async (ride) => {
    if (filledSeats + ride.seats > capacity) { setError('Not enough seats left for this passenger.'); return }
    if (womenSeats + (ride.women_seats || 0) > backSeats) { setError(t('notEnoughBackSeats')); return }
    setLoading(true); setError('')
    const { data, error: updateError } = await supabase.from('rides')
      .update({ driver_id: userId, status: 'accepted', trip_id: activeTrip.id })
      .eq('id', ride.id).eq('status', 'searching').select().maybeSingle()
    if (!data) {
      setError(updateError ? updateError.message : 'This ride is no longer available.')
      if (!updateError) setWaitingPassengers((prev) => prev.filter((r) => r.id !== ride.id))
      setLoading(false)
      return
    }
    await notify(ride.passenger_id, 'rideConfirmedForPassenger', { amount: ride.fare })
    setWaitingPassengers((prev) => prev.filter((r) => r.id !== ride.id))
    setLoading(false)
  }

  const handleStartTrip = async () => {
    setLoading(true); setError('')
    const { error: startError } = await supabase.from('trips').update({ status: 'in_progress' }).eq('id', activeTrip.id)
    if (startError) { setError(startError.message); setLoading(false); return }
    for (const p of tripPassengers) await notify(p.passenger_id, 'tripStarted', {})
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

  const routeName = (id) => localName(routes.find((r) => r.id === id), lang)
  const placeName = (ride, which) =>
    stopText(stopsByRoute[ride.route_id], which === 'pickup' ? ride.pickup : ride.destination, lang)
  const timeLabel = (iso) => formatTime(iso, lang)

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
      {error && <p className="mb-4 rounded-xl bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">{typeof error === 'object' ? t(error.key) : pickLang(error, lang)}</p>}
      {reserveLocked && (
        <div className="mb-4 rounded-2xl border-2 border-amber/60 bg-amber/10 p-4">
          <p className="font-bold text-amber-dark">
            {lang === 'bn'
              ? `আপনার ${formatTime(reserveLockAt, lang)}-এর রিজার্ভ রাইড আছে`
              : `You have a reserve ride at ${formatTime(reserveLockAt, lang)}`}
          </p>
          <p className="mt-1 text-[13px] text-charcoal/70">
            {lang === 'bn'
              ? 'এই রাইডের কাছাকাছি সময়ে নতুন রিকোয়েস্ট দেখা যাবে না।'
              : 'New requests close to that ride are hidden for now.'}
          </p>
        </div>
      )}

      {/* ---------- Shared route / trip section ---------- */}
      {!activeTrip && (
        <SectionCard className="mb-4 space-y-4">
          <Field label={t('routeLabel')}>
            <select value={selectedRouteId} onChange={(e) => setSelectedRouteId(e.target.value)} className={selectClass}>
              <option value="">{routes.length === 0 ? t('noRoutesYet') : t('selectPlaceholder')}</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{localName(r, lang)}</option>)}
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
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-charcoal/60">{t('goNowOrTime')}</p>
            <div className="grid grid-cols-2 gap-3">
              {[['now', t('goNowMode')], ['time', t('setTimeMode')]].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  disabled={reserveLocked && v === 'now'}
                  onClick={() => setGoMode(v)}
                  className={`tap-target rounded-xl border-2 px-2 text-[14px] font-bold disabled:opacity-40 ${(reserveLocked ? 'time' : goMode) === v ? 'border-emerald bg-emerald text-white' : 'border-line bg-white text-charcoal/70'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {reserveLocked && <p className="text-[13px] font-semibold text-amber-dark">{t('reserveLockedPostTime')}</p>}
          {(goMode === 'time' || reserveLocked) && (
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-charcoal/60">{t('departureTimeLabel')}</p>
              <TimePicker value={dep} onChange={setDep} t={t} lang={lang} />
              <span className="mt-1 block text-[12px] text-charcoal/50">
                {lang === 'bn'
                  ? `এখন থেকে ${durText(rules.min_ahead, lang)} থেকে ${durText(rules.max_ahead, lang)}-এর মধ্যে`
                  : `Between ${durText(rules.min_ahead, lang)} and ${durText(rules.max_ahead, lang)} from now`}
              </span>
            </div>
          )}
          <PrimaryButton onClick={handleGoOnline} disabled={loading || isFlagged}>
            {goMode === 'time' || reserveLocked ? t('postDeparture') : t('goOnline')}
          </PrimaryButton>
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
              {activeTrip.departure_at
                ? <Chip tone="amber">{t('leavesAt')}: {timeLabel(activeTrip.departure_at)}</Chip>
                : <Chip tone="green">{t('queuePosition')}: #{num(queuePosition, lang)}</Chip>}
            </div>
            <p className="mt-1 text-[16px] font-bold text-emerald">{routeName(activeTrip.route_id)}</p>
            <p className="text-[13px] text-charcoal/60">{vehicleLabel(activeTrip.vehicle_type)}</p>
            <div className="mt-4 space-y-3">
              <Gauge label={t('seatsFilled')} value={filledSeats} max={capacity} lang={lang} />
              {activeTrip.vehicle_type === 'cng' && <Gauge label={t('womenAboard')} value={womenSeats} max={backSeats} lang={lang} />}
            </div>
            {activeTrip.departure_at && Date.now() > new Date(activeTrip.departure_at).getTime() && (
              <p className="mt-3 rounded-xl bg-amber/15 px-3 py-2 text-[13px] font-semibold text-amber-dark">{t('youAreLate')}</p>
            )}
            {activeTrip.departure_at && rules.auto_cancel > 0 && (
              <p className="mt-3 text-[12.5px] text-charcoal/55">
                {lang === 'bn'
                  ? `ছাড়ার সময়ের ${durText(rules.auto_cancel, lang)} মধ্যে ট্রিপ শুরু না করলে যাত্রাটি নিজে থেকে বাতিল হয়ে যাবে।`
                  : `If the trip is not started within ${durText(rules.auto_cancel, lang)} after the departure time, it is cancelled automatically.`}
              </p>
            )}
            {activeTrip.departure_at ? (
              <>
                {(() => {
                  const cancelLocked = rules.cancel_lock > 0 && Date.now() > new Date(activeTrip.departure_at).getTime() - rules.cancel_lock * 60000
                  if (askReason) {
                    return (
                      <div className="mt-4 space-y-2">
                        <p className="text-[14px] font-semibold text-charcoal">{t('cancelWhy')}</p>
                        {[['breakdown', 'reasonBreakdown'], ['no_passengers', 'reasonNoPassengers'], ['other', 'reasonOther']].map(([key, label]) => (
                          <button key={key} onClick={() => handleCancelDeparture(key)} disabled={loading} className={dangerButtonClass}>
                            {t(label)}
                          </button>
                        ))}
                        <button onClick={() => setAskReason(false)} className="w-full py-2 text-[14px] font-semibold text-charcoal/50 underline">{t('back')}</button>
                      </div>
                    )
                  }
                  return (
                    <>
                      <button onClick={() => setAskReason(true)} disabled={loading || tripPassengers.length > 0 || cancelLocked} className={`${dangerButtonClass} mt-4`}>
                        {t('cancelDeparture')}
                      </button>
                      {tripPassengers.length > 0 && <p className="mt-2 text-[12px] text-charcoal/50">{t('cannotCancelWithPassengers')}</p>}
                      {cancelLocked && tripPassengers.length === 0 && (
                        <p className="mt-2 text-[12px] text-charcoal/50">
                          {lang === 'bn'
                            ? `ছাড়ার ${durText(rules.cancel_lock, lang)} আগের পর যাত্রা বাতিল করা যায় না।`
                            : `A departure cannot be cancelled in the last ${durText(rules.cancel_lock, lang)} before it leaves.`}
                        </p>
                      )}
                    </>
                  )
                })()}
              </>
            ) : (
              <button onClick={handleGoOffline} disabled={loading} className={`${dangerButtonClass} mt-4`}>
                {t('goOffline')}
              </button>
            )}
          </SectionCard>

          {tripPassengers.length > 0 && (
            <div>
              <h3 className="mb-2 text-[15px] font-bold text-charcoal">{t('passengersOnBoard')} ({num(filledSeats, lang)}/{num(capacity, lang)})</h3>
              <div className="space-y-2">
                {tripPassengers.map((p) => (
                  <div key={p.id} className="rounded-xl border-2 border-line-soft bg-white p-3">
                    <StopPair fromLabel={t('boardsAt')} from={placeName(p, 'pickup')} toLabel={t('getsOffAt')} to={placeName(p, 'destination')} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Chip>{num(p.seats, lang)} {t('seats')}</Chip>
                      {p.women_seats > 0 && <Chip tone="amber">{num(p.women_seats, lang)} {t('womenShort')}</Chip>}
                      <Chip tone="green">{money(p.fare, lang)}</Chip>
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
                      <StopPair fromLabel={t('boardsAt')} from={placeName(r, 'pickup')} toLabel={t('getsOffAt')} to={placeName(r, 'destination')} />
                    </div>
                    <p className="font-num text-[24px] font-extrabold text-emerald">{money(r.fare, lang)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Chip>{num(r.seats, lang)} {t('seats')}</Chip>
                    {r.women_seats > 0 && <Chip tone="amber">{num(r.women_seats, lang)} {t('womenShort')}</Chip>}
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
            <>
              <PrimaryButton
                onClick={handleStartTrip}
                disabled={loading || (activeTrip.departure_at && Date.now() < new Date(activeTrip.departure_at).getTime() - rules.start_before * 60000)}
              >
                {t('startTrip')}
              </PrimaryButton>
              {activeTrip.departure_at && Date.now() < new Date(activeTrip.departure_at).getTime() - rules.start_before * 60000 && (
                <p className="text-center text-[12px] text-charcoal/50">
                  {lang === 'bn'
                    ? `ছাড়ার ${durText(rules.start_before, lang)} আগে থেকে ট্রিপ শুরু করা যাবে।`
                    : `You can start the trip from ${durText(rules.start_before, lang)} before departure.`}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {activeTrip && activeTrip.status === 'in_progress' && (
        <div className="mb-4 space-y-4">
          <SectionCard className="border-emerald">
            <p className="font-bold text-emerald">{t('tripInProgress')}</p>
            <p className="mt-1 text-[14px] text-charcoal/70">
              {routeName(activeTrip.route_id)} · {num(tripPassengers.length, lang)} {t('passengersOnBoard')}
            </p>
          </SectionCard>

          {tripPassengers.map((p) => (
            <SectionCard key={p.id} className="space-y-3">
              <StopPair fromLabel={t('boardsAt')} from={placeName(p, 'pickup')} toLabel={t('getsOffAt')} to={placeName(p, 'destination')} />
              <p className="font-num text-[24px] font-extrabold text-emerald">{money(p.fare, lang)}</p>
              {confirmingRideId === p.id ? (
                <div className="space-y-2">
                  <p className="text-[14px] font-semibold text-charcoal">{t('confirmCashFrom')} {money(p.fare, lang)}?</p>
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
      {activeReserveRides.map((ride) => (
        <SectionCard key={ride.id} className="mb-4 space-y-3 border-emerald">
          <div className="flex items-start justify-between gap-3">
            <p className="font-bold text-emerald">{t('yourActiveRide')}</p>
            <Chip tone="amber">
              {ride.pickup_time
                ? `${formatDate(ride.pickup_time, lang)}, ${timeLabel(ride.pickup_time)}`
                : t('pickupNow')}
            </Chip>
          </div>
          <StopPair fromLabel={t('from')} from={placeName(ride, 'pickup')} toLabel={t('to')} to={placeName(ride, 'destination')} />
          <p className="text-[14px] text-charcoal/60">
            {t('fare')}: <span className="font-num text-[22px] font-extrabold text-emerald">{money(ride.fare, lang)}</span>
          </p>

          {confirmingReserveId !== ride.id ? (
            <PrimaryButton onClick={() => setConfirmingReserveId(ride.id)}>{t('completeTrip')}</PrimaryButton>
          ) : (
            <div className="space-y-2">
              <p className="text-[14px] font-semibold text-charcoal">{t('didYouReceive')}{ride.fare} {t('inCash')}</p>
              <PrimaryButton onClick={() => handleCompleteReserve(ride)} disabled={loading}>
                {t('yesReceived')}{ride.fare}
              </PrimaryButton>
              <PrimaryButton tone="outline" onClick={() => setConfirmingReserveId(null)} disabled={loading}>
                {t('noGoBack')}
              </PrimaryButton>
            </div>
          )}
        </SectionCard>
      ))}

      <h2 className="mb-3 mt-6 text-[18px] font-bold text-charcoal">{t('reserveRequestsTitle')}</h2>
      {hiddenReserveCount > 0 && (
        <p className="-mt-1 mb-3 text-[12.5px] font-semibold text-charcoal/55">
          {lang === 'bn'
            ? `${num(hiddenReserveCount, lang)}টি রিকোয়েস্ট আপনার বুক করা রাইডের সময়ের কাছাকাছি, তাই দেখানো হচ্ছে না।`
            : `${hiddenReserveCount} request(s) hidden: too close to your booked ride.`}
        </p>
      )}

      {negotiatingRide ? (
        <SectionCard className="space-y-3">
          <StopPair fromLabel={t('from')} from={placeName(negotiatingRide, 'pickup')} toLabel={t('to')} to={placeName(negotiatingRide, 'destination')} />
          <div className="flex flex-wrap gap-2">
            <Chip>{num(negotiatingRide.seats, lang)} {t('seats')}</Chip>
            {negotiatingRide.pickup_time && <Chip tone="amber">{t('pickupAt')}: {timeLabel(negotiatingRide.pickup_time)}</Chip>}
          </div>

          {bids.length === 1 && (
            <>
              <div>
                <p className="text-[13px] font-semibold text-charcoal/60">{t('youQuoted')}</p>
                <p className="font-num text-[32px] font-extrabold text-charcoal">{money(latestBid.amount, lang)}</p>
              </div>
              <p className="text-[14px] text-charcoal/60">{t('waitingForPassengerResponse')}</p>
            </>
          )}

          {bids.length === 2 && (
            <>
              <div>
                <p className="text-[13px] font-semibold text-charcoal/60">{t('passengerCountered')}</p>
                <p className="font-num text-[32px] font-extrabold text-emerald">{money(latestBid.amount, lang)}</p>
              </div>
              <PrimaryButton onClick={handleAcceptCounter} disabled={loading}>
                {t('accept')} {money(latestBid.amount, lang)}
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
                <p className="font-num text-[32px] font-extrabold text-charcoal">{money(latestBid.amount, lang)}</p>
              </div>
              <p className="text-[14px] text-charcoal/60">{t('waitingForPassengerDecision')}</p>
            </>
          )}
        </SectionCard>
      ) : (
        <>
          {shownReserve.length === 0 && (
            <p className="rounded-xl border-2 border-line-soft bg-white px-3 py-4 text-center text-[14px] text-charcoal/50">
              {t('noRequestsWaiting')}
            </p>
          )}
          <div className="space-y-3">
            {shownReserve.map((r) => (
              <SectionCard key={r.id} className="space-y-3">
                <StopPair fromLabel={t('from')} from={placeName(r, 'pickup')} toLabel={t('to')} to={placeName(r, 'destination')} />
                <div className="flex flex-wrap gap-2">
                  <Chip>{num(r.seats, lang)} {t('seats')}</Chip>
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