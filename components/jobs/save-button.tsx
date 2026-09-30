'use client'

import Link from 'next/link'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/jobs/track'

export function SaveButton({
  jobId,
  label = false,
}: {
  jobId: string
  label?: boolean
}) {
  const { isAuthenticated } = useConvexAuth()
  const applications = useQuery(api.jobBoard.applications, isAuthenticated ? {} : 'skip')
  const save = useMutation(api.jobBoard.saveJob)

  const saved = applications?.some((row) => row.jobId === jobId) ?? false

  if (!isAuthenticated) {
    return (
      <Button asChild variant="outline" size={label ? 'sm' : 'icon-sm'} aria-label="Sign in to save this role">
        <Link href="/sign-up" onClick={() => track('save_signin_click')}>
          <Bookmark className="h-4 w-4" />
          {label && 'Save to tracker'}
        </Link>
      </Button>
    )
  }

  if (saved) {
    return (
      <Button asChild variant="secondary" size={label ? 'sm' : 'icon-sm'} aria-label="Saved. Open tracker">
        <Link href="/dashboard/jobs/tracker">
          <BookmarkCheck className="h-4 w-4 text-accent" />
          {label && 'In your tracker'}
        </Link>
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size={label ? 'sm' : 'icon-sm'}
      aria-label="Save to tracker"
      onClick={async () => {
        try {
          await save({ jobId: jobId as Id<'jobs'> })
          track('save', { label: label ? 'role page' : 'list' })
          toast.success('Saved to your tracker')
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Could not save')
        }
      }}
    >
      <Bookmark className="h-4 w-4" />
      {label && 'Save to tracker'}
    </Button>
  )
}
