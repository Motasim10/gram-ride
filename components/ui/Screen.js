import LanguageIcon from '@/components/ui/LanguageIcon'

export default function Screen({ children, className = '' }) {
  return (
    <div className={`screen-root relative mx-auto min-h-screen w-full max-w-[430px] bg-offwhite px-4 pb-8 pt-4 ${className}`}>
      <div className="absolute right-4 top-4 z-10">
        <LanguageIcon />
      </div>
      {children}
    </div>
  )
}