// Server runtime error reporting. Loaded by instrumentation.ts on boot.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

/**
 * The DSN is not a secret — it ships in the client bundle by design — so the
 * literal is a safe fallback and keeps reporting working if the env var is ever
 * missing. SENTRY_DSN still wins, which is what lets a preview deployment or a
 * fork point somewhere else without editing code.
 */
const DSN =
  process.env.SENTRY_DSN ??
  'https://690129f968508038111f0164ddd209e1@o4511924264697856.ingest.us.sentry.io/4511924270202880'

Sentry.init({
  dsn: DSN,
  environment: process.env.VERCEL_ENV ?? 'development',

  /**
   * The wizard leaves this at 1, which traces every single request. Errors are
   * always captured regardless; this governs performance traces only, and at
   * full rate a busy day would spend the free tier's quota on data nobody
   * reads. A tenth is enough to see a regression in a trend.
   */
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.1,

  enableLogs: true,

  // Attaches local variable values to stack frames, which is most of the
  // difference between "TypeError on line 41" and knowing which record did it.
  includeLocalVariables: true,

  // Left at the SDK's conservative default: no user info, no request bodies.
  // Bodies here carry access codes and invite tokens, and those should not
  // leave the building even to a service we trust.
  dataCollection: {},
})
