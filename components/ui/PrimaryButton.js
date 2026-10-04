export default function PrimaryButton({ children, onClick, tone = 'emerald', disabled, icon, type = 'button' }) {
  const tones = {
    emerald: 'bg-emerald text-white active:bg-emerald-dark',
    amber: 'bg-amber text-charcoal active:bg-amber-dark active:text-white',
    red: 'bg-danger text-white active:bg-danger-dark',
    outline: 'bg-white text-emerald border-2 border-emerald active:bg-mint',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`tap-target w-full rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2 transition-colors ${tones[tone]} ${disabled ? 'opacity-40' : ''}`}
    >
      {icon}{children}
    </button>
  )
}