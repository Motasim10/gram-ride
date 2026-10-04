export default function Screen({ children, className = '' }) {
  return (
    <div className={`mx-auto min-h-screen w-full max-w-[430px] bg-offwhite px-4 pb-24 pt-16 ${className}`}>
      {children}
    </div>
  )
}