import { ConvexError } from 'convex/values'
import { Doc } from '../_generated/dataModel'
import { MutationCtx } from '../_generated/server'
import { AnyCtx, getRealUser } from './auth'

// ── Platform administration ───────────────────────────────────────────────────
//
// Authority to run devrel.studio itself, as distinct from authority inside a
// workspace. The two are deliberately orthogonal: being an admin grants no
// access to anybody's client data, and owning a workspace does not make anyone
// an admin.
//
// Every function under convex/admin/ resolves its caller through
// `requireAdmin` before touching anything. The guard lives here rather than in
// a route check because a route guard that is the only check is one refactor
// away from being no check — and because the proxy can only tell whether
// somebody is signed in, not whether they are an admin.

export type AdminRole = 'owner' | 'support'

/**
 * Ordered least to most privileged. Kept as an array rather than a comparison
 * so adding a tier later is one edit and not a rewritten operator.
 */
const ROLE_ORDER: AdminRole[] = ['support', 'owner']

export function atLeastAdmin(role: AdminRole, minimum: AdminRole): boolean {
  return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(minimum)
}

/**
 * The same message for every failure mode.
 *
 * "Not signed in", "signed in but not an admin" and "no such thing" are
 * indistinguishable on purpose. A distinct message for the middle case confirms
 * to whoever is probing that /admin is real, that the endpoint they found is
 * live, and that the only missing piece is a flag on their account — which is
 * precisely the information not to hand out.
 */
const OPAQUE = 'Not found'

/** The signed-in platform admin, or null. Use in queries that can degrade. */
export async function getAdmin(
  ctx: AnyCtx,
  minimum: AdminRole = 'support',
): Promise<Doc<'users'> | null> {
  // `getRealUser`, never `getCurrentUser`. Authority is a fact about who is
  // signed in, not about whose data they happen to be reading: resolving this
  // through the impersonated account would mean that viewing an owner's
  // dashboard made you an owner, and that ending the session required the
  // authority you had just borrowed.
  const user = await getRealUser(ctx)
  if (!user?.adminRole) return null
  if (!atLeastAdmin(user.adminRole, minimum)) return null
  return user
}

/**
 * The signed-in platform admin. Throws otherwise.
 *
 * This is the first line of every admin function. The default of 'support'
 * covers reading and approving; anything destructive — revoke, comp,
 * impersonate, granting admin — passes 'owner' explicitly.
 */
export async function requireAdmin(
  ctx: AnyCtx,
  minimum: AdminRole = 'support',
): Promise<Doc<'users'>> {
  const admin = await getAdmin(ctx, minimum)
  if (!admin) throw new ConvexError(OPAQUE)
  return admin
}

// ── Audit ─────────────────────────────────────────────────────────────────────

/** What a privileged action can be. Dotted verbs, grouped by subject. */
export type AuditAction =
  | 'access.grant'
  | 'access.revoke'
  | 'access.comp'
  | 'access.uncomp'
  | 'access.pause'
  | 'access.unpause'
  | 'request.approve'
  | 'request.decline'
  | 'admin.promote'
  | 'admin.demote'
  | 'admin.bootstrap'
  | 'abuse.unlock'
  | 'impersonate.start'
  | 'impersonate.end'

export interface AuditSubject {
  id?: string
  email?: string
}

/**
 * Append one row describing something an admin just did.
 *
 * Called after the write it describes, inside the same mutation, so the two
 * commit together — a Convex mutation is a transaction, and an audit row that
 * could be written without its action (or vice versa) would be worse than none.
 *
 * `before` and `after` are serialised by the caller rather than inferred here:
 * only the caller knows which fields of a large document actually mattered, and
 * storing the whole row would bury the change in noise.
 */
export async function writeAudit(
  ctx: MutationCtx,
  actor: Doc<'users'>,
  action: AuditAction,
  subject?: AuditSubject,
  detail?: { before?: unknown; after?: unknown; reason?: string },
): Promise<void> {
  await ctx.db.insert('adminAuditLog', {
    actorId: actor._id,
    actorEmail: actor.email,
    action,
    subjectId: subject?.id,
    subjectEmail: subject?.email,
    before: serialise(detail?.before),
    after: serialise(detail?.after),
    reason: detail?.reason,
    at: Date.now(),
  })
}

/**
 * Compact JSON, or undefined for nothing.
 *
 * Truncated rather than rejected: an oversized value is a reporting problem,
 * but throwing here would roll back the action the row exists to describe.
 */
function serialise(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  try {
    const json = JSON.stringify(value)
    return json.length > 4000 ? `${json.slice(0, 3997)}...` : json
  } catch {
    return String(value).slice(0, 4000)
  }
}
