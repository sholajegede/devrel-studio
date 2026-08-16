import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { UserX } from 'lucide-react'

export default function PortfolioNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <UserX className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold text-foreground">
          No portfolio here
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          This handle isn&apos;t claimed, or its owner hasn&apos;t published
          anything publicly yet.
        </p>
        <Link href="/" className="mt-6 inline-block">
          <Button variant="outline">Go to devrel.studio</Button>
        </Link>
      </div>
    </div>
  )
}
