'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      setProfile(data)

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
      setUnreadCount(count || 0)

      const channel = supabase
        .channel('dash-notif-' + user.id + '-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
          setUnreadCount((c) => c + 1)
        })
        .subscribe()

      return () => supabase.removeChannel(channel)
    }
    load()
  }, [])

  if (!profile) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{t('welcome')}, {profile.name}! 🎉</h1>
        <Link href="/notifications" style={{ textDecoration: 'none', position: 'relative', fontSize: 24 }}>
          🔔
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -8, background: 'red', color: 'white', borderRadius: '50%', fontSize: 11, padding: '1px 5px' }}>
              {unreadCount}
            </span>
          )}
        </Link>
      </div>
      <p>{t('loggedInAs')} {t(profile.role)}.</p>
      {profile.role === 'passenger' ? (
        <Link href="/passenger"><button style={{ padding: 10, width: '100%', marginTop: 12 }}>{t('requestRide')}</button></Link>
      ) : (
        <>
          <Link href="/driver"><button style={{ padding: 10, width: '100%', marginTop: 12 }}>{t('viewRequests')}</button></Link>
          <Link href="/wallet"><button style={{ padding: 10, width: '100%', marginTop: 12 }}>{t('walletStats')}</button></Link>
        </>
      )}
      <Link href="/history"><button style={{ padding: 10, width: '100%', marginTop: 12 }}>{t('tripHistory')}</button></Link>
      <Link href="/complaints"><button style={{ padding: 10, width: '100%', marginTop: 12 }}>{t('complaints')}</button></Link>
    </div>
  )
}