'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'
import Screen from '@/components/ui/Screen'
import SectionCard from '@/components/ui/SectionCard'
import { IconClock } from '@/components/ui/Icons'
import { stopText, money, num, formatDate } from '@/lib/names'

const chipClass = 'inline-flex items-center rounded-full border border-line-soft bg-offwhite px-2.5 py-1 text-[12px] font-bold text-charcoal/70'

export default function HistoryPage() {
  const { t, lang } = useLanguage()
  const typeLabel = (rt) => (rt === 'reserve' ? t('reserve') : t('shared'))
  const vehicleLabel = (v) => (v === 'auto' ? t('auto2') : t('cng5'))
  const [trips, setTrips] = useState([])
  const [stopsByRoute, setStopsByRoute] = useState({})
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('rides')
        .select('*')
        .or(`passenger_id.eq.${user.id},driver_id.eq.${user.id}`)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })

      const { data: stopRows } = await supabase.from('route_stops').select('*')
      const stops = {}
      ;(stopRows || []).forEach((s) => { (stops[s.route_id] = stops[s.route_id] || []).push(s) })
      setStopsByRoute(stops)
      setTrips(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const totalFare = trips.reduce((sum, r) => sum + (r.fare || 0), 0)

  if (loading) return <Screen><p className="mt-24 text-center text-charcoal/60">{t('loading')}</p></Screen>

  return (
    <Screen>
      <h1 className="mb-5 text-[22px] font-bold text-charcoal">{t('tripHistoryTitle')}</h1>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <SectionCard>
          <p className="text-[12.5px] font-semibold text-charcoal/60">{t('totalTrips')}</p>
          <p className="font-num text-[30px] font-extrabold text-charcoal">{num(trips.length, lang)}</p>
        </SectionCard>
        <SectionCard>
          <p className="text-[12.5px] font-semibold text-charcoal/60">{t('fare')}</p>
          <p className="font-num text-[30px] font-extrabold text-emerald">{money(totalFare, lang)}</p>
        </SectionCard>
      </div>

      {trips.length === 0 && (
        <SectionCard className="py-10 text-center">
          <IconClock size={40} className="mx-auto mb-2 text-charcoal/30" />
          <p className="text-[14px] text-charcoal/50">{t('noCompletedTrips')}</p>
        </SectionCard>
      )}

      <div className="space-y-3">
        {trips.map((ride) => (
          <SectionCard key={ride.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-charcoal">{stopText(stopsByRoute[ride.route_id], ride.pickup, lang)} → {stopText(stopsByRoute[ride.route_id], ride.destination, lang)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={chipClass}>{typeLabel(ride.ride_type)}</span>
                  <span className={chipClass}>{vehicleLabel(ride.vehicle_type)}</span>
                  <span className={chipClass}>{formatDate(ride.created_at, lang)}</span>
                </div>
              </div>
              <p className="font-num text-[22px] font-extrabold text-emerald">{money(ride.fare, lang)}</p>
            </div>
          </SectionCard>
        ))}
      </div>
    </Screen>
  )
}