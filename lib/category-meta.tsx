import type React from 'react'
import {
  Download,
  Eye,
  FileText,
  Headphones,
  MapPin,
  Mic,
  Package,
  Rocket,
  Star,
  Users,
  Video,
} from 'lucide-react'
import { Category } from './types'

// ── Category presentation ─────────────────────────────────────────────────────
//
// Icons and colours for every surface that renders a category. Kept apart from
// `lib/metrics.ts` so the PDF renderer can compute totals without importing
// lucide.

export interface CategoryMeta {
  label: string
  /** Shown in the content form's category picker. */
  description: string
  /** Represents the category itself. */
  icon: React.ElementType
  /** Represents the category's metric (views, stars, …). */
  metricIcon: React.ElementType
  /** Badge styling in lists and tables. */
  badgeClass: string
  /** Selected-state styling in the content form's picker. */
  selectorClass: string
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  Written: {
    label: 'Written',
    description: 'Articles, tutorials, guides',
    icon: FileText,
    metricIcon: Eye,
    badgeClass: 'bg-orange text-paper border-transparent',
    selectorClass: 'border-ink bg-orange text-paper',
  },
  Video: {
    label: 'Video',
    description: 'YouTube, Loom, recordings',
    icon: Video,
    metricIcon: Eye,
    badgeClass: 'bg-blue text-paper border-transparent',
    selectorClass: 'border-ink bg-blue text-paper',
  },
  Event: {
    label: 'Event',
    description: 'Talks, conferences, meetups',
    icon: MapPin,
    metricIcon: Users,
    badgeClass: 'bg-ochre text-ink border-transparent',
    selectorClass: 'border-ink bg-ochre text-ink',
  },
  Podcast: {
    label: 'Podcast',
    description: 'Episodes, appearances',
    icon: Mic,
    metricIcon: Headphones,
    badgeClass: 'bg-green text-paper border-transparent',
    selectorClass: 'border-ink bg-green text-paper',
  },
  Package: {
    label: 'Package',
    description: 'npm packages, Convex Components',
    icon: Package,
    metricIcon: Download,
    badgeClass: 'bg-pink text-ink border-transparent',
    selectorClass: 'border-ink bg-pink text-ink',
  },
  Demo: {
    label: 'Demo',
    description: 'Demo apps, starter kits',
    icon: Rocket,
    metricIcon: Star,
    badgeClass: 'bg-olive text-paper border-transparent',
    selectorClass: 'border-ink bg-olive text-paper',
  },
}

/** Icon for a category, safe against unknown/missing values. */
export function categoryIcon(category?: string): React.ElementType {
  return (CATEGORY_META[category as Category] ?? CATEGORY_META.Written).icon
}

export function categoryMetricIcon(category?: string): React.ElementType {
  return (CATEGORY_META[category as Category] ?? CATEGORY_META.Written).metricIcon
}

export function getCategoryColor(category?: string): string {
  return CATEGORY_META[category as Category]?.badgeClass
    ?? 'bg-sand-deep text-ink border-transparent'
}
