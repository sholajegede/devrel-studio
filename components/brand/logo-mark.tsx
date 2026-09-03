/**
 * The DevRel Studio mark.
 *
 * Vector, and deliberately so. The brand mark ships as
 * public/images/devrel-logo.png: a megabyte of 1024px RGB with no alpha
 * channel, which means a light square is baked into the file. That is fine in a
 * header on a light page and no use at all here. A loader has to sit on both
 * themes, scale to any size, and let an animation address part of it — none of
 * which a raster with its background painted on can do.
 *
 * So the outline was traced off the PNG at 1024px, reduced to polygons, and
 * checked against the original. At the sizes anything renders this — 28 to 60
 * pixels — the two are indistinguishable.
 *
 * The viewBox is the mark's own bounding box rather than a padded square, so
 * callers control their own spacing instead of inheriting whatever whitespace
 * happened to be around the mark in the source file.
 *
 * The fill rule is evenodd rather than the default, which is what punches the
 * notch out of the counter without the result depending on which way the tracer
 * happened to wind each contour.
 */

/** Width 100; the height is the mark's real proportion, not a square. */
export const LOGO_MARK_VIEW_BOX = '0 0 100 89.36'

export const LOGO_MARK_PATH = [
  'M1.28 0L67.02 0L72.77 1.49L75.74 2.98L77.66 4.68L78.09 4.68',
  'L94.89 21.49L94.89 21.91L95.74 22.55L96.38 24.04L96.81 24.26',
  'L98.3 27.23L99.57 31.28L100 33.83L100 68.3L98.51 74.68L97.02 77.87',
  'L96.6 78.09L96.38 78.94L95.74 79.36L95.32 80.43L91.49 84.26',
  'L91.06 84.26L90.64 84.89L90.21 84.89L89.15 85.96L87.87 86.38',
  'L87.66 86.81L83.4 88.51L78.72 89.36L0.85 89.15L0 88.09L0 71.49',
  'L0.64 70.43L1.91 70L45.53 70L46.38 69.57L77.45 38.51L78.51 36.38',
  'L78.51 34.47L77.45 32.13L64.68 19.36L63.19 18.51L20.85 18.3',
  'L19.79 19.15L19.57 45.74L18.72 47.23L1.91 64.04L1.06 64.04L0 62.98',
  'L0 1.28L1.28 0Z',
  'M81.28 62.13L73.4 69.79L73.4 70.21L79.36 70L80.85 68.94L81.28 67.87L81.28 62.13Z',
].join('')

export function LogoMark({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={LOGO_MARK_VIEW_BOX}
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path d={LOGO_MARK_PATH} />
    </svg>
  )
}
