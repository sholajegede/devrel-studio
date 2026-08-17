import * as Sentry from '@sentry/nextjs'

/**
 * Server and edge registration hook. Next calls this once per runtime at boot.
 *
 * Each runtime loads its own config rather than sharing one `init` call here:
 * the two take different options — `includeLocalVariables` is Node-only — and
 * importing conditionally keeps Node-only code out of the edge bundle.
 *
 * This replaced an inline `Sentry.init` guarded on `SENTRY_DSN`. The DSN now
 * has a literal fallback inside each config, so reporting no longer depends on
 * an environment variable being remembered.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

/** Captures unhandled errors thrown while rendering a request. */
export const onRequestError = Sentry.captureRequestError
