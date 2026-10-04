export default function SectionCard({ children, className = '' }) {
  return (
    <div className={`bg-white border-2 border-line rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  )
}