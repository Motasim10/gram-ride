'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>
  if (!authorized) return null

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <Link href="/admin">← Back to Dashboard</Link>
      <h1>Disputes ({disputes.filter((d) => d.status === 'open').length} open)</h1>

      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setFilter('open')} style={{ padding: 8, marginRight: 8, fontWeight: filter === 'open' ? 'bold' : 'normal' }}>Open</button>
        <button onClick={() => setFilter('resolved')} style={{ padding: 8, marginRight: 8, fontWeight: filter === 'resolved' ? 'bold' : 'normal' }}>Resolved</button>
        <button onClick={() => setFilter('all')} style={{ padding: 8, fontWeight: filter === 'all' ? 'bold' : 'normal' }}>All</button>
      </div>

      {visible.length === 0 && <p style={{ color: '#888' }}>Nothing here.</p>}
      {visible.map((d) => (
        <div key={d.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{categoryLabel(d.category)}</p>
          <p style={{ margin: '4px 0', fontSize: 13, color: '#555' }}>{d.description}</p>
          <p style={{ margin: '2px 0', fontSize: 12, color: '#888' }}>
            Filed by: {nameFor(d.filed_by)} · Against: {nameFor(d.against)} · Ride #{d.ride_id}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 'bold', color: d.status === 'open' ? '#c00' : 'green' }}>
              {d.status === 'open' ? 'Open' : 'Resolved'}
            </span>
            {d.status === 'open' && (
              <button onClick={() => resolve(d.id)} style={{ padding: '6px 12px' }}>Mark Resolved</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}