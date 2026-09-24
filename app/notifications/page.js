'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'

export default function NotificationsPage() {
  const { t, tn } = useLanguage()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setItems(data || [])
      setLoading(false)

      const unreadIds = (data || []).filter((n) => !n.read).map((n) => n.id)
      if (unreadIds.length > 0) {
        await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
      }
    }
    load()
  }, [])

    if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>{t('loading')}</p>

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>{t('notificationsTitle')}</h1>
      {items.length === 0 && <p style={{ color: '#888' }}>{t('noNotificationsYet')}</p>}
      {items.map((n) => (
        <div key={n.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 8, background: n.read ? '#fff' : '#f5f9ff' }}>
          <p style={{ margin: 0 }}>{n.msg_key ? tn(n.msg_key, n.msg_params) : n.message}</p>
          <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>{new Date(n.created_at).toLocaleString()}</p>
        </div>
      ))}
    </div>
  )
}