import Link from 'next/link'
import { LogoMark } from '@/components/brand/logo-mark'

/**
 * The stacked wordmark: the mark on the left, the name set in two tight lines.
 * Used by the public header, the footer, the auth pages and the dashboards.
 */
export function Wordmark({
  className = '',
  href = '/',
  size = 'md',
  onClick,
}: {
  className?: string
  href?: string
  size?: 'sm' | 'md'
  onClick?: () => void
}) {
  return (
    <Link href={href} onClick={onClick} aria-label="DevRel Studio, home" className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className={`${size === 'sm' ? 'h-6' : 'h-8'} w-auto text-accent`} />
      <span
        className={`${size === 'sm' ? 'text-[1.1rem]' : 'text-[1.45rem]'} font-bold leading-[0.82] tracking-[-0.05em] text-foreground`}
      >
        devrel
        <br />
        studio
      </span>
    </Link>
  )
}
