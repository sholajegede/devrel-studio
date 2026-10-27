import { Id } from '../_generated/dataModel'
import { MutationCtx } from '../_generated/server'
import { WorkspaceContext } from './workspaces'

// ── Workspace audit trail ─────────────────────────────────────────────────────
//
// Every action an agent or a person takes through the agent layer writes one
// row here. Rows are only ever inserted. A client or a funder asking "who did
// this and when" reads this table.

export async function recordAudit(
  ctx: MutationCtx,
  who: Pick<WorkspaceContext, 'workspaceId' | 'user'> | { workspaceId: Id<'workspaces'>; user: null },
  event: {
    action: string
    summary: string
    subjectKind?: string
    subjectId?: string
    /** Label for an agent acting alone, e.g. 'Scout'. */
    agentLabel?: string
  },
): Promise<void> {
  const user = who.user
  await ctx.db.insert('auditEvents', {
    workspaceId: who.workspaceId,
    actorId: user ? user._id : undefined,
    actorLabel: user ? user.email : event.agentLabel ?? 'Agent',
    action: event.action,
    subjectKind: event.subjectKind,
    subjectId: event.subjectId,
    summary: event.summary,
    at: Date.now(),
  })
}
