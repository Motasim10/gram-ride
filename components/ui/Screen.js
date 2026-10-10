'use client'
import { usePathname } from 'next/navigation'
import LanguageIcon from '@/components/ui/LanguageIcon'

// These pages draw the language button inside their own header row (next to the bell).
const OWN_HEADER = ['/dashboard', '/passenger', '/driver']

export default function Screen({ children, className = '' }) {
  const pathname = usePathname()
  const showCorner = !OWN_HEADER.includes(pathname)

  return (
    <div
      className={`${showCorner ? 'has-corner' : ''} relative mx-auto min-h-screen w-full max-w-[430px] bg-offwhite px-4 pb-8 pt-4 ${className}`}
    >
      {showCorner && (
        <div className="absolute right-4 top-4 z-10">
          <LanguageIcon />
        </div>
      )}
      {children}
    </div>
  )
}