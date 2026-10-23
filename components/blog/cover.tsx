import { Shape, type ShapeColor, type ShapeName } from '@/components/marketing/shapes'
import { cn } from '@/lib/utils'

// ── Post covers ───────────────────────────────────────────────────────────────
//
// A post has no image, so each one gets a cover built from the brand's flat
// figures. The slug picks the layout, so a post keeps the same cover on the
// index, on its own page and in a list of related posts, and no two neighbours
// in the list look alike unless their slugs happen to collide.

interface Layout {
  tone: string
  big: [ShapeName, ShapeColor]
  small: [ShapeName, ShapeColor]
  flip: boolean
}

const LAYOUTS: Layout[] = [
  { tone: 'bg-ochre', big: ['dome', 'orange'], small: ['circle', 'ink'], flip: false },
  { tone: 'bg-blue', big: ['tab', 'paper'], small: ['square', 'ink'], flip: true },
  { tone: 'bg-green', big: ['circle', 'paper'], small: ['cross', 'ink'], flip: false },
  { tone: 'bg-orange', big: ['arch', 'ink'], small: ['quarter', 'paper'], flip: true },
  { tone: 'bg-pink', big: ['square', 'orange'], small: ['dome', 'ink'], flip: false },
  { tone: 'bg-olive', big: ['quarter', 'ochre'], small: ['circle', 'paper'], flip: true },
]

function pick(slug: string): Layout {
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0
  return LAYOUTS[hash % LAYOUTS.length]
}

export function Cover({
  slug,
  className,
  size = 'md',
}: {
  slug: string
  className?: string
  size?: 'md' | 'lg'
}) {
  const layout = pick(slug)
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden',
        size === 'lg' ? 'rounded-[2rem] sm:rounded-[2.5rem]' : 'rounded-[1.5rem]',
        layout.tone,
        className,
      )}
    >
      <div className={cn('absolute bottom-[-6%] w-[46%]', layout.flip ? 'right-[6%]' : 'left-[6%]')}>
        <Shape name={layout.big[0]} color={layout.big[1]} />
      </div>
      <div className={cn('absolute top-[12%] w-[18%]', layout.flip ? 'left-[10%]' : 'right-[10%]')}>
        <Shape name={layout.small[0]} color={layout.small[1]} />
      </div>
    </div>
  )
}
