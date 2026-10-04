'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'
import Screen from '@/components/ui/Screen'
import PrimaryButton from '@/components/ui/PrimaryButton'
import SectionCard from '@/components/ui/SectionCard'

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

  if (loading) return <Screen><p className="mt-24 text-center text-charcoal/60">{t('loading')}</p></Screen>

  return (
    <Screen>
      <h1 className="mb-5 text-[22px] font-bold text-charcoal">{t('myProfile')}</h1>

      <div className="mb-5 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-mint text-2xl font-bold text-emerald">
          {(profile.name || '?').trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xl font-bold text-charcoal">{profile.name}</p>
          <span className="mt-1 inline-block rounded-full bg-mint px-3 py-1 text-[12px] font-bold text-emerald">{t(profile.role)}</span>
        </div>
      </div>

      <SectionCard className="mb-4 space-y-4">
        <div>
          <p className="text-[13px] font-semibold text-charcoal/60">{t('phone')}</p>
          <p className="font-num text-[17px] font-bold text-charcoal">{profile.phone}</p>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-charcoal/60">{t('currentRole')}</p>
          <p className="font-bold text-charcoal">{t(profile.role)}</p>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-charcoal/60">{t('areaLabel')}</span>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="tap-target w-full rounded-xl border-2 border-line bg-white px-3 text-[15.5px] font-semibold text-charcoal focus:border-emerald focus:outline-none"
          />
        </label>
        <PrimaryButton onClick={handleSaveArea} disabled={saving}>
          {saved ? `✓ ${t('changesSaved')}` : t('saveChanges')}
        </PrimaryButton>
      </SectionCard>

      <div className="space-y-3">
        <PrimaryButton tone="outline" onClick={handleSwitchRole}>
          {profile.role === 'passenger' ? t('switchToDriver') : t('switchToPassenger')}
        </PrimaryButton>
        <button
          onClick={handleLogout}
          className="tap-target w-full rounded-2xl border-2 border-danger bg-white text-[15px] font-bold text-danger active:bg-danger/10"
        >
          {t('logout')}
        </button>
      </div>
    </Screen>
  )
}