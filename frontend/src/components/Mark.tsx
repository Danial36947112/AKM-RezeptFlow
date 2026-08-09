interface MarkProps {
  className?: string;
}

/**
 * RezeptFlow's mark: a routed path with start/end nodes, framed by an
 * outlined square — echoes the "case moves through a workflow" idea
 * without borrowing AKM's literal square-and-letter logo.
 */
export function Mark({ className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.25" y="2.25" width="19.5" height="19.5" rx="5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7.5 16.5V12.75C7.5 10.75 9.1 9.5 11 9.5H16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="7.5" cy="16.5" r="1.35" fill="currentColor" />
      <circle cx="16" cy="9.5" r="1.35" fill="currentColor" />
    </svg>
  );
}
