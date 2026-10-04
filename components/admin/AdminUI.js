import { IconSearch } from '@/components/admin/Icons'

export function StatusBadge({ tone = 'gray', children }) {
  const tones = {
    emerald: 'bg-mint text-emerald-dark border-emerald/30',
    amber: 'bg-amber/15 text-amber-dark border-amber/40',
    red: 'bg-danger/10 text-danger-dark border-danger/30',
    gray: 'bg-offwhite text-charcoal/50 border-line-soft',
  }
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Tabs({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg border-2 px-3.5 py-2 text-[13px] font-bold transition-colors ${value === o.value ? 'border-emerald bg-emerald text-white' : 'border-line-soft bg-white text-charcoal/60'}`}
        >
          {o.label}{typeof o.count === 'number' ? ` (${o.count})` : ''}
        </button>
      ))}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative w-full max-w-xs">
      <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/35" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border-2 border-line-soft bg-white py-2 pl-9 pr-3 text-[13.5px] font-semibold text-charcoal focus:border-emerald focus:outline-none"
      />
    </div>
  )
}

export function KpiCard({ icon, label, value, tone = 'charcoal', sub }) {
  const toneClass = { charcoal: 'text-charcoal', emerald: 'text-emerald-dark', amber: 'text-amber-dark', red: 'text-danger-dark' }[tone]
  return (
    <div className="rounded-2xl border-2 border-line-soft bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-charcoal/50">
        {icon}
        <p className="text-[12.5px] font-bold">{label}</p>
      </div>
      <p className={`font-num text-[24px] font-extrabold leading-none ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1.5 text-[11.5px] font-semibold text-charcoal/45">{sub}</p>}
    </div>
  )
}

export function Panel({ title, action, children, className = '', flush = false }) {
  return (
    <div className={`rounded-2xl border-2 border-line-soft bg-white ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b-2 border-line-soft px-5 py-4">
          <p className="text-[15px] font-bold text-charcoal">{title}</p>
          {action}
        </div>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </div>
  )
}

export function EmptyState({ icon, text }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-charcoal/45">
      {icon}
      <p className="text-[14px] font-semibold">{text}</p>
    </div>
  )
}