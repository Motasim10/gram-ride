'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import Screen from '@/components/ui/Screen'
import SectionCard from '@/components/ui/SectionCard'

const HOTLINE_NUMBER = '01700-000000' // TODO: replace with your real support number

export default function HelpPage() {
  const [openIndex, setOpenIndex] = useState(null)
  const { t } = useLanguage()

  const faqs = [
    { q: t('faq1q'), a: t('faq1a') },
    { q: t('faq2q'), a: t('faq2a') },
    { q: t('faq3q'), a: t('faq3a') },
    { q: t('faq4q'), a: t('faq4a') },
  ]

  return (
    <Screen>
      <h1 className="mb-5 text-[22px] font-bold text-charcoal">{t('helpSupport')}</h1>

      <div className="mb-6 rounded-2xl bg-emerald p-5 text-center text-white">
        <p className="mb-3 text-[14px] font-semibold text-white/90">{t('hotlineTitle')}</p>
        <a
          href={`tel:${HOTLINE_NUMBER}`}
          className="tap-target flex w-full items-center justify-center gap-2 rounded-2xl bg-white font-num text-[18px] font-extrabold text-emerald active:bg-mint"
        >
          📞 {t('hotlineNumber')}
        </a>
      </div>

      <h3 className="mb-3 text-[16px] font-bold text-charcoal">{t('howItWorks')}</h3>
      <SectionCard className="mb-6 space-y-4">
        {[
          { title: t('step1Title'), text: t('step1Text') },
          { title: t('step2Title'), text: t('step2Text') },
          { title: t('step3Title'), text: t('step3Text') },
          { title: t('step4Title'), text: t('step4Text') },
        ].map((s, i) => (
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