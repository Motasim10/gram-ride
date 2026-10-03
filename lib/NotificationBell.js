'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let channel = null
    let cancelled = false
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
      if (cancelled) return
      setUnreadCount(count || 0)
      channel = supabase
        .channel('bell-' + user.id + '-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
          setUnreadCount((c) => c + 1)
        })
        .subscribe()
    }
    load()
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel) }
  }, [])

  return (
    <Link href="/notifications" style={{ textDecoration: 'none', position: 'relative', fontSize: 24 }}>
      🔔
      {unreadCount > 0 && (
        <span style={{ position: 'absolute', top: -4, right: -8, background: 'red', color: 'white', borderRadius: '50%', fontSize: 11, padding: '1px 5px' }}>
          {unreadCount}
        </span>
      )}
    </Link>
  )
}