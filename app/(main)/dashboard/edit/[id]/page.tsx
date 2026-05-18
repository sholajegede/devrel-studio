'use client'

import { useParams, useRouter } from 'next/navigation'
import { ContentEntry } from '@/lib/types'
import { ContentForm } from '@/components/dashboard/content-form'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { Loader2 } from 'lucide-react'

export default function EditContentPage() {
  const params = useParams()
  const router = useRouter()

  const entry = useQuery(api.content.getContentById, {
    id: params.id as Id<"contentEntries">
  })

  if (entry === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <div className="text-muted-foreground">Loading content...</div>
        </div>
      </div>
    )
  }

  if (entry === null) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Entry Not Found</h1>
          <p className="text-muted-foreground">The content entry you&apos;re looking for doesn&apos;t exist.</p>
          <button
            type="button"
            onClick={() => router.push('/dashboard/content')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Back to Content
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Edit Entry</h1>
        <p className="text-sm text-muted-foreground mt-1">Update the details for this entry</p>
      </div>
      <ContentForm existingEntry={entry as ContentEntry} onSuccess={() => router.push('/dashboard/content')} />
    </main>
  )
}
