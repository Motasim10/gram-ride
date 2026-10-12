'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Panel } from '@/components/admin/AdminUI'

const inputClass = 'rounded-lg border-2 border-line-soft bg-white px-2.5 py-1.5 text-[13px] font-semibold text-charcoal focus:border-emerald focus:outline-none'

const clock = (totalMinutes) => {
  const m = ((totalMinutes % 1440) + 1440) % 1440
  const h24 = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2, '0')
  return `${h24 % 12 || 12}:${mm} ${h24 >= 12 ? 'PM' : 'AM'}`
}

export default function AdminRideRulesPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [before, setBefore] = useState('60')
  const [after, setAfter] = useState('60')
  const [maxRides, setMaxRides] = useState('3')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      const { data } = await supabase.from('settings').select('key, value')
        .in('key', ['reserve_buffer_before_min', 'reserve_buffer_after_min', 'reserve_max_rides'])
      const map = {}
      ;(data || []).forEach((s) => { map[s.key] = s.value })
      setBefore(map.reserve_buffer_before_min ?? '60')
      setAfter(map.reserve_buffer_after_min ?? '60')
      setMaxRides(map.reserve_max_rides ?? '3')
      setLoading(false)
    }
    load()
  }, [])

  const save = async () => {
    const b = Number(before)
    const a = Number(after)
    const m = Number(maxRides)
    if ([before, after, maxRides].some((v) => String(v).trim() === '')) { setNotice('Please fill all three boxes.'); return }
    if (!Number.isInteger(b) || b < 0 || b > 720 || !Number.isInteger(a) || a < 0 || a > 720) {
      setNotice('Minutes must be whole numbers from 0 to 720.'); return
    }
    if (!Number.isInteger(m) || m < 1 || m > 10) { setNotice('Maximum rides must be a whole number from 1 to 10.'); return }
    setSaving(true)
    for (const [key, value] of [['reserve_buffer_before_min', b], ['reserve_buffer_after_min', a], ['reserve_max_rides', m]]) {
      const { error } = await supabase.from('settings').update({ value: String(value) }).eq('key', key)
      if (error) { setNotice('Could not save: ' + error.message); setSaving(false); return }
    }
    setNotice('Saved. The new rules apply immediately.')
    setSaving(false)
  }

  if (loading) return <p className="mt-16 text-center text-charcoal/60">Loading...</p>
  if (!authorized) return null

  const b = Number(before) || 0
  const a = Number(after) || 0
  const noon = 12 * 60

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-[13px] text-charcoal/55">
        When a driver accepts a reserve ride, he cannot see or take any other ride whose pickup time falls
        inside a window around it. Rides outside the window stay visible. Going online is also blocked
        while the current time is inside the window.
      </p>

      {notice && (
        <p className="flex items-center justify-between gap-3 rounded-xl border-2 border-emerald/30 bg-mint px-4 py-3 text-[13px] font-semibold text-emerald-dark">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-[12px] font-bold underline">Dismiss</button>
        </p>
      )}

      <Panel title="Reserve ride rules">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-bold text-charcoal/55">Hide rides this many minutes BEFORE</span>
            <input type="number" value={before} onChange={(e) => setBefore(e.target.value)} className={`${inputClass} w-28 font-num`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-bold text-charcoal/55">Hide rides this many minutes AFTER</span>
            <input type="number" value={after} onChange={(e) => setAfter(e.target.value)} className={`${inputClass} w-28 font-num`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-bold text-charcoal/55">Most reserve rides at once</span>
            <input type="number" value={maxRides} onChange={(e) => setMaxRides(e.target.value)} className={`${inputClass} w-28 font-num`} />
          </label>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-emerald px-5 py-2.5 text-[13px] font-bold text-white active:bg-emerald-dark disabled:opacity-50"
          >
            Save
          </button>
        </div>

        <div className="mt-5 rounded-xl bg-offwhite px-4 py-3 text-[13px] text-charcoal/70">
          <p className="font-bold text-charcoal">Example</p>
          <p className="mt-1">
            A driver has a ride booked at <span className="font-num font-bold">12:00 PM</span>. Rides with a pickup time
            between <span className="font-num font-bold">{clock(noon - b)}</span> and{' '}
            <span className="font-num font-bold">{clock(noon + a)}</span> are hidden from him.
            A ride at exactly {clock(noon - b)} or {clock(noon + a)}, or any time outside, stays visible.
          </p>
        </div>
      </Panel>
    </div>
  )
}