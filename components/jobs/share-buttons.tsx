'use client'

import { useState } from 'react'
import { Check, Link2, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/jobs/track'

export function ShareButtons({ slug, title, company }: { slug: string; title: string; company: string }) {
  const [copied, setCopied] = useState(false)
  const url = () => `${window.location.origin}/jobs/${slug}`

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url())
            track('link_copy', { slug, label: 'copy link button' })
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } catch {
            toast.error('Could not copy the link')
          }
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy link'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Share this role"
        onClick={async () => {
          track('share_click', { slug, label: typeof navigator.share === 'function' ? 'share sheet' : 'x' })
          if (typeof navigator.share === 'function') {
            try {
              await navigator.share({ title: `${title} at ${company}`, url: url() })
            } catch {
              /* closed by the person */
            }
            return
          }
          window.open(`https://x.com/intent/post?text=${encodeURIComponent(`${title} at ${company}`)}&url=${encodeURIComponent(url())}`, '_blank', 'noopener')
        }}
      >
        <Share2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
