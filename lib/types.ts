import { Id } from "@/convex/_generated/dataModel"

export const CLIENTS = ['kinde', 'clerk', 'v0'] as const;

// ── Categories ────────────────────────────────────────────────────────────────

export const CATEGORIES = ['Written', 'Video', 'Event', 'Podcast', 'Package'] as const;
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
};

// ── Sub-types per category ────────────────────────────────────────────────────

export const SUBTYPES_BY_CATEGORY: Record<Category, readonly string[]> = {
  Written: ['Tutorial', 'Guide', 'Reference Doc', 'Blog Post', 'Case Study', 'Opinion', 'Other'],
  Video: ['Tutorial', 'Demo', 'Conference Talk', 'Interview', 'Other'],
  Event: ['Conference Talk', 'Workshop', 'Meetup', 'Panel', 'Keynote', 'Other'],
  Podcast: ['Guest Appearance', 'Host', 'Solo Episode', 'Other'],
  Package: ['Convex Component', 'Library', 'CLI Tool', 'Other'],
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

export function getMetricLabel(category?: Category): string {
  switch (category) {
    case 'Event':   return 'Attendees';
    case 'Podcast': return 'Listeners';
    case 'Package': return 'Downloads';
    default:        return 'Views';
  }
}

export function getMetricValue(entry: ContentEntry): number {
  const cat = entry.category;
  if (cat === 'Event')   return entry.attendees ?? 0;
  if (cat === 'Package') return entry.downloads ?? 0;
  if (cat === 'Podcast') return entry.downloads ?? 0;
  return entry.views ?? 0;
}

export function getCategoryColor(category?: Category): string {
  switch (category) {
    case 'Written': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Video':   return 'bg-red-50 text-red-700 border-red-200';
    case 'Event':   return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Podcast': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Package': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:        return 'bg-stone-50 text-stone-600 border-stone-200';
  }
}
