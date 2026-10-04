'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'
import Screen from '@/components/ui/Screen'
import SectionCard from '@/components/ui/SectionCard'

export default function WalletPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [totalTrips, setTotalTrips] = useState(0)
  const [avgRating, setAvgRating] = useState(null)
  const [ratingCount, setRatingCount] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: trips } = await supabase
        .from('rides')
        .select('fare')
        .eq('driver_id', user.id)
        .eq('status', 'completed')

      const total = (trips || []).reduce((sum, t) => sum + (t.fare || 0), 0)
      setTotalEarnings(total)
      setTotalTrips((trips || []).length)

      const { data: ratings } = await supabase
        .from('ratings')
        .select('stars')
        .eq('driver_id', user.id)

      if (ratings && ratings.length > 0) {
        const avg = ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length
        setAvgRating(avg.toFixed(1))
        setRatingCount(ratings.length)
      }

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Screen><p className="mt-24 text-center text-charcoal/60">{t('loading')}</p></Screen>

  return (
    <Screen>
      <h1 className="mb-5 text-[22px] font-bold text-charcoal">{t('walletStatsTitle')}</h1>

      <div className="mb-4 rounded-2xl bg-emerald p-5 text-white">
        <p className="text-[13px] font-semibold text-white/80">{t('totalEarnings')}</p>
        <p className="font-num text-[40px] font-extrabold leading-tight">৳{totalEarnings}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SectionCard>
          <p className="text-[12.5px] font-semibold text-charcoal/60">{t('totalTrips')}</p>
          <p className="font-num text-[28px] font-extrabold text-charcoal">{totalTrips}</p>
        </SectionCard>
        <SectionCard>
          <p className="text-[12.5px] font-semibold text-charcoal/60">{t('rating')}</p>
          {avgRating ? (
            <>
              <p className="font-num text-[28px] font-extrabold text-charcoal">
                <span className="text-amber">★</span> {avgRating}
              </p>
              <p className="text-[11.5px] text-charcoal/50">({ratingCount} {t('ratingsCount')})</p>
            </>
          ) : (
            <p className="mt-1 text-[15px] font-bold text-charcoal/50">{t('noRatingsYet')}</p>
          )}
        </SectionCard>
      </div>

      <p className="mt-6 text-center text-[13px] text-charcoal/50">{t('walletNote')}</p>
    </Screen>
  )
}