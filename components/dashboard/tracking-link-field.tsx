'use client'

import { useState } from 'react'
import { Check, Copy, Download, Link2, Wand2 } from 'lucide-react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  checkTrackingLink,
  isConfigured,
  placementLinksFor,
  trackingLinkFor,
  type TrackableEntry,
  type TrackingProgram,
} from '@/lib/tracking'

// The tracking link part of the entry form.
//
// Written, video and podcast entries hold one link in the entry, which the
// person pastes into the piece. Events get one link for the slides. Packages and
// demos hold none: their links go on GitHub, npm and the demo site, so the form
// shows those ready to copy instead of a field.

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
      <span className="w-28 shrink-0 text-xs text-muted-foreground">{label}</span>
      <code className="flex-1 truncate font-mono text-xs text-foreground" title={value}>
        {value}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 px-2"
        onClick={async () => {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  )
}

/** Save a QR code for the link, as PNG for slides or SVG for print. */
async function downloadQr(link: string, name: string, format: 'png' | 'svg') {
  const options = { margin: 2, errorCorrectionLevel: 'M' as const, color: { dark: '#111111', light: '#ffffff' } }
  const href =
    format === 'png'
      ? await QRCode.toDataURL(link, { ...options, width: 1024 })
      : URL.createObjectURL(new Blob([await QRCode.toString(link, { ...options, type: 'svg' })], { type: 'image/svg+xml' }))
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = `${name}-qr.${format}`
  anchor.click()
  if (format === 'svg') URL.revokeObjectURL(href)
}

const STATUS_TEXT: Record<string, string> = {
  correct: 'Matches the agreed format.',
  missing: 'No tracking link yet.',
}

export function TrackingLinkField({
  entry,
  program,
  brand,
  value,
  onChange,
}: {
  entry: TrackableEntry
  program: TrackingProgram | null
  /** The client's name, used as the link text in README snippets. */
  brand: string
  value: string
  onChange: (value: string) => void
}) {
  const category = entry.category ?? 'Written'
  const configured = isConfigured(program)

  const setupHint = (
    <p className="text-xs text-muted-foreground">
      Add a tracking base and campaign to this client to make links for it.
    </p>
  )

  // ── Packages and demos: ready links, no field ─────────────────────────────
  if (category === 'Package' || category === 'Demo') {
    const links = placementLinksFor(entry, program, brand)
    return (
      <div className="space-y-2 md:col-span-2">
        <Label className="flex items-center gap-2 text-foreground">
          <Link2 className="h-4 w-4 text-primary" />
          Tracking links
        </Label>
        {!configured ? (
          setupHint
        ) : links.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {category === 'Package' ? 'Add the package name' : 'Add the GitHub repo'} to make the links.
          </p>
        ) : (
          <>
            {links.map((link) => (
              <CopyRow key={link.placement} label={link.label} value={link.url} />
            ))}
            <CopyRow label="README line" value={links[0].markdown} />
            <p className="text-xs text-muted-foreground">
              Put each link where it says, so the client can tell which place sent the visit.
            </p>
          </>
        )}
      </div>
    )
  }

  // ── Events: one link for the slides ───────────────────────────────────────
  if (category === 'Event') {
    const link = trackingLinkFor(entry, program)
    return (
      <div className="space-y-2 md:col-span-2">
        <Label className="flex items-center gap-2 text-foreground">
          <Link2 className="h-4 w-4 text-primary" />
          Tracking link for your slides
        </Label>
        {!configured ? (
          setupHint
        ) : link ? (
          <>
            <CopyRow label="Slides" value={link} />
            <div className="flex flex-wrap items-center gap-2">
              {(['png', 'svg'] as const).map((format) => (
                <Button
                  key={format}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 bg-transparent"
                  onClick={() => downloadQr(link, new URL(link).searchParams.get('utm_content') ?? 'event', format)}
                >
                  <Download className="h-3.5 w-3.5" />
                  QR code ({format.toUpperCase()})
                </Button>
              ))}
              <span className="text-xs text-muted-foreground">
                Put the link or the QR code on your last slide, so sign-ups from the talk are counted.
              </span>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Add the event name to make the link.</p>
        )}
      </div>
    )
  }

  // ── Written, video and podcasts: an editable field ────────────────────────
  const generated = trackingLinkFor(entry, program)
  const check = checkTrackingLink({ ...entry, trackingLink: value }, program)
  const noLinkAllowed = configured && !generated && check.status === 'not_applicable'

  return (
    <div className="space-y-2 md:col-span-2">
      <Label htmlFor="trackingLink" className="flex items-center gap-2 text-foreground">
        <Link2 className="h-4 w-4 text-primary" />
        Tracking Link (UTM)
      </Label>
      {noLinkAllowed ? (
        <p className="text-xs text-muted-foreground">
          This platform does not allow promotional links, so this entry has no tracking link.
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <Input
              id="trackingLink"
              type="url"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={configured ? 'Select Generate, or paste a link' : 'https://...'}
              className="bg-input border-border text-foreground font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={!generated}
              onClick={() => generated && onChange(generated)}
              title={generated ? generated : 'Select a client and platform first'}
            >
              <Wand2 className="mr-1.5 h-4 w-4" />
              Generate
            </Button>
          </div>
          {!configured ? (
            setupHint
          ) : (
            <p
              className={
                check.status === 'correct'
                  ? 'text-xs text-emerald-600'
                  : check.status === 'missing'
                    ? 'text-xs text-muted-foreground'
                    : 'text-xs text-amber-600'
              }
            >
              {STATUS_TEXT[check.status] ?? check.reason}
            </p>
          )}
        </>
      )}
    </div>
  )
}
