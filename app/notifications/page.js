'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'
import Screen from '@/components/ui/Screen'
import SectionCard from '@/components/ui/SectionCard'
import { IconBell } from '@/components/ui/Icons'

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

  if (loading) return <Screen><p className="mt-24 text-center text-charcoal/60">{t('loading')}</p></Screen>

  return (
    <Screen>
      <h1 className="mb-5 text-[22px] font-bold text-charcoal">{t('notificationsTitle')}</h1>

      {items.length === 0 && (
        <SectionCard className="py-10 text-center">
          <IconBell size={40} className="mx-auto mb-2 text-charcoal/30" />
          <p className="text-[14px] text-charcoal/50">{t('noNotificationsYet')}</p>
        </SectionCard>
      )}

      <div className="space-y-2">
        {items.map((n) => (
          <div
            key={n.id}
            className={`rounded-xl border-2 p-3 ${n.read ? 'border-line-soft bg-white' : 'border-emerald/40 bg-mint'}`}
          >
            <p className="text-[14.5px] font-semibold text-charcoal">
              {n.msg_key ? tn(n.msg_key, n.msg_params) : n.message}
            </p>
            <p className="mt-1 text-[11.5px] text-charcoal/50">{new Date(n.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </Screen>
  )
}