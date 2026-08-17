'use node'

import { ConvexError, v } from 'convex/values'
import { action, internalAction } from './_generated/server'
import { api } from './_generated/api'

// ── Transactional email ───────────────────────────────────────────────────────
//
// Resend over its REST API rather than the npm SDK: the whole integration is one
// POST, and a dependency that only wraps `fetch` is a dependency that can break
// a deploy for no benefit.
//
// Everything here degrades rather than throws. An invite that saved but whose
// email failed is recoverable — the owner can copy the link. A mutation that
// rolled back because an email provider had a bad minute is not. So senders log
// and return a status; no caller is expected to treat a send failure as fatal.
//
// Set on the Convex deployment, not .env.local:
//   npx convex env set RESEND_API_KEY re_...
//   npx convex env set EMAIL_FROM "DevRel Studio <support@devrel.studio>"

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

type SendResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'not-configured' | 'send-failed'; detail?: string }

async function send(args: {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
  /** Base64 content, for the report PDF. */
  attachments?: { filename: string; content: string }[]
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM ?? 'DevRel Studio <onboarding@resend.dev>'

  // No key is the expected state in development. Log the mail so the flow can
  // still be followed end to end without a provider account.
  if (!apiKey) {
    console.log(`[email] not configured — would send "${args.subject}" to ${args.to}`)
    return { ok: false, reason: 'not-configured' }
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
        ...(args.attachments?.length ? { attachments: args.attachments } : {}),
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error(`[email] Resend rejected "${args.subject}":`, response.status, detail)
      return { ok: false, reason: 'send-failed', detail }
    }

    const body = (await response.json()) as { id: string }
    return { ok: true, id: body.id }
  } catch (error) {
    console.error(`[email] send failed for "${args.subject}":`, error)
    return {
      ok: false,
      reason: 'send-failed',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

// ── Layout ────────────────────────────────────────────────────────────────────

/** One shell for every message, so mail looks like the product it came from. */
function layout(body: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
      <tr>
        <td style="padding:28px 32px;">
          <p style="margin:0 0 20px;font-size:15px;font-weight:600;">devrel<span style="color:#718096;">.studio</span></p>
          ${body}
        </td>
      </tr>
    </table>
    <p style="max-width:520px;margin:16px auto 0;font-size:12px;color:#718096;text-align:center;">
      Sent by DevRel Studio
    </p>
  </body>
</html>`
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#38b2ac;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;">${label}</a>`
}

// ── Senders ───────────────────────────────────────────────────────────────────

/**
 * Invitation to join a workspace. Triggered from `members:inviteMember`.
 *
 * The link carries the invite token, so accepting it grants real access to the
 * workspace — the earlier caveat here, that invites recorded intent without
 * conferring access, no longer applies.
 */
export const sendWorkspaceInvite = internalAction({
  args: {
    email: v.string(),
    inviterName: v.string(),
    role: v.string(),
    signUpUrl: v.string(),
  },
  handler: async (_ctx, args): Promise<SendResult> => {
    return await send({
      to: args.email,
      subject: `${args.inviterName} invited you to DevRel Studio`,
      html: layout(`
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
          <strong>${args.inviterName}</strong> invited you to join their DevRel Studio workspace as
          <strong>${args.role}</strong>.
        </p>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.6;">
          Create an account to accept it. The invitation expires in 14 days.
        </p>
        <p style="margin:0 0 22px;">${button(args.signUpUrl, 'Accept invitation')}</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#718096;">
          If you weren't expecting this, you can ignore this email.
        </p>
      `),
      text: `${args.inviterName} invited you to join their DevRel Studio workspace as ${args.role}.\n\nCreate your account: ${args.signUpUrl}\n\nThis invitation expires in 14 days. If you weren't expecting it, you can ignore this email.`,
    })
  },
})

/**
 * Sends a client manager their dashboard access code.
 *
 * The plaintext code is passed in rather than read from the database, because
 * only its hash is ever stored — see lib/manager-auth.ts. The caller is the one
 * place that holds the code: the route that just generated it.
 */
export const sendManagerAccessCode = internalAction({
  args: {
    email: v.string(),
    clientName: v.string(),
    code: v.string(),
    dashboardUrl: v.string(),
  },
  handler: async (_ctx, args): Promise<SendResult> => {
    return await send({
      to: args.email,
      subject: `Your ${args.clientName} dashboard access code`,
      html: layout(`
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
          Here is your access code for the <strong>${args.clientName}</strong> performance dashboard.
        </p>
        <p style="margin:0 0 20px;padding:14px;background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:22px;letter-spacing:4px;">
          ${args.code}
        </p>
        <p style="margin:0 0 22px;">${button(args.dashboardUrl, 'Open the dashboard')}</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#718096;">
          The code is not case sensitive and the dashes are optional. Your session stays active on that device for 30 days.
        </p>
      `),
      text: `Your access code for the ${args.clientName} performance dashboard:\n\n${args.code}\n\nOpen the dashboard: ${args.dashboardUrl}\n\nThe code is not case sensitive and the dashes are optional. Your session stays active on that device for 30 days.`,
    })
  },
})

/**
 * Owner-facing wrapper around the access-code email.
 *
 * Public because the caller is the route handler that just generated the code,
 * acting as the signed-in DevRel. Ownership is re-checked here rather than
 * trusted from the caller: `getClientById` resolves through `readOwnedDoc`, so a
 * clientId belonging to someone else comes back null and nothing is sent.
 */
export const sendManagerAccessCodePublic = action({
  args: {
    clientId: v.id('clients'),
    email: v.string(),
    code: v.string(),
    dashboardUrl: v.string(),
  },
  handler: async (ctx, args): Promise<SendResult> => {
    const client = await ctx.runQuery(api.clients.getClientById, {
      clientId: args.clientId,
    })

    if (!client) {
      throw new ConvexError('Not authorized')
    }

    return await send({
      to: args.email,
      subject: `Your ${client.company || client.name} dashboard access code`,
      html: layout(`
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
          Here is your access code for the <strong>${client.company || client.name}</strong> performance dashboard.
        </p>
        <p style="margin:0 0 20px;padding:14px;background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:22px;letter-spacing:4px;">
          ${args.code}
        </p>
        <p style="margin:0 0 22px;">${button(args.dashboardUrl, 'Open the dashboard')}</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#718096;">
          The code is not case sensitive and the dashes are optional. Your session stays active on that device for 30 days.
        </p>
      `),
      text: `Your access code for the ${client.company || client.name} performance dashboard:\n\n${args.code}\n\nOpen the dashboard: ${args.dashboardUrl}\n\nThe code is not case sensitive and the dashes are optional. Your session stays active on that device for 30 days.`,
    })
  },
})

/**
 * Tells the DevRel a client replied to a report.
 *
 * Sent rather than left for them to discover: the whole point of asking a client
 * for feedback is that somebody reads it, and nobody checks a dashboard on the
 * off-chance.
 */
export const sendFeedbackNotification = internalAction({
  args: {
    email: v.string(),
    clientName: v.string(),
    period: v.string(),
    comment: v.string(),
    authorName: v.optional(v.string()),
    rating: v.optional(v.number()),
    reportUrl: v.string(),
  },
  handler: async (_ctx, args): Promise<SendResult> => {
    const who = args.authorName ? `${args.authorName} at ${args.clientName}` : args.clientName
    const stars = args.rating ? ` They rated the period ${args.rating} out of 5.` : ''

    return await send({
      to: args.email,
      subject: `${args.clientName} replied to the ${args.period} report`,
      html: layout(`
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
          <strong>${who}</strong> left feedback on the ${args.period} report.${stars}
        </p>
        <blockquote style="margin:0 0 22px;padding:14px 16px;background:#f7fafc;border-left:3px solid #38b2ac;border-radius:0 8px 8px 0;font-size:15px;line-height:1.6;color:#2d3748;">
          ${args.comment}
        </blockquote>
        <p style="margin:0;">${button(args.reportUrl, 'Open the report')}</p>
      `),
      text: `${who} left feedback on the ${args.period} report.${stars}\n\n"${args.comment}"\n\nOpen the report: ${args.reportUrl}`,
    })
  },
})

/** "Your monthly report is ready" — for the reporting cron to call. */
export const sendMonthlyReportReady = internalAction({
  args: {
    email: v.string(),
    clientName: v.string(),
    period: v.string(),
    publishedCount: v.number(),
    dashboardUrl: v.string(),
    /**
     * The report as a PDF, base64. Optional: a missing attachment is a worse
     * email, but a failed attachment must not stop the email going out at all.
     * Some readers forward the file to their manager and never open the link,
     * which is the whole reason for including it.
     */
    pdfBase64: v.optional(v.string()),
    pdfFilename: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<SendResult> => {
    const piece = args.publishedCount === 1 ? 'piece' : 'pieces'

    return await send({
      to: args.email,
      subject: `Your ${args.period} report for ${args.clientName}`,
      attachments:
        args.pdfBase64 && args.pdfFilename
          ? [{ filename: args.pdfFilename, content: args.pdfBase64 }]
          : undefined,
      html: layout(`
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
          The <strong>${args.period}</strong> report for <strong>${args.clientName}</strong> is ready.
        </p>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.6;">
          ${args.publishedCount} ${piece} published this period.
        </p>
        <p style="margin:0 0 22px;">${button(args.dashboardUrl, 'Read the report')}</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#718096;">
          The report covers the full period and compares it with the one before. A space at the end
          takes your reply. The same page has a PDF download.
        </p>
      `),
      text: `Your ${args.period} report for ${args.clientName} is ready. ${args.publishedCount} ${piece} published this period.\n\nRead it: ${args.dashboardUrl}\n\nThe report covers the full period and compares it with the one before. A space at the end takes your reply. The same page has a PDF download.`,
    })
  },
})

/**
 * Tells someone their free trial is nearly over.
 *
 * The dashboard already carries a banner from ten days out, but a banner only
 * works on someone who logs in, and the people most likely to lose the trial by
 * forgetting it are exactly the ones who have not logged in lately.
 *
 * No countdown urgency and no discount: they either got value from the trial or
 * they did not, and a timer does not change which. It names what they logged,
 * because that is the honest argument for paying.
 */
export const sendTrialEndingSoon = internalAction({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    daysLeft: v.number(),
    entryCount: v.number(),
    clientCount: v.number(),
    billingUrl: v.string(),
  },
  handler: async (_ctx, args): Promise<SendResult> => {
    const greeting = args.firstName ? `Hi ${args.firstName},` : 'Hi,'
    const when =
      args.daysLeft === 1 ? 'tomorrow' : `in ${args.daysLeft} days`

    // An empty trial has nothing to point at, so it gets a different sentence
    // rather than a boast about zero.
    const logged =
      args.entryCount > 0
        ? `You have logged ${args.entryCount} ${args.entryCount === 1 ? 'piece' : 'pieces'} of work across ${args.clientCount} ${args.clientCount === 1 ? 'client' : 'clients'}.`
        : 'You have not logged anything yet, so there is still a version of this worth trying.'

    return await send({
      to: args.email,
      subject: `Your DevRel Studio trial ends ${when}`,
      html: layout(`
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${greeting}</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
          Your free trial ends <strong>${when}</strong>. ${logged}
        </p>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.6;">
          Nothing gets deleted when it ends. Your work stays, and the dashboards
          you gave your clients keep working. You just cannot add new entries
          until you pick a plan.
        </p>
        <p style="margin:0 0 22px;">${button(args.billingUrl, 'Pick a plan')}</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#718096;">
          Payment is by bank transfer, so picking a plan opens an email to us
          rather than a checkout. Reply here if you would rather just ask a
          question first.
        </p>
      `),
      text: `${greeting}\n\nYour free DevRel Studio trial ends ${when}. ${logged}\n\nNothing gets deleted when it ends. Your work stays, and the dashboards you gave your clients keep working. You just cannot add new entries until you pick a plan.\n\nPick a plan: ${args.billingUrl}\n\nPayment is by bank transfer, so picking a plan opens an email to us rather than a checkout. Reply here if you would rather ask a question first.`,
    })
  },
})

/**
 * Tells someone their trial has closed.
 *
 * Sent once, and only within a few days of the date, so it always describes
 * something that just happened. The job of this one is to be clear that their
 * work is safe: an account that reads "trial ended" and assumes deletion is an
 * account that never comes back.
 */
export const sendTrialEnded = internalAction({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    entryCount: v.number(),
    billingUrl: v.string(),
  },
  handler: async (_ctx, args): Promise<SendResult> => {
    const greeting = args.firstName ? `Hi ${args.firstName},` : 'Hi,'
    const kept =
      args.entryCount > 0
        ? `Your ${args.entryCount} ${args.entryCount === 1 ? 'entry is' : 'entries are'} still there, and your client dashboards are still live.`
        : 'Your account is still there whenever you want it.'

    return await send({
      to: args.email,
      subject: 'Your DevRel Studio trial has ended',
      html: layout(`
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${greeting}</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
          Your free trial has ended. ${kept}
        </p>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.6;">
          Adding and editing is paused until you pick a plan. Everything comes
          back the moment you do, exactly as you left it.
        </p>
        <p style="margin:0 0 22px;">${button(args.billingUrl, 'Pick a plan')}</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#718096;">
          If it was not for you, no action is needed and we will stop emailing
          about it. A reply telling us what was missing would help.
        </p>
      `),
      text: `${greeting}\n\nYour free DevRel Studio trial has ended. ${kept}\n\nAdding and editing is paused until you pick a plan. Everything comes back the moment you do, exactly as you left it.\n\nPick a plan: ${args.billingUrl}\n\nIf it was not for you, no action is needed and we will stop emailing about it. A reply telling us what was missing would help.`,
    })
  },
})
