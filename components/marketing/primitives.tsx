import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Page-level heading: two short lines, medium weight, tight tracking. */
export function Display({
  children,
  className,
  as: Tag = 'h2',
  size = 'lg',
}: {
  children: React.ReactNode
  className?: string
  as?: 'h1' | 'h2'
  size?: 'lg' | 'xl' | 'xxl'
}) {
  return (
    <Tag
      className={cn(
        'font-medium text-foreground',
        size === 'lg' && 'text-[clamp(2.25rem,5.4vw,4rem)] leading-[1.03] tracking-[-0.03em]',
        size === 'xl' && 'text-[clamp(2.75rem,7vw,5.25rem)] leading-[1] tracking-[-0.035em]',
        size === 'xxl' && 'text-[clamp(3.5rem,10vw,6.2rem)] leading-[0.93] tracking-[-0.04em]',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function Lede({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground', className)}>
      {children}
    </p>
  )
}

/** A small mono label, used instead of coloured eyebrows. */
export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground', className)}>
      {children}
    </span>
  )
}

const BTN = 'inline-flex h-12 items-center justify-center gap-2 px-7 text-base font-medium transition-colors duration-150'

/** The signature call to action. */
export function PrimaryLink({
  href,
  children,
  className,
  arrow = true,
}: {
  href: string
  children: React.ReactNode
  className?: string
  arrow?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(BTN, 'rounded-[2rem_0.5rem_0.5rem_2rem] bg-accent text-accent-foreground hover:bg-ink', className)}
    >
      {children}
      {arrow && <ArrowRight className="h-4 w-4" />}
    </Link>
  )
}

export function BlueLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn(BTN, 'rounded-full bg-blue text-paper hover:bg-ink', className)}>
      {children}
    </Link>
  )
}

export function OutlineLink({
  href,
  children,
  className,
  arrow = false,
}: {
  href: string
  children: React.ReactNode
  className?: string
  arrow?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(BTN, 'rounded-full border border-ink/25 text-foreground hover:border-ink hover:bg-sand', className)}
    >
      {children}
      {arrow && <ArrowRight className="h-4 w-4" />}
    </Link>
  )
}

/** Flat tag chip, the way the newsroom marks a category. */
export function Tag({
  children,
  tone = 'green',
  className,
}: {
  children: React.ReactNode
  tone?: 'green' | 'orange' | 'blue' | 'ochre' | 'ink'
  className?: string
}) {
  const tones = {
    green: 'bg-green text-paper',
    orange: 'bg-orange text-paper',
    blue: 'bg-blue text-paper',
    ochre: 'bg-ochre text-ink',
    ink: 'bg-ink text-paper',
  }
  return (
    <span className={cn('inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

/** The wide container every marketing page uses. */
export function Wrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1600px] px-4 sm:px-8', className)}>{children}</div>
}
