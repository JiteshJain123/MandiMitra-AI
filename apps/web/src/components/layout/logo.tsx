export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#14532d" />
        <path d="M9 22V10l7 7 7-7v12" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16" cy="25" r="1.6" fill="#e0a526" />
      </svg>
      <span className="font-display text-lg font-semibold tracking-tight text-mandi-900">MandiMitra</span>
    </span>
  );
}
