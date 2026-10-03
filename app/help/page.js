'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'

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
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>{t('helpSupport')}</h1>

      <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, marginBottom: 24, textAlign: 'center' }}>
        <p style={{ margin: '0 0 8px', fontSize: 14 }}>{t('hotlineTitle')}</p>
        <a href={`tel:${HOTLINE_NUMBER}`} style={{ fontSize: 20, fontWeight: 'bold', color: '#0066cc', textDecoration: 'none' }}>
          📞 {t('hotlineNumber')}
        </a>
      </div>

      <h3>{t('howItWorks')}</h3>
      <div style={{ marginBottom: 24 }}>
        {[
          { title: t('step1Title'), text: t('step1Text') },
          { title: t('step2Title'), text: t('step2Text') },
          { title: t('step3Title'), text: t('step3Text') },
          { title: t('step4Title'), text: t('step4Text') },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0066cc', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
              {i + 1}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{s.title}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#555' }}>{s.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid #f5c6c6', background: '#fff5f5', borderRadius: 8, padding: 12, marginBottom: 24, textAlign: 'center' }}>
        <p style={{ margin: '0 0 8px', fontSize: 14 }}>{t('needToComplain')}</p>
        <Link href="/complaints" style={{ display: 'inline-block', padding: '8px 16px', background: '#c00', color: 'white', borderRadius: 6, textDecoration: 'none', fontSize: 14 }}>
          {t('goToComplaints')}
        </Link>
      </div>

      <h3>{t('faqTitle')}</h3>
      {faqs.map((f, i) => (
        <div key={i} style={{ border: '1px solid #eee', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            style={{ width: '100%', textAlign: 'left', padding: 12, background: '#fafafa', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {f.q} {openIndex === i ? '▲' : '▼'}
          </button>
          {openIndex === i && (
            <p style={{ padding: 12, margin: 0, fontSize: 14, color: '#555' }}>{f.a}</p>
          )}
        </div>
      ))}

      <Link href="/dashboard" style={{ display: 'block', textAlign: 'center', marginTop: 24, color: '#888' }}>
        ← {t('backToDashboard')}
      </Link>
    </div>
  )
}