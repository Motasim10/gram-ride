'use client'
import { usePathname } from 'next/navigation'
import { useLanguage } from './i18n'

export default function LanguageToggle() {
  const { lang, toggleLang, mounted } = useLanguage()
  const pathname = usePathname()

  if (!mounted) return null
  if (pathname.startsWith('/admin')) return null

  return (
    <button
      onClick={toggleLang}
      className="fixed right-3 top-3 z-[1000] rounded-full border-2 border-line bg-white px-4 py-1.5 text-[13px] font-bold text-emerald shadow-sm active:bg-mint"
    >
      {lang === 'bn' ? 'English' : 'বাংলা'}
    </button>
  )
}