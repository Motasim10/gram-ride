'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'
import Screen from '@/components/ui/Screen'
import PrimaryButton from '@/components/ui/PrimaryButton'
import SectionCard from '@/components/ui/SectionCard'

const selectClass = 'tap-target w-full rounded-xl border-2 border-line bg-white px-3 text-[15.5px] font-semibold text-charcoal focus:border-emerald focus:outline-none'

export default function ComplaintsPage() {
  const [userId, setUserId] = useState(null)
  const [trips, setTrips] = useState([])
  const [myComplaints, setMyComplaints] = useState([])
  const [selectedRide, setSelectedRide] = useState('')
  const [category, setCategory] = useState('fare')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: rides } = await supabase
        .from('rides')
        .select('*')
        .or(`passenger_id.eq.${user.id},driver_id.eq.${user.id}`)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
      setTrips(rides || [])
      if (rides && rides.length > 0) setSelectedRide(String(rides[0].id))

      const { data: disputes } = await supabase
        .from('disputes')
        .select('*')
        .eq('filed_by', user.id)
        .order('created_at', { ascending: false })
      setMyComplaints(disputes || [])

      subscribeToMyDisputes(user.id)
      setPageLoading(false)
    }
    load()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

    const channelRef = useRef(null)

  const subscribeToMyDisputes = (uid) => {
    const channel = supabase
      .channel('my-disputes-' + uid + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'disputes', filter: `filed_by=eq.${uid}` }, (payload) => {
        setMyComplaints((prev) => prev.map((c) => (c.id === payload.new.id ? payload.new : c)))
      })
      .subscribe()
    channelRef.current = channel
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedRide) return
    setLoading(true); setError('')

    const ride = trips.find((r) => String(r.id) === selectedRide)
    const against = ride.passenger_id === userId ? ride.driver_id : ride.passenger_id

    const { data, error: insertError } = await supabase.from('disputes').insert({
      ride_id: ride.id,
      filed_by: userId,
      against,
      category,
      description,
      status: 'open',
    }).select().single()

    if (insertError) { setError(insertError.message); setLoading(false); return }

    setMyComplaints((prev) => [data, ...prev])
    setDescription('')
    setSubmitted(true)
    setLoading(false)
  }

  const categoryLabel = (c) => {
    if (c === 'behavior') return t('catBehavior')
    if (c === 'safety') return t('catSafety')
    if (c === 'noshow') return t('catNoShow')
    return t('catFare')
  }

  if (pageLoading) return <Screen><p className="mt-24 text-center text-charcoal/60">{t('loading')}</p></Screen>

  return (
    <Screen>
      <h1 className="mb-5 text-[22px] font-bold text-charcoal">{t('complaints')}</h1>

      <SectionCard className="mb-6">
        <h3 className="mb-3 text-[16px] font-bold text-charcoal">{t('fileAComplaint')}</h3>

        {trips.length === 0 ? (
          <p className="text-[13px] text-charcoal/50">{t('noCompletedTrips')}</p>
        ) : submitted ? (
          <p className="rounded-xl border-2 border-emerald/40 bg-mint px-4 py-3 font-semibold text-emerald-dark">
            ✅ {t('complaintSubmitted')}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{t('selectARide')}</span>
              <select value={selectedRide} onChange={(e) => setSelectedRide(e.target.value)} className={selectClass}>
                {trips.map((r) => (
                  <option key={r.id} value={r.id}>{r.pickup} → {r.destination} (৳{r.fare})</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{t('category')}</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                <option value="fare">{t('catFare')}</option>
                <option value="behavior">{t('catBehavior')}</option>
                <option value="safety">{t('catSafety')}</option>
                <option value="noshow">{t('catNoShow')}</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{t('describeIssue')}</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="min-h-28 w-full rounded-xl border-2 border-line bg-white p-3 text-[15px] font-semibold text-charcoal focus:border-emerald focus:outline-none"
              />
            </label>
            {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">{error}</p>}
            <PrimaryButton type="submit" disabled={loading}>{t('submitComplaint')}</PrimaryButton>
          </form>
        )}
      </SectionCard>

      <h3 className="mb-3 text-[16px] font-bold text-charcoal">{t('myComplaints')}</h3>
      {myComplaints.length === 0 && (
        <p className="rounded-xl border-2 border-line-soft bg-white px-3 py-4 text-center text-[14px] text-charcoal/50">
          {t('noComplaintsYet')}
        </p>
      )}
      <div className="space-y-3">
        {myComplaints.map((c) => (
          <SectionCard key={c.id}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold text-charcoal">{categoryLabel(c.category)}</p>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-bold ${c.status === 'open' ? 'border-danger/40 bg-danger/5 text-danger' : 'border-emerald/40 bg-mint text-emerald'}`}
              >
                {c.status === 'open' ? t('open') : t('resolved')}
              </span>
            </div>
            <p className="mt-2 text-[13.5px] text-charcoal/70">{c.description}</p>
          </SectionCard>
        ))}
      </div>
    </Screen>
  )
}