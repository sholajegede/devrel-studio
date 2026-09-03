import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Client brand colours ──────────────────────────────────────────────────────
//
// A client picks the colour; the product has to keep the text on it readable.
// Left to chance, a pale brand colour gets white text on it and the label
// disappears — on the one page that client's own staff will look at.

/** Relative luminance, per WCAG, from a `#rrggbb` string. */
export function luminance(hex: string): number {
  const value = hex.replace('#', '')
  const channel = (pair: string) => {
    const srgb = parseInt(pair, 16) / 255
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4)
  }
  return (
    0.2126 * channel(value.slice(0, 2)) +
    0.7152 * channel(value.slice(2, 4)) +
    0.0722 * channel(value.slice(4, 6))
  )
}

/**
 * Ink that stays legible on a given background.
 *
 * The 0.45 threshold rather than the midpoint: the two candidates are not
 * symmetric — near-black on a mid tone reads better than white does — so the
 * switch to dark text happens slightly earlier than a naive split would put it.
 */
export function readableOn(hex: string): string {
  return luminance(hex) > 0.45 ? '#10231f' : '#ffffff'
}
