'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ApproveDialog,
  DeclineDialog,
  type PendingRequest,
} from '@/components/admin/request-actions'
import { REQUEST_STATUSES, type RequestStatus } from '@/convex/model/access'
import { AlertTriangle } from 'lucide-react'

// ── The purchase queue ────────────────────────────────────────────────────────
//
// Every request to buy access, and the two buttons that answer one.
//
// Approving used to be two commands typed into a terminal from memory — settle
// the request, then open the window — with nothing joining them. This page
// exists so that pair cannot come apart: one button, one transaction.

type Filter = RequestStatus | 'all'

const FILTERS: Filter[] = ['open', ...REQUEST_STATUSES.filter((s) => s !== 'open'), 'all']

const LABELS: Record<Filter, string> = {
  open: 'Open',
  granted: 'Granted',
  declined: 'Declined',
  cancelled: 'Cancelled',
  all: 'All',
}

export default function AdminRequestsPage() {
  const [filter, setFilter] = useState<Filter>('open')
  const requests = useQuery(api.admin.listRequests, {
    status: filter === 'all' ? undefined : filter,
  })

  const [approving, setApproving] = useState<PendingRequest | null>(null)
  const [declining, setDeclining] = useState<PendingRequest | null>(null)

  const loading = requests === undefined

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Requests</h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? 'Loading…'
              : filter === 'open'
                ? requests.length === 0
                  ? 'Nobody is waiting'
                  : `${requests.length} waiting on you`
                : `${requests.length} ${requests.length === 1 ? 'request' : 'requests'}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={filter === value ? 'secondary' : 'ghost'}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className="h-8 px-3 text-xs"
            >
              {LABELS[value]}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="gap-0 p-5">
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-3 w-32 animate-pulse rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card className="gap-0 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {filter === 'open'
              ? 'No requests are waiting. Anything bought from the pricing page lands here.'
              : `No ${LABELS[filter].toLowerCase()} requests.`}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              onApprove={() => setApproving(request)}
              onDecline={() => setDeclining(request)}
            />
          ))}
        </div>
      )}

      {/* Keyed so reopening on a different request starts from that request's
          own numbers rather than the last one's. */}
      {approving && (
        <ApproveDialog
          key={approving.id}
          request={approving}
          open
          onOpenChange={(open) => !open && setApproving(null)}
        />
      )}
      {declining && (
        <DeclineDialog
          key={declining.id}
          request={declining}
          open
          onOpenChange={(open) => !open && setDeclining(null)}
        />
      )}
    </>
  )
}

type Row = NonNullable<ReturnType<typeof useQuery<typeof api.admin.listRequests>>>[number]

function RequestRow({
  request,
  onApprove,
  onDecline,
}: {
  request: Row
  onApprove: () => void
  onDecline: () => void
}) {
  const open = request.status === 'open'
  const term = request.months === 1 ? '1 month' : `${request.months} months`

  return (
    <Card className="gap-0 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">
              {request.name ?? request.email}
            </span>
            {/* Only once it has been answered. An "Open" chip on every row of a
                queue of open requests is a label that says what the page
                already says, next to the two buttons that say it again. */}
            {!open && <StatusChip status={request.status} />}
          </div>
          {request.name && (
            <p className="mt-0.5 text-sm text-muted-foreground">{request.email}</p>
          )}

          <p className="mt-2 text-sm text-foreground">
            {request.planName} · {term} ·{' '}
            <span className="font-medium">
              {request.currency} {request.amount.toLocaleString()}
            </span>
          </p>

          {request.note && (
            <p className="mt-2 border-l-2 border-border pl-3 text-sm text-muted-foreground">
              {request.note}
            </p>
          )}

          <p className="mt-2 text-xs text-muted-foreground">
            Asked {relativeDate(request.createdAt)} · {accessSummary(request)}
          </p>

          {/* The request holds the account id, so a deleted account is knowable
              before the approve button is pressed rather than after. */}
          {!request.account && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              That account no longer exists — there is nothing to grant.
            </p>
          )}

          {/* The old bug, made visible. `reconcileRequests` finds these from a
              terminal; anything approved from this page can no longer become
              one, but requests settled by hand before it existed can. A
              customer who paid and is locked out is worth a red line on the
              screen somebody actually looks at. */}
          {stranded(request) && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Settled as granted, but this account has no access. Approve was not
              what closed it — grant it by hand.
            </p>
          )}
        </div>

        {open && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="ghost" onClick={onDecline}>
              Decline
            </Button>
            <Button size="sm" onClick={onApprove} disabled={!request.account}>
              Approve
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * A request marked granted whose account cannot write.
 *
 * Only possible for requests closed the old way, with `accessRequests:settle`
 * and no grant behind it. Comped and trial accounts are excluded: neither
 * carries a paid window, and flagging them would cry wolf.
 */
function stranded(request: Row): boolean {
  return request.status === 'granted' && request.account?.state === 'expired'
}

function StatusChip({ status }: { status: RequestStatus }) {
  const tone: Record<RequestStatus, string> = {
    open: 'border-foreground/25 text-foreground',
    granted: 'border-emerald-600/30 text-emerald-700 dark:text-emerald-400',
    declined: 'border-border text-muted-foreground',
    cancelled: 'border-border text-muted-foreground',
  }
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${tone[status]}`}
    >
      {status}
    </span>
  )
}

/** What the requester's account looks like right now, in one clause. */
function accessSummary(request: Row): string {
  if (!request.account) return 'account deleted'
  const { state, planName, until } = request.account
  if (state === 'comped') return 'comped account'
  if (state === 'active') {
    return until
      ? `already on ${planName} until ${new Date(until).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : `already on ${planName}`
  }
  if (state === 'trial') return 'on trial'
  return 'no access'
}

function relativeDate(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
