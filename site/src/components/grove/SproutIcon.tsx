/** The Grovekeeper mark: a two-leaf sprout. */

export function SproutIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 21v-9" />
      <path d="M12 12c0-3.5-2.6-6-6.5-6 0 3.6 2.7 6 6.5 6Z" />
      <path d="M12 10c0-3 2.3-5.3 5.8-5.3 0 3.1-2.4 5.3-5.8 5.3Z" />
    </svg>
  )
}
