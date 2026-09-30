'use client'

import { useEffect, useRef, useState } from 'react'
import { logoUrl } from '@/lib/jobs/logos'
import { slugify } from '@/lib/jobs/normalize'
import { initials, monogramHue } from '@/lib/jobs/ui'

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
    const hue = monogramHue(name)
    return (
      <div
        aria-hidden
        className="flex shrink-0 items-center justify-center font-semibold"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          fontSize: Math.max(10, Math.round(size * 0.32)),
          background: `linear-gradient(135deg, hsl(${hue} 60% 94%), hsl(${hue} 55% 86%))`,
          color: `hsl(${hue} 45% 26%)`,
        }}
      >
        {initials(name)}
      </div>
    )
  }

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden border border-border bg-white"
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
