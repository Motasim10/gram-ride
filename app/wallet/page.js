'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'
import Screen from '@/components/ui/Screen'
import SectionCard from '@/components/ui/SectionCard'

const todayDhaka = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })

export default function WalletPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [totalTrips, setTotalTrips] = useState(0)
  const [avgRating, setAvgRating] = useState(null)
  const [ratingCount, setRatingCount] = useState(0)
  const [balance, setBalance] = useState(null)
  const [days, setDays] = useState([])
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

      const { data: balanceRows } = await supabase.rpc('my_balance')
      setBalance(Array.isArray(balanceRows) ? (balanceRows[0] || null) : balanceRows)

      const { data: dayRows } = await supabase
        .from('driver_day_charges')
        .select('*')
        .eq('driver_id', user.id)
        .order('day', { ascending: false })
        .limit(10)
      setDays(dayRows || [])

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Screen><p className="mt-24 text-center text-charcoal/60">{t('loading')}</p></Screen>

  const todayRow = days.find((c) => c.day === todayDhaka()) || null
  const blocked = !!balance && balance.owed_limit > 0 && balance.outstanding >= balance.owed_limit

  return (
    <Screen>
      <h1 className="mb-5 text-[22px] font-bold text-charcoal">{t('walletStatsTitle')}</h1>

      {balance && (
        <div className={`mb-4 rounded-2xl border-2 p-5 ${blocked ? 'border-danger bg-danger/5' : balance.outstanding > 0 ? 'border-amber/60 bg-amber/10' : 'border-emerald/40 bg-mint'}`}>
          <p className="text-[13px] font-semibold text-charcoal/60">{t('balanceTitle')}</p>
          <p className={`font-num text-[36px] font-extrabold leading-tight ${blocked ? 'text-danger' : 'text-charcoal'}`}>৳{Math.max(0, balance.outstanding)}</p>
          <p className="mt-1 text-[13px] font-semibold text-charcoal/70">
            {blocked ? t('blockedNote') : balance.outstanding > 0 ? t('payBalanceNote') : `✓ ${t('allPaid')}`}
          </p>
        </div>
      )}

      <SectionCard className="mb-4">
        <p className="text-[13px] font-semibold text-charcoal/60">{t('todayTitle')}</p>
        {todayRow ? (
          todayRow.model === 'daily_fee' ? (
            <p className="mt-1 font-bold text-charcoal">{t('todayFee')}: <span className="font-num">৳{todayRow.charge}</span></p>
          ) : (
            <p className="mt-1 font-bold text-charcoal">
              {t('todayCommission')}: <span className="font-num">{todayRow.commission_rate}% × ৳{todayRow.earnings} = ৳{todayRow.charge}</span>
            </p>
          )
        ) : (
          <p className="mt-1 text-[13.5px] text-charcoal/60">{t('notOnlineToday')}</p>
        )}
      </SectionCard>

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

      {days.length > 0 && (
        <>
          <h3 className="mb-2 mt-6 text-[16px] font-bold text-charcoal">{t('recentDays')}</h3>
          <div className="space-y-2">
            {days.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-line-soft bg-white px-3 py-2.5">
                <div>
                  <p className="font-num text-[13px] font-bold text-charcoal">{c.day}</p>
                  <p className="text-[12px] text-charcoal/55">
                    {c.model === 'daily_fee' ? t('dailyFeeTag') : `${t('commissionTag')} ${c.commission_rate}%`}
                  </p>
                </div>
                <p className="font-num text-[16px] font-extrabold text-charcoal">৳{c.charge}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mt-6 text-center text-[13px] text-charcoal/50">{t('walletNote')}</p>
    </Screen>
  )
}