'use client'

import { useEffect, useRef, useState } from 'react'
import { logoUrl } from '@/lib/jobs/logos'
import { slugify } from '@/lib/jobs/normalize'
import { initials, monogramHue } from '@/lib/jobs/ui'

// Flat palette tints. A company with no logo gets one of five, picked by a hash
// of its name so the same company is always the same colour.
const MONOGRAM_TINTS = ['var(--ochre)', 'var(--blue)', 'var(--green)', 'var(--pink)', 'var(--orange)']

export function CompanyLogo({ name, size = 40 }: { name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const image = useRef<HTMLImageElement>(null)

  // An image that failed before hydration never fires onError on the client.
  useEffect(() => {
    const element = image.current
    if (element && element.complete && element.naturalWidth === 0) setFailed(true)
  }, [])

  const radius = Math.round(size * 0.24)

  if (failed) {
    const tint = MONOGRAM_TINTS[monogramHue(name) % MONOGRAM_TINTS.length]
    return (
      <div
        aria-hidden
        className="flex shrink-0 items-center justify-center font-semibold"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          fontSize: Math.max(10, Math.round(size * 0.32)),
          background: tint,
          color: 'var(--ink)',
        }}
      >
        {initials(name)}
      </div>
    )
  }

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden bg-white"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={image}
        src={logoUrl(slugify(name), size >= 48 ? 256 : 128)}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain p-1.5"
      />
    </span>
  )
}
