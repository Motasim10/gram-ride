'use client'
import { useLanguage } from '@/lib/i18n'
import { IconGlobe } from '@/components/ui/Icons'

export default function LanguageIcon() {
  const { lang, toggleLang, mounted } = useLanguage()

  if (!mounted) return null

  return (
    <button
      onClick={toggleLang}
      aria-label={lang === 'bn' ? 'Switch to English' : 'বাংলায় পরিবর্তন করুন'}
      className="flex h-10 items-center gap-1 rounded-full bg-mint px-3 text-[12px] font-extrabold text-emerald active:bg-emerald active:text-white"
    >
      <IconGlobe size={16} />
      {lang === 'bn' ? 'EN' : 'বাং'}
    </button>
  )
}