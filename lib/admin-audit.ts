import type { AuditAction } from '@/convex/model/admin'

// ── Reading the audit log ─────────────────────────────────────────────────────
//
// The log stores dotted verbs — 'access.grant', 'admin.promote' — because they
// group, sort and filter. Nobody reads them. These are the same facts written
// the way the person answering a support email would say them.
//
// Shared between the overview and the per-account history rather than copied
// into each: two lists of the same events labelled differently is how somebody
// concludes they are two different kinds of event.

const LABELS: Record<AuditAction, string> = {
  'access.grant': 'Access granted',
  'access.revoke': 'Access revoked',
  'access.comp': 'Comped',
  'access.uncomp': 'Comp removed',
  'access.pause': 'Account paused',
  'access.unpause': 'Account unpaused',
  'request.approve': 'Request approved',
  'request.decline': 'Request declined',
  'admin.promote': 'Made an admin',
  'admin.demote': 'Admin removed',
  'admin.bootstrap': 'Bootstrapped as owner',
  'abuse.unlock': 'Lockout cleared',
  'impersonate.start': 'Impersonation started',
  'impersonate.end': 'Impersonation ended',
}

/**
 * What an audit row says, in English.
 *
 * Falls back to the raw verb rather than to "Unknown action". A row written by
 * a newer deploy than the page reading it is still legible as
 * `access.something`, and hiding it would be the one moment the log is asked to
 * account for something it cannot.
 */
export function actionLabel(action: string): string {
  return LABELS[action as AuditAction] ?? action
}

/** Date and time, for a log where the order of two entries can matter. */
export function formatAuditTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
