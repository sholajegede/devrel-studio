import * as Sentry from '@sentry/nextjs'

/**
 * Server and edge error reporting.
 *
 * Next calls this once per runtime at boot. Like the client half, it does
 * nothing without a DSN, so local development and CI are unaffected.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? 'development',
    tracesSampleRate: 0.1,
  })
}

export const onRequestError = Sentry.captureRequestError
