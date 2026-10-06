'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Tabs, SearchBox, Panel, StatusBadge } from '@/components/admin/AdminUI'
import ResetPinButton from '@/components/admin/ResetPinButton'

export default function AdminPassengersPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [passengers, setPassengers] = useState([])
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      await loadPassengers()
      setLoading(false)
    }
    load()
  }, [])

  const loadPassengers = async () => {
    const { data: passengerProfiles } = await supabase.from('profiles').select('*').eq('role', 'passenger').order('created_at', { ascending: false })

    const withStats = await Promise.all((passengerProfiles || []).map(async (p) => {
      const { data: rides } = await supabase.from('rides').select('fare').eq('passenger_id', p.user_id).eq('status', 'completed')
      const totalSpent = (rides || []).reduce((sum, r) => sum + (r.fare || 0), 0)
      return { ...p, tripCount: (rides || []).length, totalSpent }
    }))

    setPassengers(withStats)
  }

  const toggleFlag = async (passenger) => {
    await supabase.from('profiles').update({ flagged: !passenger.flagged }).eq('user_id', passenger.user_id)
    setPassengers((prev) => prev.map((p) => (p.user_id === passenger.user_id ? { ...p, flagged: !p.flagged } : p)))
  }

  const filtered = passengers.filter((p) => {
    const matchesTab = tab === 'all' ? true : tab === 'flagged' ? p.flagged : !p.flagged
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || (p.name || '').toLowerCase().includes(q) || (p.phone || '').includes(q)
    return matchesTab && matchesQuery
  })

  if (loading) return <p className="mt-16 text-center text-charcoal/60">Loading...</p>
  if (!authorized) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'all', label: 'All', count: passengers.length },
            { value: 'active', label: 'Active', count: passengers.filter((p) => !p.flagged).length },
            { value: 'flagged', label: 'Flagged', count: passengers.filter((p) => p.flagged).length },
          ]}
        />
        <SearchBox value={query} onChange={setQuery} placeholder="Search by name or phone" />
      </div>

      <Panel flush>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-line-soft text-[12px] font-bold text-charcoal/45">
                <th className="px-5 py-3">Passenger</th>
                <th className="px-5 py-3">Area</th>
                <th className="px-5 py-3">Trips</th>
                <th className="px-5 py-3">Total spent</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.user_id} className="border-b border-line-soft last:border-0">
                  <td className="px-5 py-3">
                    <p className="text-[13.5px] font-bold text-charcoal">{p.name}</p>
                    <p className="font-num text-[12px] font-semibold text-charcoal/45">{p.phone}</p>
                  </td>
                  <td className="px-5 py-3 text-[13px] font-semibold text-charcoal/70">{p.area || '—'}</td>
                  <td className="px-5 py-3 font-num text-[13px] font-semibold text-charcoal/70">{p.tripCount}</td>
                  <td className="px-5 py-3 font-num text-[13px] font-extrabold text-emerald-dark">৳{p.totalSpent}</td>
                  <td className="px-5 py-3">
                    <StatusBadge tone={p.flagged ? 'red' : 'emerald'}>{p.flagged ? 'Flagged' : 'Active'}</StatusBadge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleFlag(p)}
                        className={`text-[12.5px] font-bold ${p.flagged ? 'text-emerald' : 'text-danger'}`}
                      >
                        {p.flagged ? 'Unflag' : 'Flag'}
                      </button>
                      <ResetPinButton userId={p.user_id} name={p.name} />
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-10 text-center text-[13px] font-semibold text-charcoal/40">
                    {passengers.length === 0 ? 'No passengers registered yet.' : 'No results found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}