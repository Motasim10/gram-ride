'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminSosPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState([])
  const [profileMap, setProfileMap] = useState({})
  const router = useRouter()
  const channelRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      const { data: allProfiles } = await supabase.from('profiles').select('user_id, name, phone')
      const map = {}
      ;(allProfiles || []).forEach((p) => { map[p.user_id] = p })
      setProfileMap(map)

      await loadAlerts()
      subscribe()
      setLoading(false)
    }
    load()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  const loadAlerts = async () => {
    const { data } = await supabase.from('sos_alerts').select('*').order('created_at', { ascending: false })
    setAlerts(data || [])
  }

  const subscribe = () => {
    const channel = supabase
      .channel('admin-sos-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_alerts' }, () => loadAlerts())
      .subscribe()
    channelRef.current = channel
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>
  if (!authorized) return null

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <Link href="/admin">← Back to Dashboard</Link>
      <h1>🆘 SOS Alerts ({alerts.length})</h1>
      {alerts.length === 0 && <p style={{ color: '#888' }}>No alerts. Good.</p>}
      {alerts.map((a) => {
        const person = profileMap[a.user_id]
        return (
          <div key={a.id} style={{ border: '2px solid #c00', background: '#fff5f5', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#c00' }}>{person?.name || a.user_id} — {person?.phone || 'N/A'}</p>
            <p style={{ margin: '4px 0', fontSize: 13 }}>{a.details}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>{new Date(a.created_at).toLocaleString()}</p>
          </div>
        )
      })}
    </div>
  )
}