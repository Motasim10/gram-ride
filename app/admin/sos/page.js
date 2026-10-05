'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Tabs, StatusBadge, EmptyState } from '@/components/admin/AdminUI'
import { IconAlertTriangle, IconShieldCheck } from '@/components/admin/Icons'

export default function AdminSosPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState([])
  const [profileMap, setProfileMap] = useState({})
  const [tab, setTab] = useState('open')
  const router = useRouter()
  const channelRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      await loadAlerts()
      subscribe()
      timerRef.current = setInterval(loadAlerts, 20000)
      setLoading(false)
    }
    load()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const loadAlerts = async () => {
    const { data } = await supabase.from('sos_alerts').select('*').order('created_at', { ascending: false })
    const rows = data || []
    const ids = [...new Set(rows.map((r) => r.user_id))]
    if (ids.length > 0) {
      const { data: people } = await supabase.from('profiles').select('user_id, name, phone').in('user_id', ids)
      const map = {}
      ;(people || []).forEach((p) => { map[p.user_id] = p })
      setProfileMap(map)
    }
    setAlerts(rows)
  }

  const subscribe = () => {
    const channel = supabase
      .channel('admin-sos-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => loadAlerts())
      .subscribe()
    channelRef.current = channel
  }

  const resolveAlert = async (id) => {
    const { error: updateError } = await supabase
      .from('sos_alerts')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id)
    if (updateError) { alert('Could not resolve: ' + updateError.message); return }
    await loadAlerts()
  }

  if (loading) return <p className="mt-16 text-center text-charcoal/60">Loading...</p>
  if (!authorized) return null

  const openAlerts = alerts.filter((a) => a.status !== 'resolved')
  const resolvedAlerts = alerts.filter((a) => a.status === 'resolved')
  const visible = tab === 'open' ? openAlerts : resolvedAlerts

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-charcoal/55">
        New alerts appear here automatically. Call the person, make sure they are safe, then mark the alert resolved.
      </p>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'open', label: 'Open', count: openAlerts.length },
          { value: 'resolved', label: 'Resolved', count: resolvedAlerts.length },
        ]}
      />

      {visible.length === 0 && (
        <EmptyState
          icon={<IconShieldCheck size={28} />}
          text={tab === 'open' ? 'No open alerts. Good.' : 'No resolved alerts yet.'}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visible.map((a) => {
          const person = profileMap[a.user_id]
          const isOpen = a.status !== 'resolved'
          return (
            <div
              key={a.id}
              className={`rounded-2xl border-2 p-4 ${isOpen ? 'border-danger/50 bg-danger/5' : 'border-line-soft bg-white'}`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <IconAlertTriangle size={18} className={`shrink-0 ${isOpen ? 'text-danger' : 'text-charcoal/35'}`} />
                  <p className={`truncate text-[14.5px] font-bold ${isOpen ? 'text-danger-dark' : 'text-charcoal'}`}>
                    {person?.name || a.user_id}
                  </p>
                </div>
                <StatusBadge tone={isOpen ? 'red' : 'emerald'}>{isOpen ? 'Open' : 'Resolved'}</StatusBadge>
              </div>
              {person?.phone ? (
                <a href={`tel:${person.phone}`} className="font-num text-[13px] font-bold text-charcoal">📞 {person.phone}</a>
              ) : (
                <p className="text-[13px] font-semibold text-charcoal/50">No phone number</p>
              )}
              <p className="mt-2 text-[13.5px] text-charcoal/80">{a.details}</p>
              <p className="mt-2 text-[12px] font-semibold text-charcoal/45">
                {a.ride_id ? `Ride #${a.ride_id} · ` : ''}{new Date(a.created_at).toLocaleString()}
              </p>
              {isOpen ? (
                <button
                  onClick={() => resolveAlert(a.id)}
                  className="mt-3 rounded-lg bg-emerald px-4 py-2 text-[12.5px] font-bold text-white active:bg-emerald-dark"
                >
                  Mark resolved
                </button>
              ) : (
                a.resolved_at && (
                  <p className="mt-1 text-[12px] font-semibold text-charcoal/45">Resolved {new Date(a.resolved_at).toLocaleString()}</p>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}