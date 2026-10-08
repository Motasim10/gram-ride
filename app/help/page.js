'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useLanguage } from '@/lib/i18n'
import Screen from '@/components/ui/Screen'
import SectionCard from '@/components/ui/SectionCard'
import { IconPhoneCall, IconPlayCircle } from '@/components/ui/Icons'
import { HOTLINE_NUMBER, HELP_VIDEOS } from '@/lib/config'

export default function HelpPage() {
  const [openIndex, setOpenIndex] = useState(null)
  const [role, setRole] = useState(null)
  const { t, lang } = useLanguage()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setRole('passenger'); return }
      const { data } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
      setRole(data?.role === 'driver' ? 'driver' : 'passenger')
    }
    load()
  }, [])

  if (!role) return <Screen><p className="mt-24 text-center text-charcoal/60">{t('loading')}</p></Screen>

  const isDriver = role === 'driver'

  const steps = isDriver
    ? [
        { title: t('drvStep1Title'), text: t('drvStep1Text') },
        { title: t('drvStep2Title'), text: t('drvStep2Text') },
        { title: t('drvStep3Title'), text: t('drvStep3Text') },
        { title: t('drvStep4Title'), text: t('drvStep4Text') },
        { title: t('drvStep5Title'), text: t('drvStep5Text') },
      ]
    : [
        { title: t('step1Title'), text: t('step1Text') },
        { title: t('step2Title'), text: t('step2Text') },
        { title: t('step3Title'), text: t('step3Text') },
        { title: t('step4Title'), text: t('step4Text') },
      ]

  const faqs = isDriver
    ? [
        { q: t('drvFaqFareQ'), a: t('drvFaqFareA') },
        { q: t('drvFaqFeeQ'), a: t('drvFaqFeeA') },
        { q: t('drvFaqNoAcceptQ'), a: t('drvFaqNoAcceptA') },
        { q: t('drvFaqNoPassengersQ'), a: t('drvFaqNoPassengersA') },
        { q: t('faq3q'), a: t('faq3a') },
        { q: t('faqForgotPinQ'), a: t('faqForgotPinA') },
      ]
    : [
        { q: t('faq1q'), a: t('faq1a') },
        { q: t('faq2q'), a: t('faq2a') },
        { q: t('faqSosQ'), a: t('faqSosA') },
        { q: t('faq3q'), a: t('faq3a') },
        { q: t('faq4q'), a: t('faq4a') },
        { q: t('faqForgotPinQ'), a: t('faqForgotPinA') },
      ]

  const videos = (HELP_VIDEOS[role] || []).filter((v) => v.url)

  return (
    <Screen>
      <h1 className="mb-2 text-[22px] font-bold text-charcoal">{t('helpSupport')}</h1>
      <span className="mb-5 inline-block rounded-full bg-mint px-3 py-1 text-[12px] font-bold text-emerald">
        {isDriver ? t('guideForDrivers') : t('guideForPassengers')}
      </span>

      <div className="mb-6 rounded-2xl bg-emerald p-5 text-center text-white">
        <p className="mb-3 text-[14px] font-semibold text-white/90">{t('hotlineTitle')}</p>
        <a
          href={`tel:${HOTLINE_NUMBER}`}
          className="tap-target flex w-full items-center justify-center gap-2 rounded-2xl bg-white font-num text-[18px] font-extrabold text-emerald active:bg-mint"
        >
          <IconPhoneCall size={20} /> {HOTLINE_NUMBER}
        </a>
      </div>

      <h3 className="mb-3 text-[16px] font-bold text-charcoal">{t('howItWorks')}</h3>
      <SectionCard className="mb-6 space-y-4">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald text-[14px] font-bold text-white">
              {i + 1}
            </div>
            <div>
              <p className="text-[14.5px] font-bold text-charcoal">{s.title}</p>
              <p className="mt-0.5 text-[13px] text-charcoal/60">{s.text}</p>
            </div>
          </div>
        ))}
      </SectionCard>

      <h3 className="mb-3 text-[16px] font-bold text-charcoal">{t('videosTitle')}</h3>
      {videos.length === 0 ? (
        <p className="mb-6 rounded-xl border-2 border-line-soft bg-white px-3 py-4 text-center text-[14px] text-charcoal/50">
          {t('videosSoon')}
        </p>
      ) : (
        <div className="mb-6 space-y-2.5">
          {videos.map((v, i) => (
            <a
              key={i}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="tap-target flex w-full items-center gap-3 rounded-xl border-2 border-line bg-white p-2.5 text-left active:bg-mint"
            >
              <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-mint text-emerald">
                <IconPlayCircle size={26} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold leading-snug text-charcoal">{v.title[lang] || v.title.bn}</p>
                {v.duration && <p className="font-num text-[12px] font-semibold text-charcoal/50">{v.duration}</p>}
              </div>
              <span className="shrink-0 text-[12.5px] font-bold text-emerald">{t('watchVideo')}</span>
            </a>
          ))}
        </div>
      )}

      <div className="mb-6 rounded-2xl border-2 border-danger/40 bg-danger/5 p-4 text-center">
        <p className="mb-3 text-[14px] font-semibold text-charcoal">{t('needToComplain')}</p>
        <Link
          href="/complaints"
          className="tap-target flex w-full items-center justify-center rounded-2xl bg-danger text-[15px] font-bold text-white active:bg-danger-dark"
        >
          {t('goToComplaints')}
        </Link>
      </div>

      <h3 className="mb-3 text-[16px] font-bold text-charcoal">{t('faqTitle')}</h3>
      <div className="space-y-2">
        {faqs.map((f, i) => (
          <div key={i} className="overflow-hidden rounded-xl border-2 border-line-soft bg-white">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-[14.5px] font-bold text-charcoal"
            >
              <span>{f.q}</span>
              <span className="text-emerald">{openIndex === i ? '▲' : '▼'}</span>
            </button>
            {openIndex === i && (
              <p className="border-t border-line-soft px-3 py-3 text-[14px] text-charcoal/70">{f.a}</p>
            )}
          </div>
        ))}
      </div>
    </Screen>
  )
}