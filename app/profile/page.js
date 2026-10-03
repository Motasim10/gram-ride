'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [area, setArea] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      setProfile(data)
      setArea(data?.area || '')
      setLoading(false)
    }
    load()
  }, [])

  const handleSaveArea = async () => {
    setSaving(true); setSaved(false)
    await supabase.from('profiles').update({ area }).eq('user_id', profile.user_id)
    setProfile((prev) => ({ ...prev, area }))
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSwitchRole = async () => {
    const newRole = profile.role === 'passenger' ? 'driver' : 'passenger'
    await supabase.from('profiles').update({ role: newRole }).eq('user_id', profile.user_id)
    router.push('/dashboard')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>{t('loading')}</p>

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>{t('myProfile')}</h1>

      <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <p style={{ margin: '0 0 4px', fontSize: 13, color: '#888' }}>{t('name')}</p>
        <p style={{ margin: '0 0 12px', fontWeight: 'bold' }}>{profile.name}</p>

        <p style={{ margin: '0 0 4px', fontSize: 13, color: '#888' }}>{t('phone')}</p>
        <p style={{ margin: '0 0 12px', fontWeight: 'bold' }}>{profile.phone}</p>

        <p style={{ margin: '0 0 4px', fontSize: 13, color: '#888' }}>{t('currentRole')}</p>
        <p style={{ margin: '0 0 12px', fontWeight: 'bold' }}>{t(profile.role)}</p>

        <label style={{ fontSize: 13, color: '#888' }}>{t('areaLabel')}</label><br/>
        <input value={area} onChange={(e) => setArea(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8 }} />
        <button onClick={handleSaveArea} disabled={saving} style={{ padding: 10, width: '100%' }}>
          {saved ? t('changesSaved') : t('saveChanges')}
        </button>
      </div>

      <button onClick={handleSwitchRole} style={{ padding: 10, width: '100%', marginBottom: 8 }}>
        {profile.role === 'passenger' ? t('switchToDriver') : t('switchToPassenger')}
      </button>

      <button onClick={handleLogout} style={{ padding: 10, width: '100%', background: 'none', border: '1px solid #c00', color: '#c00' }}>
        {t('logout')}
      </button>
    </div>
  )
}