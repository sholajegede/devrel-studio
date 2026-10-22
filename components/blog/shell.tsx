import { MarketingNav } from '@/components/marketing/nav'
import { MarketingFooter } from '@/components/marketing/footer'

export function BlogShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <main className={`mx-auto px-4 py-10 sm:px-8 sm:py-14 ${wide ? 'max-w-[1600px]' : 'max-w-3xl'}`}>{children}</main>
      <MarketingFooter />
    </div>
  )
}

export const dateLabel = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
