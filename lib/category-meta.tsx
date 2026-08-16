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
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25',
    selectorClass: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300',
  },
  Video: {
    label: 'Video',
    description: 'YouTube, Loom, recordings',
    icon: Video,
    metricIcon: Eye,
    badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/25',
    selectorClass: 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
  },
  Event: {
    label: 'Event',
    description: 'Talks, conferences, meetups',
    icon: MapPin,
    metricIcon: Users,
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/25',
    selectorClass: 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-300',
  },
  Podcast: {
    label: 'Podcast',
    description: 'Episodes, appearances',
    icon: Mic,
    metricIcon: Headphones,
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/25',
    selectorClass: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300',
  },
  Package: {
    label: 'Package',
    description: 'npm packages, Convex Components',
    icon: Package,
    metricIcon: Download,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25',
    selectorClass: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  Demo: {
    label: 'Demo',
    description: 'Demo apps, starter kits',
    icon: Rocket,
    metricIcon: Star,
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/25',
    selectorClass: 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-300',
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
    ?? 'bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-500/10 dark:text-stone-300 dark:border-stone-500/25'
}
