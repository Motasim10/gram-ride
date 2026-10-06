'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { IconBell } from '@/components/ui/Icons'

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
    <Link
      href="/notifications"
      aria-label="Notifications"
      className="relative flex h-10 w-10 items-center justify-center rounded-full bg-mint text-emerald"
    >
      <IconBell size={20} />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-danger px-1 text-center font-num text-[11px] font-bold leading-[18px] text-white">
          {unreadCount}
        </span>
      )}
    </Link>
  )
}