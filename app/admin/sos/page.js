'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { StatusBadge, EmptyState } from '@/components/admin/AdminUI'
import { IconAlertTriangle, IconShieldCheck } from '@/components/admin/Icons'

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

  if (loading) return <p className="mt-16 text-center text-charcoal/60">Loading...</p>
  if (!authorized) return null

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-charcoal/55">
        New alerts appear here automatically. {alerts.length} total.
      </p>

      {alerts.length === 0 && <EmptyState icon={<IconShieldCheck size={28} />} text="No alerts. Good." />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {alerts.map((a) => {
          const person = profileMap[a.user_id]
          return (
            <div key={a.id} className="rounded-2xl border-2 border-danger/50 bg-danger/5 p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <IconAlertTriangle size={18} className="shrink-0 text-danger" />
                  <p className="truncate text-[14.5px] font-bold text-danger-dark">{person?.name || a.user_id}</p>
                </div>
                <StatusBadge tone="red">SOS</StatusBadge>
              </div>
              {person?.phone ? (
                <a href={`tel:${person.phone}`} className="font-num text-[13px] font-bold text-charcoal">📞 {person.phone}</a>
              ) : (
                <p className="text-[13px] font-semibold text-charcoal/50">No phone number</p>
              )}
              <p className="mt-2 text-[13.5px] text-charcoal/80">{a.details}</p>
              <p className="mt-2 text-[12px] font-semibold text-charcoal/45">{new Date(a.created_at).toLocaleString()}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}