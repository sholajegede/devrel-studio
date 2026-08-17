'use client'

import { useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { CSV_TEMPLATE, parseCsv, type ParseResult } from '@/lib/csv-import'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { AlertCircle, Check, FileUp, Loader2, Upload } from 'lucide-react'

/**
 * CSV import.
 *
 * Deliberately two steps. Parsing is instant and local, so the user sees exactly
 * what will be created — and which rows will not be — before anything is
 * written. An import that silently drops four rows out of two hundred is worse
 * than one that refuses, and you only find out months later when a report is
 * short.
 */
export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const importContent = useMutation(api.content.importContent)
  const fileInput = useRef<HTMLInputElement>(null)

  const [result, setResult] = useState<ParseResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const reset = () => {
    setResult(null)
    setFileName(null)
  }

  const readFile = async (file: File) => {
    const text = await file.text()
    setFileName(file.name)
    setResult(parseCsv(text))
  }

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'devrel-studio-import-template.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const runImport = async () => {
    if (!result?.rows.length) return

    setImporting(true)
    try {
      // `line` is for the preview only — it is not part of an entry.
      const entries = result.rows.map(({ line, ...row }) => ({
        client: row.client,
        category: row.category,
        title: row.title,
        link: row.link,
        trackingLink: row.trackingLink,
        platform: row.platform,
        publicationDate: row.publicationDate,
        status: row.status as 'Published' | 'Draft' | 'Waiting Approval' | 'Scheduled',
        views: row.views,
        tags: row.tags,
        contentType: row.contentType,
        notes: row.notes,
        downloads: row.downloads,
        attendees: row.attendees,
        stars: row.stars,
        packageName: row.packageName,
        eventName: row.eventName,
        podcastName: row.podcastName,
        repoUrl: row.repoUrl,
      }))

      const { inserted } = await importContent({ entries })
      toast.success(`Imported ${inserted} ${inserted === 1 ? 'entry' : 'entries'}`)
      reset()
      onOpenChange(false)
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'data' in error && typeof error.data === 'string'
          ? error.data
          : 'Could not import that file'
      toast.error(message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Import from CSV
          </DialogTitle>
          <DialogDescription>
            Bring in a back catalogue rather than typing it. Any column order works.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center transition-colors hover:border-accent/50 hover:bg-muted/40"
            >
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Choose a CSV file</span>
              <span className="text-xs text-muted-foreground">
                Title, category and date are required. Everything else is optional.
              </span>
            </button>

            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void readFile(file)
                event.target.value = ''
              }}
            />

            <p className="text-xs text-muted-foreground">
              Not sure of the shape?{' '}
              <button
                type="button"
                onClick={downloadTemplate}
                className="text-foreground underline underline-offset-4 hover:text-accent"
              >
                Download a template
              </button>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium text-foreground">{fileName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{result.rows.length}</span>{' '}
                {result.rows.length === 1 ? 'entry' : 'entries'} ready to import
                {result.errors.length > 0 && (
                  <>
                    {' · '}
                    <span className="text-amber-700 dark:text-amber-300">
                      {result.errors.length} skipped
                    </span>
                  </>
                )}
              </p>
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                  <AlertCircle className="h-3.5 w-3.5" />
                  These rows will not be imported
                </p>
                <ul className="mt-2 space-y-1">
                  {result.errors.map((error) => (
                    <li
                      key={error.line}
                      className="text-xs text-amber-900/80 dark:text-amber-200/80"
                    >
                      Line {error.line}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.ignoredColumns.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Columns not recognised and left out: {result.ignoredColumns.join(', ')}
              </p>
            )}

            {result.rows.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                {result.rows.slice(0, 20).map((row) => (
                  <div
                    key={row.line}
                    className="flex items-center gap-3 border-b border-border px-3 py-2 text-xs last:border-b-0"
                  >
                    <Check className="h-3 w-3 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1 truncate text-foreground">{row.title}</span>
                    <span className="shrink-0 text-muted-foreground">{row.category}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {row.publicationDate}
                    </span>
                  </div>
                ))}
                {result.rows.length > 20 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    …and {result.rows.length - 20} more
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={reset} disabled={importing}>
                Choose another file
              </Button>
              <Button
                size="sm"
                onClick={runImport}
                disabled={importing || result.rows.length === 0}
                className="gap-1.5"
              >
                {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Import {result.rows.length}{' '}
                {result.rows.length === 1 ? 'entry' : 'entries'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
