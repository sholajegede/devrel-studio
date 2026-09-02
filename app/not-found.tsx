import { Button } from '@/components/ui/button'
import { siteOrigin } from '@/lib/site'
import { Globe } from 'lucide-react'

// ── An address nobody has claimed ─────────────────────────────────────────────
//
// Every name under devrel.studio resolves, because the wildcard certificate and
// the proxy answer for all of them. That used to mean langfuse.devrel.studio
// served a full dashboard shell with a 200 — for a company that has never heard
// of this product. It implied a relationship that does not exist and left an
// unbounded number of indexable subdomains standing.
//
// Reached by `notFound()` in app/(subdomain)/[subdomain]/layout.tsx when no
// client owns the slug. It lives at the app root because a `notFound()` thrown
// in a layout resolves to the boundary *above* that layout — a not-found file
// beside it, or in the (subdomain) group, is never used. Both were tried.
//
// The address cannot be named here and the copy is written not to need it: the
// root not-found is statically rendered, so `headers()` silently produces an
// empty page, and marking the file 'use client' to read window.location does
// the same. Links go through `siteOrigin()` rather than being relative, because
// a relative href would stay on the subdomain, where proxy.ts rewrites every
// path under the slug — /sign-up would become /langfuse/sign-up, which is not a
// route.

const APEX = siteOrigin()

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <Globe className="mx-auto h-10 w-10 text-muted-foreground" />

        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-foreground">
          This address isn&apos;t claimed
        </h1>

        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          devrel.studio is where a developer relations team publishes the monthly
          performance dashboard for a brand they work with — what shipped, how it did, and
          what is coming next. No dashboard has been set up here.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <a href={`${APEX}/sign-up`}>
            <Button className="w-full sm:w-auto">Claim this address</Button>
          </a>
          <a href={`${APEX}/sign-in`}>
            <Button variant="outline" className="w-full sm:w-auto">
              Sign in
            </Button>
          </a>
        </div>

        {/* The other reader, and the one more likely to be here: a manager who
            was sent this link and is now looking at a page inviting them to sign
            up for something they never asked for. Telling them it is probably
            not their fault costs one line. */}
        <p className="mx-auto mt-10 max-w-md border-t border-border pt-6 text-sm text-muted-foreground">
          Expecting a dashboard here? The link may be mistyped, or whoever prepared it may
          not have published it yet — ask them for the address again.
        </p>

        <p className="mt-6 text-xs text-muted-foreground">
          <a href={APEX} className="underline underline-offset-4 hover:text-foreground">
            {APEX.replace(/^https?:\/\//, '')}
          </a>
        </p>
      </div>
    </div>
  )
}
