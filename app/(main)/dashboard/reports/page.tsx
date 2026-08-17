'use client'

import { useState } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useUserContext } from '@/contexts/user-context'
import { useWorkspaceRole } from '@/hooks/use-workspace-role'
import { COMMON_TIMEZONES, DEFAULT_SCHEDULE } from '@/lib/schedule'
import { periodLabel } from '@/lib/report'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import PageLoader from '@/components/page-loader'
import { RoleNotice } from '@/components/dashboard/role-notice'
import { toast } from 'sonner'
import { Clock, Loader2, Mail, Send, X } from 'lucide-react'

// ── Report delivery ───────────────────────────────────────────────────────────
//
// Everything about getting a report to a client, in one place: who receives it,
// when it goes, and a way to send any month by hand.
//
// Recipients are deliberately separate from the client record. The billing
// contact and the person who reads the report are often different people, and
// the reader changes when someone leaves — which should not mean editing the
// client's details.

type Schedule = {
  enabled: boolean
  recipients: string[]
  dayOfMonth: number
  hourLocal: number
  timezone: string
  lastSentPeriod: string | null
  lastSentAt: string | null
}

function RecipientList({
  recipients,
  onChange,
  disabled,
}: {
  recipients: string[]
  onChange: (next: string[]) => void
  disabled: boolean
}) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const email = draft.trim().toLowerCase()
    if (!email) return
    if (recipients.includes(email)) {
      setDraft('')
      return
    }
    onChange([...recipients, email])
    setDraft('')
  }

  return (
    <div>
      <Label className="text-xs text-muted-foreground">Sends to</Label>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {recipients.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 py-1 pl-2.5 pr-1.5 text-xs text-foreground"
          >
            {email}
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(recipients.filter((e) => e !== email))}
                aria-label={`Remove ${email}`}
                className="rounded p-0.5 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {recipients.length === 0 && (
          <span className="text-xs text-muted-foreground">Nobody yet</span>
        )}
      </div>

      {!disabled && (
        <div className="mt-2 flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
            placeholder="manager@client.com"
            className="h-9 text-sm"
          />
          <Button type="button" variant="outline" size="sm" onClick={add} className="h-9">
            Add
          </Button>
        </div>
      )}
    </div>
  )
}

