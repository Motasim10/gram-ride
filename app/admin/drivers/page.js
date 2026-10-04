'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Tabs, SearchBox, Panel, StatusBadge } from '@/components/admin/AdminUI'
import { IconStar } from '@/components/admin/Icons'

export default function AdminDriversPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState([])
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

      await loadDrivers()
      setLoading(false)
    }
    load()
  }, [])

  const loadDrivers = async () => {
    const { data: driverProfiles } = await supabase.from('profiles').select('*').eq('role', 'driver').order('created_at', { ascending: false })

    const withStats = await Promise.all((driverProfiles || []).map(async (d) => {
      const { data: rides } = await supabase.from('rides').select('fare').eq('driver_id', d.user_id).eq('status', 'completed')
      const { data: ratings } = await supabase.from('ratings').select('stars').eq('driver_id', d.user_id)
      const totalEarnings = (rides || []).reduce((sum, r) => sum + (r.fare || 0), 0)
      const avgRating = ratings && ratings.length > 0 ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1) : null
      return { ...d, tripCount: (rides || []).length, totalEarnings, avgRating }
    }))

    setDrivers(withStats)
  }

  const toggleFlag = async (driver) => {
    await supabase.from('profiles').update({ flagged: !driver.flagged }).eq('user_id', driver.user_id)
    setDrivers((prev) => prev.map((d) => (d.user_id === driver.user_id ? { ...d, flagged: !d.flagged } : d)))
  }

  const filtered = drivers.filter((d) => {
    const matchesTab = tab === 'all' ? true : tab === 'flagged' ? d.flagged : !d.flagged
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || (d.name || '').toLowerCase().includes(q) || (d.phone || '').includes(q)
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
            { value: 'all', label: 'All', count: drivers.length },
            { value: 'active', label: 'Active', count: drivers.filter((d) => !d.flagged).length },
            { value: 'flagged', label: 'Flagged', count: drivers.filter((d) => d.flagged).length },
          ]}
        />
        <SearchBox value={query} onChange={setQuery} placeholder="Search by name or phone" />
      </div>

      <Panel flush>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-line-soft text-[12px] font-bold text-charcoal/45">
                <th className="px-5 py-3">Driver</th>
                <th className="px-5 py-3">Area</th>
                <th className="px-5 py-3">Trips</th>
                <th className="px-5 py-3">Earnings</th>
                <th className="px-5 py-3">Rating</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.user_id} className="border-b border-line-soft last:border-0">
                  <td className="px-5 py-3">
                    <p className="text-[13.5px] font-bold text-charcoal">{d.name}</p>
                    <p className="font-num text-[12px] font-semibold text-charcoal/45">{d.phone}</p>
                  </td>
                  <td className="px-5 py-3 text-[13px] font-semibold text-charcoal/70">{d.area || '—'}</td>
                  <td className="px-5 py-3 font-num text-[13px] font-semibold text-charcoal/70">{d.tripCount}</td>
                  <td className="px-5 py-3 font-num text-[13px] font-extrabold text-emerald-dark">৳{d.totalEarnings}</td>
                  <td className="px-5 py-3">
                    {d.avgRating ? (
                      <span className="flex items-center gap-1 font-num text-[13px] font-bold text-amber-dark">
                        <IconStar size={12} className="fill-amber text-amber" />{d.avgRating}
                      </span>
                    ) : (
                      <span className="text-[13px] text-charcoal/30">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge tone={d.flagged ? 'red' : 'emerald'}>{d.flagged ? 'Flagged' : 'Active'}</StatusBadge>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleFlag(d)}
                      className={`text-[12.5px] font-bold ${d.flagged ? 'text-emerald' : 'text-danger'}`}
                    >
                      {d.flagged ? 'Unflag' : 'Flag'}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-5 py-10 text-center text-[13px] font-semibold text-charcoal/40">
                    {drivers.length === 0 ? 'No drivers registered yet.' : 'No results found.'}
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