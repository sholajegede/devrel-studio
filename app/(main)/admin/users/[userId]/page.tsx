'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { actionLabel, formatAuditTime } from '@/lib/admin-audit'
import type { Id } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  CompDialog,
  GrantDialog,
  RevokeDialog,
  type AdminAccount,
} from '@/components/admin/user-actions'
import { ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react'

// ── One account ───────────────────────────────────────────────────────────────
//
// Everything true about somebody, on one page, with the three things an
// operator can do about it.
//
// The four panels were four Convex dashboard tabs joined in somebody's head:
// what they are entitled to, what they have built, what they have asked for,
// and what has been done to them. The last one is the reason the page exists —
// `accessNote` holds a single overwritable string, so before the audit log
// there was no way to answer "why does this account have access until March".

export default function AdminUserPage() {
  const params = useParams<{ userId: string }>()
  const userId = params.userId as Id<'users'>

  const detail = useQuery(api.adminUsers.userDetail, { userId })
  const role = useQuery(api.admin.myAdminRole)

  const [granting, setGranting] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [comping, setComping] = useState(false)

  if (detail === undefined) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (detail === null) {
    return (
      <Card className="gap-0 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          That account no longer exists.
        </p>
        <Link
          href="/admin/users"
          className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to accounts
        </Link>
      </Card>
    )
  }

  const { account, usage, requests, history } = detail

  // Revoke and comp are owner-only server-side. Hiding them from support is not
  // the guard — `requireAdmin(ctx, 'owner')` is — it just avoids offering
  // somebody a button that will refuse them.
  const isOwner = role === 'owner'

  const target: AdminAccount = {
    id: account.id,
    email: account.email,
    name: account.name,
    state: account.state,
    planName: account.planName,
    accessUntil: account.accessUntil,
    comped: account.comped,
  }

  return (
    <>
      <Link
        href="/admin/users"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Accounts
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">
              {account.name ?? account.email}
            </h1>
            {account.comped && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-600/30 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-400">
                <Sparkles className="h-3 w-3" />
                Comped
              </span>
            )}
            {account.adminRole && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                {account.adminRole}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {account.email}
            {account.handle && (
              <>
                {' · '}
                <Link
                  href={`/@${account.handle}`}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  @{account.handle}
                </Link>
              </>
            )}
            {' · joined '}
            {formatDate(account.createdAt)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" onClick={() => setGranting(true)}>
            Grant access
          </Button>
          {isOwner && (
            <>
              <Button size="sm" variant="outline" onClick={() => setComping(true)}>
                {account.comped ? 'Remove comp' : 'Comp'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRevoking(true)}>
                Revoke
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-0 p-5">
          <h2 className="text-sm font-semibold text-foreground">Access</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="State" value={stateLabel(account)} />
            <Row label="Plan" value={account.planName} />
            <Row
              label="Paid until"
              value={
                account.accessUntil
                  ? `${formatDate(account.accessUntil)}${
                      account.accessUntil > Date.now() ? '' : ' (past)'
                    }`
                  : 'Never granted'
              }
            />
            <Row
              label="Trial ended"
              value={account.trialEndsAt ? formatDate(account.trialEndsAt) : '—'}
            />
            <Row label="Can write" value={account.canWrite ? 'Yes' : 'No'} />
          </dl>
          {account.accessNote && (
            <p className="mt-3 border-l-2 border-border pl-3 text-sm text-muted-foreground">
              {account.accessNote}
            </p>
          )}
          {/* The note is the current one only. Everything before it is below. */}
        </Card>

        <Card className="gap-0 p-5">
          <h2 className="text-sm font-semibold text-foreground">What they have built</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row
              label="Clients"
              value={
                usage.planLimit === null
                  ? `${usage.clients} of unlimited`
                  : `${usage.clients} of ${usage.planLimit}`
              }
            />
            <Row label="Content entries" value={String(usage.entries)} />
            <Row label="Workspaces owned" value={String(usage.workspaces)} />
            <Row label="Workspaces joined" value={String(usage.memberships)} />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Counts only. What is in them belongs to the customer, and reading it is
            not what this console is for.
          </p>
        </Card>
      </div>

      <Card className="mt-4 gap-0 p-5">
        <h2 className="text-sm font-semibold text-foreground">Requests</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            This account has never asked to buy anything.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {requests.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
              >
                <span className="text-foreground">
                  {request.planName} · {request.months === 1 ? '1 month' : `${request.months} months`} ·{' '}
                  {request.currency} {request.amount.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">
                  {request.status} · {formatDate(request.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4 gap-0 p-5">
        <h2 className="text-sm font-semibold text-foreground">History</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Every privileged action taken against this account, newest first. Appended,
          never edited.
        </p>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing has been done to this account through the console.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {history.map((row) => (
              <li key={row.id} className="border-b border-border pb-3 text-sm last:border-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-foreground">{actionLabel(row.action)}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.actorEmail} · {formatAuditTime(row.at)}
                  </span>
                </div>
                {row.reason && (
                  <p className="mt-1 text-sm text-muted-foreground">{row.reason}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {granting && (
        <GrantDialog
          account={target}
          open
          onOpenChange={(open) => !open && setGranting(false)}
        />
      )}
      {revoking && (
        <RevokeDialog
          account={target}
          open
          onOpenChange={(open) => !open && setRevoking(false)}
        />
      )}
      {comping && (
        <CompDialog
          account={target}
          open
          onOpenChange={(open) => !open && setComping(false)}
        />
      )}
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  )
}

/** The state, said the way somebody answering a support email would say it. */
function stateLabel(account: { state: string; daysLeft: number | null }): string {
  if (account.state === 'comped') return 'Comped — everything, no expiry'
  if (account.state === 'active') {
    return account.daysLeft === null
      ? 'Active'
      : `Active · ${account.daysLeft} ${account.daysLeft === 1 ? 'day' : 'days'} left`
  }
  if (account.state === 'trial') return 'On trial'
  return 'No access'
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

