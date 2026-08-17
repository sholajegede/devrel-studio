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

/** Confirms a waitlist signup. Triggered from `waitlist:addToWaitlist`. */
export const sendWaitlistConfirmation = internalAction({
  args: { email: v.string(), name: v.optional(v.string()) },
  handler: async (_ctx, args): Promise<SendResult> => {
    const greeting = args.name ? `Hi ${args.name},` : 'Hi,'

    return await send({
      to: args.email,
      subject: "You're on the DevRel Studio waitlist",
      html: layout(`
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${greeting}</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
          Thanks for joining the waitlist. We'll email you as soon as your spot opens up — no newsletter, no drip sequence, just the one message.
        </p>
        <p style="margin:0;font-size:15px;line-height:1.6;">
          In the meantime, replying to this email reaches a human if you have questions.
        </p>
      `),
      text: `${greeting}\n\nThanks for joining the DevRel Studio waitlist. We'll email you as soon as your spot opens up — no newsletter, just the one message.\n\nReplying to this email reaches a human if you have questions.`,
    })
  },
})

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
          Create your account to get started. This invitation expires in 14 days.
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
      subject: `${args.clientName} — your ${args.period} report`,
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
          The report covers the full period, compares it with the one before, and has a space
          at the end for your thoughts. You can download it as a PDF from the same page.
        </p>
      `),
      text: `Your ${args.period} report for ${args.clientName} is ready — ${args.publishedCount} ${piece} published this period.\n\nRead it: ${args.dashboardUrl}\n\nThe report covers the full period, compares it with the one before, and has a space at the end for your thoughts. A PDF is available from the same page.`,
    })
  },
})
