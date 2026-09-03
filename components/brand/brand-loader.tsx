'use client'

import { useId } from 'react'
import { LOGO_MARK_PATH, LOGO_MARK_VIEW_BOX } from './logo-mark'

// ── Waiting, in the product's own voice ───────────────────────────────────────
//
// Every full-page wait in the app used to be a lucide spinner: the same ring
// that appears in a hundred other products, saying nothing except that
// something is happening. The mark says the same thing and says whose product
// it is happening in, which is the entire difference between a wait that feels
// like the app and one that feels like a gap in it.
//
// A spinner still belongs inside a button — that is a control reporting on
// itself, not the page reporting on itself, and a logo there would be absurd.
// The line this component draws is: a region of content that has nothing to
// show yet gets the mark; anything attached to a control keeps its spinner.

/**
 * How the mark is lit.
 *
 * A band of light travels across it, left to right, over a dimmed copy of the
 * same shape. Left to right because the mark's counter is an arrow pointing
 * that way — the motion follows the geometry rather than fighting it.
 *
 * Nothing rotates. A rotating logo is a spinner wearing a costume, and it
 * distorts a mark that was drawn to sit still.
 */
const SIZES = {
  sm: 26,
  md: 42,
  lg: 58,
} as const

export type BrandLoaderSize = keyof typeof SIZES

export function BrandLoader({
  size = 'md',
  label,
  className,
}: {
  size?: BrandLoaderSize
  /** Announced to screen readers, and shown under the mark when given. */
  label?: string
  className?: string
}) {
  // Two of these can be on screen at once — a dialog opening over a page that
  // is still loading — and each needs its own mask, or the second silently
  // borrows the first's.
  const rawId = useId()
  const id = `brand-loader-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const width = SIZES[size]

  return (
    <div className={['brand-loader flex flex-col items-center gap-3', className].filter(Boolean).join(' ')}>
      <svg
        viewBox={LOGO_MARK_VIEW_BOX}
        width={width}
        height={width * (89.36 / 100)}
        role="status"
        aria-label={label ?? 'Loading'}
        className="text-foreground overflow-visible"
      >
        <defs>
          {/*
            The band itself. Soft at both edges so it reads as light moving over
            the mark rather than a rectangle sliding under it.
          */}
          <linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>

          {/*
            Sized and positioned in user units, not percentages: a percentage
            translation on an SVG child resolves against its own bounding box,
            which is the one measurement that changes as the band moves.
          */}
          <mask id={`${id}-mask`}>
            <rect
              className="brand-loader__band"
              x="-62"
              y="-10"
              width="62"
              height="110"
              fill={`url(#${id}-band)`}
            />
          </mask>
        </defs>

        {/* The mark, always present. A loader that starts empty reads as broken. */}
        <path d={LOGO_MARK_PATH} fill="currentColor" fillRule="evenodd" opacity="0.16" />

        {/* The same mark at full strength, revealed only where the band is. */}
        <g mask={`url(#${id}-mask)`}>
          <path d={LOGO_MARK_PATH} fill="currentColor" fillRule="evenodd" />
        </g>
      </svg>

      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  )
}

/**
 * The whole viewport, waiting.
 *
 * Used where there is no shell to put a loader inside yet — before the profile
 * resolves, and on a route that cannot render its own frame until its data
 * lands.
 */
export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <BrandLoader size="lg" label={label} />
    </div>
  )
}

/**
 * A region of a page, waiting, with the page's own frame already around it.
 *
 * `min-h` rather than a fixed height so it holds roughly the space the content
 * will take without pretending to know exactly.
 */
export function SectionLoader({
  label,
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={['flex min-h-[40vh] w-full items-center justify-center', className]
        .filter(Boolean)
        .join(' ')}
    >
      <BrandLoader label={label} />
    </div>
  )
}
