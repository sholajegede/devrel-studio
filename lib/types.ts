import { Id } from "@/convex/_generated/dataModel"

// ── Categories ────────────────────────────────────────────────────────────────

export const CATEGORIES = ['Written', 'Video', 'Event', 'Podcast', 'Package', 'Demo'] as const;
export type Category = typeof CATEGORIES[number];

// ── Platforms per category ────────────────────────────────────────────────────

export const PLATFORMS_BY_CATEGORY: Record<Category, readonly string[]> = {
  Written: [
    'Dev.to', 'freeCodeCamp', 'Medium', 'Hashnode', 'LinkedIn',
    'Newsletter', 'Blog', 'GitHub', 'Documentation', 'Twitter/X', 'Other',
  ],
  Video: ['YouTube', 'Loom', 'Vimeo', 'TikTok', 'Other'],
  Event: [], // free-text — conference names vary too much for a dropdown
  Podcast: ['Spotify', 'Apple Podcasts', 'YouTube Podcasts', 'Other'],
  Package: ['npm', 'GitHub', 'Other'],
  Demo: ['Vercel', 'Netlify', 'Cloudflare Pages', 'GitHub', 'Other'],
};

// ── Sub-types per category ────────────────────────────────────────────────────

export const SUBTYPES_BY_CATEGORY: Record<Category, readonly string[]> = {
  Written: ['Tutorial', 'Guide', 'Reference Doc', 'Blog Post', 'Case Study', 'Opinion', 'Other'],
  Video: ['Tutorial', 'Demo', 'Conference Talk', 'Interview', 'Other'],
  Event: ['Conference Talk', 'Workshop', 'Meetup', 'Panel', 'Keynote', 'Other'],
  Podcast: ['Guest Appearance', 'Host', 'Solo Episode', 'Other'],
  Package: ['Convex Component', 'Library', 'CLI Tool', 'Other'],
  Demo: ['Full App', 'Starter Kit', 'Sample', 'Other'],
};

// ── Reshare platforms ─────────────────────────────────────────────────────────

export const RESHARE_PLATFORMS = [
  'LinkedIn',
  'Twitter/X',
  'Reddit',
  'Hacker News',
  'Dev.to',
  'Medium',
  'YouTube',
  'Vercel',
  'OpenAI Forum',
  'Other',
] as const;

// ── Core types ────────────────────────────────────────────────────────────────

export interface Reshare {
  platform: string;
  link: string;
  date: string;
}

export type Status = 'Published' | 'Draft' | 'Waiting Approval' | 'Scheduled'

export interface ContentEntry {
  _id: Id<"contentEntries">
  category?: Category;
  client?: string;
  title: string;
  link: string;
  trackingLink: string;
  platform: string;
  publicationDate: string;
  status: Status;
  views?: number;
  tags: string[];
  contentType: string;
  notes: string;
  reshares?: Reshare[];
  // Package
  packageName?: string;
  downloads?: number;
  weeklyDownloads?: number;
  // Event
  eventName?: string;
  eventLocation?: string;
  attendees?: number;
  // Podcast
  podcastName?: string;
  // Demo
  repoUrl?: string;
  stack?: string;
  stars?: number;
  // Set by the npm / GitHub sync job — see convex/sync.ts
  statsSyncedAt?: string;
  statsSyncError?: string;
  updatedAt: string;
}

// ── Static lists ──────────────────────────────────────────────────────────────

export const STATUSES: Status[] = ['Published', 'Draft', 'Waiting Approval', 'Scheduled']

// Kept for backward compat with content list filters
export const PLATFORMS = [
  'Dev.to', 'freeCodeCamp', 'YouTube', 'Blog', 'Twitter/X', 'LinkedIn',
  'Medium', 'Hashnode', 'Documentation', 'GitHub', 'Newsletter',
  'Spotify', 'Apple Podcasts', 'npm', 'Other',
] as const;

export const DEFAULT_TAGS = [
  // Clients / Products
  'Kinde', 'Convex', 'Auth', 'Billing', 'Workflows',
  // Auth methods
  'OAuth', 'OIDC', 'SAML', 'SSO', 'Passkeys', 'MFA', 'OTP', 'Social Login',
  // Security & identity
  'Security', 'Identity Management', 'Fraud Prevention',
  // API & integration
  'Management API', 'M2M', 'Webhooks', 'Integrations',
  // User management
  'Organizations', 'Teams', 'Roles', 'Permissions', 'Session Management',
  // Developer tools
  'SDK', 'NextJS', 'React', 'React Native', 'Expo', 'SvelteKit',
  'Remix', 'Python', 'Node.js', 'TypeScript', 'JavaScript', '.NET',
  // Open source
  'Open Source', 'npm', 'Package', 'Convex Component',
  // Event / community
  'Conference', 'Meetup', 'Workshop', 'Keynote', 'Panel',
  // Podcast
  'Podcast', 'Guest Appearance',
  // Content
  'Tutorial', 'Build in Public', 'Case Study', 'Opinion', 'DevRel',
  // Business
  'SaaS', 'B2B', 'Enterprise', 'AI', 'UX', 'Product',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getMonthsFromContent(content: ContentEntry[]): string[] {
  const months = new Set<string>()
  content.forEach((entry) => {
    const date = new Date(entry.publicationDate)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    months.add(monthKey)
  })
  return Array.from(months).sort().reverse()
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Metric and presentation helpers now live in lib/metrics.ts and
// lib/category-meta.tsx. Re-exported here so existing imports keep working.
export { getMetricLabel, getMetricValue } from './metrics'
export { getCategoryColor } from './category-meta'
