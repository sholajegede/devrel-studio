'use client'

import { useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { ImagePlus, Loader2, X } from 'lucide-react'

// ── Uploading a client's logo ─────────────────────────────────────────────────
//
// Held rather than linked. A hotlinked logo is a standing dependency on somebody
// else's server staying up and their path staying put, and the first time it
// fails is on the dashboard a customer is showing their manager — which is the
// worst possible moment and the one nobody is watching for.
//
// Three steps, which is how Convex storage works: ask for a one-time address,
// PUT the file at it, and hand the resulting id back to the form. The id is only
// attached to the client when the form is saved, so choosing a logo and then
// cancelling leaves the client exactly as it was.

const MAX_BYTES = 2 * 1024 * 1024
const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif'

export function LogoField({
  storageId,
  onChange,
}: {
  storageId: string
  onChange: (storageId: string) => void
}) {
  const generateUploadUrl = useMutation(api.clients.generateLogoUploadUrl)
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // What is currently set, so the field shows the logo rather than describing
  // it. Skipped entirely when there is nothing to resolve.
  const current = useQuery(
    api.clients.logoUrlFor,
    storageId ? { storageId: storageId as Id<'_storage'> } : 'skip',
  )

  async function upload(file: File) {
    // Checked here as well as on the server: the server check is the one that
    // counts, but making somebody wait for a 3 MB upload before being told it is
    // too big is a slow way to say no.
    if (file.size > MAX_BYTES) {
      toast.error('That image is over 2 MB — a logo should be well under it')
      return
    }

    setUploading(true)
    try {
      const url = await generateUploadUrl({})
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!response.ok) throw new Error('upload failed')

      const { storageId: uploaded } = (await response.json()) as { storageId: string }
      onChange(uploaded)
      toast.success('Logo uploaded — save the client to apply it')
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? String(error.data)
          : 'That upload did not work — try again.',
      )
    } finally {
      setUploading(false)
      // Cleared so choosing the same file twice still fires a change event.
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={input}
        id="logo"
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
      />

      {/* The logo itself, at the size it will actually appear. A preview that
          flatters the file is a preview that lies about the header. */}
      {storageId && current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current}
          alt="Client logo"
          className="h-9 max-w-[120px] rounded border border-border bg-muted/40 object-contain p-1"
        />
      ) : (
        <div className="flex h-9 w-[120px] items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">
          {storageId ? 'Loading…' : 'No logo'}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => input.current?.click()}
        className="gap-1.5"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ImagePlus className="h-3.5 w-3.5" />
        )}
        {storageId ? 'Replace' : 'Upload'}
      </Button>

      {storageId && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={uploading}
          onClick={() => onChange('')}
          className="gap-1.5 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Remove
        </Button>
      )}
    </div>
  )
}
