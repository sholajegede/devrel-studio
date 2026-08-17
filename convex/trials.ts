import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { daysLeftOn, trialNoticeFor, type TrialNotice } from './model/trialNotices'

// ── Trial emails ──────────────────────────────────────────────────────────────
//
// A daily cron asks who is owed a notice, sends it, and records that it did.
// The recording is the part that matters: without it, a retry or a double run
// mails the same person twice, and the second copy of "your trial is ending"
// reads as a system nobody is minding.
//
// Whether an account is owed anything is decided in model/trialNotices.ts,
// which is pure and tested. Nothing here makes that judgement.

interface Candidate {
  userId: Id<'users'>
  email: string
  firstName?: string
  notice: TrialNotice
  daysLeft: number
  entryCount: number
  clientCount: number
}

/**
 * Everyone owed a notice right now, with the numbers their email quotes.
 *
 * Scans the whole users table. That is the right shape at this size and stays
 * so for a long while: the alternative is an index on trial expiry that exists
 * only for this cron, and a full scan of a few thousand rows once a day is
 * cheaper than carrying an index against every write.
 */
export const dueTrialNotices = internalQuery({
  args: { at: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Candidate[]> => {
    const now = args.at ?? Date.now()
    const users = await ctx.db.query('users').collect()

    const due: Candidate[] = []

    for (const user of users) {
      const notice = trialNoticeFor(user, now)
      if (!notice) continue

      // No address, nothing to send. Worth skipping rather than failing the
      // run, since one unusable row should not stop everybody else's mail.
      if (!user.email) continue

      const workspaces = await ctx.db
        .query('workspaces')
        .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
        .collect()

      let entryCount = 0
      let clientCount = 0

      for (const workspace of workspaces) {
        const entries = await ctx.db
          .query('contentEntries')
          .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace._id))
          .collect()
        const clients = await ctx.db
          .query('clients')
          .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace._id))
          .collect()

        entryCount += entries.length
        clientCount += clients.length
      }

      due.push({
        userId: user._id,
        email: user.email,
        firstName: user.firstName,
        notice,
        daysLeft: daysLeftOn(user, now),
        entryCount,
        clientCount,
      })
    }

    return due
  },
})

/**
 * Records that a notice went out.
 *
 * Appends rather than overwrites, so the 'ending' notice is still on record
 * when 'ended' follows it a few days later.
 */
export const markTrialNoticeSent = internalMutation({
  args: { userId: v.id('users'), notice: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) return

    const already = user.trialNoticesSent ?? []
    if (already.includes(args.notice)) return

    await ctx.db.patch(args.userId, {
      trialNoticesSent: [...already, args.notice],
    })
  },
})

/**
 * The daily run.
 *
 * Marks each notice only after Resend accepts it, so a failed send is retried
 * tomorrow rather than silently dropped. The reverse order would lose a notice
 * on any transient failure, and losing the one email that asks for money is
 * worse than the small risk of a duplicate.
 *
 * One account's failure does not stop the rest: each send is caught on its own.
 */
export const runTrialNotices = internalAction({
  args: { at: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ due: number; sent: number; failed: number }> => {
    const candidates = await ctx.runQuery(internal.trials.dueTrialNotices, { at: args.at })

    const origin = process.env.SITE_URL ?? 'https://devrel.studio'
    const billingUrl = `${origin}/dashboard/billing`

    let sent = 0
    let failed = 0

    for (const candidate of candidates) {
      const result =
        candidate.notice === 'ending'
          ? await ctx.runAction(internal.email.sendTrialEndingSoon, {
              email: candidate.email,
              firstName: candidate.firstName,
              daysLeft: candidate.daysLeft,
              entryCount: candidate.entryCount,
              clientCount: candidate.clientCount,
              billingUrl,
            }).catch((error) => {
              console.error(`[trials] send failed for ${candidate.userId}:`, error)
              return { ok: false as const, reason: 'send-failed' as const }
            })
          : await ctx.runAction(internal.email.sendTrialEnded, {
              email: candidate.email,
              firstName: candidate.firstName,
              entryCount: candidate.entryCount,
              billingUrl,
            }).catch((error) => {
              console.error(`[trials] send failed for ${candidate.userId}:`, error)
              return { ok: false as const, reason: 'send-failed' as const }
            })

      if (result.ok) {
        await ctx.runMutation(internal.trials.markTrialNoticeSent, {
          userId: candidate.userId,
          notice: candidate.notice,
        })
        sent += 1
      } else {
        failed += 1
      }
    }

    return { due: candidates.length, sent, failed }
  },
})
