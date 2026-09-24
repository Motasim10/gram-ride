'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'

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

  if (pageLoading) return <p style={{ textAlign: 'center', marginTop: 80 }}>{t('loading')}</p>

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>{t('complaints')}</h1>

      <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>{t('fileAComplaint')}</h3>

        {trips.length === 0 ? (
          <p style={{ color: '#888', fontSize: 13 }}>{t('noCompletedTrips')}</p>
        ) : submitted ? (
          <p style={{ color: 'green' }}>✅ {t('complaintSubmitted')}</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label>{t('selectARide')}</label><br/>
              <select value={selectedRide} onChange={(e) => setSelectedRide(e.target.value)} style={{ width: '100%', padding: 8 }}>
                {trips.map((r) => (
                  <option key={r.id} value={r.id}>{r.pickup} → {r.destination} (৳{r.fare})</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>{t('category')}</label><br/>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: 8 }}>
                <option value="fare">{t('catFare')}</option>
                <option value="behavior">{t('catBehavior')}</option>
                <option value="safety">{t('catSafety')}</option>
                <option value="noshow">{t('catNoShow')}</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>{t('describeIssue')}</label><br/>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} required
                style={{ width: '100%', padding: 8, minHeight: 80 }} />
            </div>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ padding: 10, width: '100%' }}>
              {t('submitComplaint')}
            </button>
          </form>
        )}
      </div>

      <h3>{t('myComplaints')}</h3>
      {myComplaints.length === 0 && <p style={{ color: '#888' }}>{t('noComplaintsYet')}</p>}
      {myComplaints.map((c) => (
        <div key={c.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{categoryLabel(c.category)}</p>
          <p style={{ margin: '4px 0', fontSize: 13, color: '#555' }}>{c.description}</p>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 'bold', color: c.status === 'open' ? '#c00' : 'green' }}>
            {c.status === 'open' ? t('open') : t('resolved')}
          </p>
        </div>
      ))}
    </div>
  )
}