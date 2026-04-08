export function Spinner({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`spinner-ring ${className}`} />
}
