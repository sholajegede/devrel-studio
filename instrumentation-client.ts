import * as Sentry from '@sentry/nextjs'

// Browser-side error reporting.
//
// Everything here is a no-op without NEXT_PUBLIC_SENTRY_DSN, which is the state
// in local development and stays the state until a DSN is set in Vercel. That is
// deliberate: monitoring should never be the reason a developer cannot run the
// app, and a half-configured SDK that throws on init is worse than none.

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',

    // Enough to spot a regression, low enough not to be a line item. Errors are
    // always captured; this governs performance traces only.
    tracesSampleRate: 0.1,

    // Session replay is off. This app shows client revenue figures and content
    // behind an access code, and recording those sessions to a third party is
    // not a trade worth making for debugging convenience.
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
