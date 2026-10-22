import Link from 'next/link'
import { Check } from 'lucide-react'
import { Wordmark } from '@/components/brand/wordmark'
import { Shape } from '@/components/marketing/shapes'

/**
 * Shared frame for sign-in and sign-up: a colour panel on the left that says
 * why, a plain paper column on the right that does the one thing the page is
 * for. The panel is hidden below `lg`, where the wordmark moves above the form.
 */
export function AuthShell({
  panelTone,
  headline,
  body,
  points,
  children,
}: {
  panelTone: 'ochre' | 'blue'
  headline: React.ReactNode
  body: string
  points: string[]
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-background p-3 sm:p-4">
      <aside
        className={`relative hidden w-[min(44vw,40rem)] shrink-0 flex-col overflow-hidden rounded-[2.5rem] p-10 text-ink lg:flex xl:p-14 ${
          panelTone === 'ochre' ? 'bg-ochre' : 'bg-blue'
        }`}
      >
        <Wordmark />

        <div className="flex flex-1 flex-col justify-center py-12">
          <h1 className="text-[clamp(2.5rem,4vw,3.6rem)] font-medium leading-[1.02] tracking-[-0.04em]">{headline}</h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/75">{body}</p>
          <ul className="mt-9 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-[15px] text-ink/85">
                <Check className="mt-1 h-4 w-4 shrink-0" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div aria-hidden className="flex items-end gap-2">
          <Shape name="dome" color="orange" className="w-20" />
          <Shape name="square" color="ink" className="w-14" />
          <Shape name="circle" color="paper" className="w-16" />
        </div>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="mb-10 lg:hidden">
          <Wordmark />
        </div>
        <div className="w-full max-w-sm">{children}</div>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
        </p>
      </main>
    </div>
  )
}