function ClientReportCard({
  entry,
}: {
  entry: {
    clientId: Id<'clients'>
    clientName: string
    slug: string
    clientEmail: string | null
    schedule: Schedule | null
    periods: string[]
  }
}) {
  const save = useMutation(api.reports.saveSchedule)
  const send = useAction(api.reports.sendReportsNow)
  const { can } = useWorkspaceRole()

  const initial = entry.schedule ?? {
    ...DEFAULT_SCHEDULE,
    // Seeded from the client record so a first-time setup is one click, not
    // retyping an address the app already knows.
    recipients: entry.clientEmail ? [entry.clientEmail] : [],
    lastSentPeriod: null,
    lastSentAt: null,
  }

  const [enabled, setEnabled] = useState(initial.enabled)
  const [recipients, setRecipients] = useState<string[]>(initial.recipients)
  const [dayOfMonth, setDayOfMonth] = useState(String(initial.dayOfMonth))
  const [hourLocal, setHourLocal] = useState(String(initial.hourLocal))
  const [timezone, setTimezone] = useState(initial.timezone)
  const [saving, setSaving] = useState(false)

  const [selected, setSelected] = useState<string[]>([])
  const [sending, setSending] = useState(false)

  const readOnly = !can.manageAccess

  const persist = async (overrides: Partial<Schedule> = {}) => {
    setSaving(true)
    try {
      await save({
        clientId: entry.clientId,
        enabled: overrides.enabled ?? enabled,
        recipients: overrides.recipients ?? recipients,
        dayOfMonth: Number(overrides.dayOfMonth ?? dayOfMonth),
        hourLocal: Number(overrides.hourLocal ?? hourLocal),
        timezone: overrides.timezone ?? timezone,
      })
      toast.success('Schedule saved')
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'data' in error && typeof error.data === 'string'
          ? error.data
          : 'Could not save that schedule'
      toast.error(message)
      // Put the switch back rather than leaving the UI claiming something the
      // server refused.
      if (overrides.enabled !== undefined) setEnabled(!overrides.enabled)
    } finally {
      setSaving(false)
    }
  }

  const sendNow = async (periods: string[]) => {
    if (periods.length === 0) return

    setSending(true)
    try {
      const result = await send({ clientId: entry.clientId, periods })

      if (result.sent > 0) {
        toast.success(
          `Sent ${result.sent} ${result.sent === 1 ? 'email' : 'emails'}` +
            (result.skipped.length ? ` · ${result.skipped.length} skipped` : ''),
        )
      } else {
        toast.warning(
          result.skipped[0] ? `Nothing sent — ${result.skipped[0]}` : 'Nothing was sent',
        )
      }

      setSelected([])
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'data' in error && typeof error.data === 'string'
          ? error.data
          : 'Could not send that report'
      toast.error(message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-medium text-foreground">{entry.clientName}</h2>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{entry.slug}</p>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs text-muted-foreground">
              {enabled ? 'Scheduled' : 'Manual only'}
            </span>
            <Switch
              checked={enabled}
              disabled={readOnly || saving}
              onCheckedChange={(next) => {
                setEnabled(next)
                void persist({ enabled: next })
              }}
            />
          </div>
        </div>

        {/* Schedule */}
        <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
          <div>
            <Label className="text-xs text-muted-foreground">Day of month</Label>
            <Select value={dayOfMonth} onValueChange={setDayOfMonth} disabled={readOnly}>
              <SelectTrigger className="mt-2 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((day) => (
                  <SelectItem key={day} value={day}>{day}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Hour</Label>
            <Select value={hourLocal} onValueChange={setHourLocal} disabled={readOnly}>
              <SelectTrigger className="mt-2 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => String(i)).map((hour) => (
                  <SelectItem key={hour} value={hour}>
                    {hour.padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone} disabled={readOnly}>
              <SelectTrigger className="mt-2 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>{zone.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-5">
          <RecipientList
            recipients={recipients}
            onChange={setRecipients}
            disabled={readOnly}
          />
        </div>

        {!readOnly && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => persist()} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save schedule
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {enabled
                ? `Sends the ${dayOfMonth}${ordinal(Number(dayOfMonth))} at ${hourLocal.padStart(2, '0')}:00 ${timezone}, covering the month just ended`
                : 'Turn on to send automatically'}
            </p>
          </div>
        )}

        {entry.schedule?.lastSentPeriod && (
          <p className="mt-3 text-xs text-muted-foreground">
            Last sent: {periodLabel(entry.schedule.lastSentPeriod)}
            {entry.schedule.lastSentAt &&
              ` on ${new Date(entry.schedule.lastSentAt).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}`}
          </p>
        )}

        {/* Manual send */}
        <div className="mt-6 border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">Send by hand</Label>
            {entry.periods.length > 0 && !readOnly && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(entry.periods)}
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Select all
                </button>
                {selected.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelected([])}
                    className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {entry.periods.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Nothing published yet, so there is no period to report on.
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {entry.periods.map((period) => {
                  const on = selected.includes(period)
                  return (
                    <button
                      key={period}
                      type="button"
                      disabled={readOnly}
                      aria-pressed={on}
                      onClick={() =>
                        setSelected(
                          on
                            ? selected.filter((p) => p !== period)
                            : [...selected, period],
                        )
                      }
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        on
                          ? 'border-accent bg-accent text-accent-foreground'
                          : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                      }`}
                    >
                      {periodLabel(period)}
                    </button>
                  )
                })}
              </div>

              {!readOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendNow(selected)}
                  disabled={sending || selected.length === 0}
                  className="mt-3 gap-1.5"
                >
                  {sending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Send {selected.length || ''}{' '}
                  {selected.length === 1 ? 'report' : 'reports'} now
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th'
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
}

export default function ReportsPage() {
  const { profile } = useUserContext()
  const schedules = useQuery(api.reports.listSchedules, profile?._id ? {} : 'skip')

  if (!profile || schedules === undefined) return <PageLoader />

  return (
    <main className="px-6 lg:px-10 py-8 max-w-400">
      <RoleNotice />

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who receives each client&apos;s monthly report, when it goes out, and a way to send
          any month by hand.
        </p>
      </div>

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Mail className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Reports are sent per client, and none of your clients has a dashboard slug yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {schedules.map((entry) => (
            <ClientReportCard key={entry.clientId} entry={entry} />
          ))}
        </div>
      )}
    </main>
  )
}
