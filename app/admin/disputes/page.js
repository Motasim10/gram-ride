'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Tabs, StatusBadge, EmptyState } from '@/components/admin/AdminUI'
import { IconAlertTriangle } from '@/components/admin/Icons'

export default function AdminDisputesPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [disputes, setDisputes] = useState([])
  const [profileMap, setProfileMap] = useState({})
  const [filter, setFilter] = useState('open')
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      const { data: allProfiles } = await supabase.from('profiles').select('user_id, name')
      const map = {}
      ;(allProfiles || []).forEach((p) => { map[p.user_id] = p.name })
      setProfileMap(map)

      await loadDisputes()
      subscribeToDisputes()
      setLoading(false)
    }
    load()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  const channelRef = useRef(null)

  const loadDisputes = async () => {
    const { data } = await supabase.from('disputes').select('*').order('created_at', { ascending: false })
    setDisputes(data || [])
  }

  const subscribeToDisputes = () => {
    const channel = supabase
      .channel('admin-disputes-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes' }, () => {
        loadDisputes()
      })
      .subscribe()
    channelRef.current = channel
  }

  const resolve = async (id) => {
    await supabase.from('disputes').update({ status: 'resolved' }).eq('id', id)
    setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'resolved' } : d)))
  }

  const nameFor = (id) => (id ? profileMap[id] || id : '—')
  const categoryLabel = (c) => ({ fare: 'Fare Dispute', behavior: 'Behavior', safety: 'Safety', noshow: 'No-show' }[c] || c)

  const visible = disputes.filter((d) => filter === 'all' || d.status === filter)

  if (loading) return <p className="mt-16 text-center text-charcoal/60">Loading...</p>
  if (!authorized) return null

  return (
    <div className="space-y-4">
      <Tabs
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'open', label: 'Open', count: disputes.filter((d) => d.status === 'open').length },
          { value: 'resolved', label: 'Resolved', count: disputes.filter((d) => d.status === 'resolved').length },
          { value: 'all', label: 'All', count: disputes.length },
        ]}
      />

      {visible.length === 0 && <EmptyState icon={<IconAlertTriangle size={28} />} text="Nothing here." />}

      <div className="space-y-3">
        {visible.map((d) => (
          <div key={d.id} className="rounded-2xl border-2 border-line-soft bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="font-num text-[12px] font-bold text-charcoal/40">#{d.id}</p>
                <StatusBadge tone="amber">{categoryLabel(d.category)}</StatusBadge>
                <StatusBadge tone={d.status === 'open' ? 'red' : 'emerald'}>{d.status === 'open' ? 'Open' : 'Resolved'}</StatusBadge>
              </div>
              <p className="text-[11.5px] font-semibold text-charcoal/40">{new Date(d.created_at).toLocaleDateString()}</p>
            </div>
            <p className="mb-2 text-[13.5px] font-semibold leading-relaxed text-charcoal">{d.description}</p>
            <p className="mb-3 text-[12px] font-semibold text-charcoal/50">
              Ride #{d.ride_id} · Filed by: {nameFor(d.filed_by)} · Against: {nameFor(d.against)}
            </p>
            {d.status === 'open' && (
              <button
                onClick={() => resolve(d.id)}
                className="rounded-lg bg-emerald px-4 py-2 text-[12.5px] font-bold text-white active:bg-emerald-dark"
              >
                Mark resolved
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}