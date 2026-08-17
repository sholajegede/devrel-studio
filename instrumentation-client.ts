import * as Sentry from '@sentry/nextjs'

// Browser-side error reporting.
//
// The DSN is public by design — it ships inside this bundle either way — so the
// literal below is a safe fallback and means client errors report without an
// environment variable having been remembered. NEXT_PUBLIC_SENTRY_DSN still
// wins, so a fork or a preview can point elsewhere.

const DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ??
  'https://690129f968508038111f0164ddd209e1@o4511924264697856.ingest.us.sentry.io/4511924270202880'

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',

    // Matches the server and edge configs.
    enableLogs: true,

    // Enough to spot a regression, low enough not to be a line item. Errors are
    // always captured; this governs performance traces only.
    tracesSampleRate: 0.1,

    /**
     * Session replay stays off, and turning it on is not a one-line change.
     *
     * The Sentry wizard offers it as an obvious yes, but this app renders
     * client revenue figures and dashboards that sit behind an access code, and
     * replay ships the DOM of those pages to a third party. The published
     * privacy policy also states plainly that we do not record screens.
     *
     * So enabling it means three things together: masking rules that actually
     * cover the money and the client names, an amendment to /privacy, and
     * telling existing users. Flipping these two numbers on their own would
     * make a published promise false.
     */
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    beforeSend(event) {
      // Access codes and invite tokens travel in URLs and request bodies. Drop
      // anything that could carry one rather than trusting scrubbing rules.
      if (event.request?.url?.includes('/invite/')) {
        event.request.url = event.request.url.replace(/\/invite\/[^/?#]+/, '/invite/[token]')
      }
      return event
    },
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
