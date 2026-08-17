// Edge runtime error reporting: middleware and any edge route.
// Loaded by instrumentation.ts on boot.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

// Same reasoning as sentry.server.config.ts: the DSN is public by design, the
// env var wins when set.
const DSN =
  process.env.SENTRY_DSN ??
  'https://690129f968508038111f0164ddd209e1@o4511924264697856.ingest.us.sentry.io/4511924270202880'

Sentry.init({
  dsn: DSN,
  environment: process.env.VERCEL_ENV ?? 'development',

  // A tenth in production, for the reason given in the server config.
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.1,

  enableLogs: true,

  // `includeLocalVariables` is deliberately absent: it is a Node-only option
  // and does nothing on the edge runtime.

  dataCollection: {},
})
