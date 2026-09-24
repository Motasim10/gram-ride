'use client'
import { useLanguage } from './i18n'

export default function LanguageToggle() {
  const { lang, toggleLang, mounted } = useLanguage()

  if (!mounted) return null

  return (
    <button
      onClick={toggleLang}
      style={{
        position: 'fixed', top: 12, right: 12, padding: '6px 14px', borderRadius: 20,
        border: '1px solid #ccc', background: '#fff', fontSize: 13, zIndex: 1000, cursor: 'pointer',
      }}
    >
      {lang === 'bn' ? 'English' : 'বাংলা'}
    </button>
  )
}