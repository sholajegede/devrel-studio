import { cn } from '@/lib/utils'

/**
 * The brand's building blocks: flat geometric figures in the palette. They
 * stand in for illustration and photography wherever a page needs a visual, and
 * they stack into the small characters that close each page.
 */

export type ShapeName = 'square' | 'circle' | 'dome' | 'arch' | 'cross' | 'quarter' | 'tab'
export type ShapeColor = 'orange' | 'blue' | 'green' | 'ochre' | 'rust' | 'pink' | 'olive' | 'ink' | 'sand' | 'paper'

const PATHS: Record<ShapeName, string> = {
  square: 'M14 14h72v72H14z',
  circle: 'M50 12a38 38 0 1 1 0 76a38 38 0 0 1 0-76z',
  dome: 'M12 88V52a38 38 0 0 1 76 0v36z',
  arch: 'M12 88V52a38 38 0 0 1 76 0v36H64V56a14 14 0 0 0-28 0v32z',
  cross: 'M38 10h24v28h28v24H62v28H38V62H10V38h28z',
  quarter: 'M12 88V16a72 72 0 0 1 72 72z',
  tab: 'M12 88V12h46a30 30 0 0 1 30 30v46z',
}

const FILL: Record<ShapeColor, string> = {
  orange: 'fill-orange',
  blue: 'fill-blue',
  green: 'fill-green',
  ochre: 'fill-ochre',
  rust: 'fill-rust',
  pink: 'fill-pink',
  olive: 'fill-olive',
  ink: 'fill-ink',
  sand: 'fill-sand-deep',
  paper: 'fill-paper',
}

export function Shape({
  name,
  color = 'orange',
  className,
}: {
  name: ShapeName
  color?: ShapeColor
  className?: string
}) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden focusable="false" className={cn('block h-auto w-full', FILL[color], className)}>
      <path d={PATHS[name]} />
    </svg>
  )
}

type Figure = { name: ShapeName; color: ShapeColor }[]

const FAMILY: Figure[] = [
  [{ name: 'arch', color: 'ochre' }, { name: 'square', color: 'pink' }],
  [{ name: 'circle', color: 'green' }, { name: 'tab', color: 'orange' }, { name: 'square', color: 'blue' }],
  [{ name: 'arch', color: 'olive' }, { name: 'quarter', color: 'ochre' }],
  [{ name: 'dome', color: 'orange' }, { name: 'cross', color: 'green' }, { name: 'circle', color: 'rust' }],
  [{ name: 'tab', color: 'blue' }, { name: 'arch', color: 'orange' }],
]

/** The row of figures that sits above the footer. Decorative. */
export function ShapeFamily({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('mx-auto grid max-w-[1600px] grid-cols-5 items-end gap-0 px-4 sm:px-8', className)}>
      {FAMILY.map((figure, i) => (
        <div key={i} className="flex flex-col-reverse items-center">
          {figure.map((s, j) => (
            <div key={j} className={j === 0 ? 'w-[88%]' : 'w-[62%] -mb-[10%]'}>
              <Shape name={s.name} color={s.color} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
