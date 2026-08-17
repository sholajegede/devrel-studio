import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // `ignoreBuildErrors` was on, which meant a type error shipped to production
  // silently. `tsc --noEmit` is clean and runs in CI, so the build enforcing it
  // costs nothing and closes the gap between "tests pass" and "deploy is safe".
  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    // Avatars come from whichever identity provider the user signed in with, and
    // portfolio links point at arbitrary hosts, so the allowlist is broad by
    // necessity. Optimisation is still worth having: these are the hosts that
    // actually appear, and anything else falls back to being served as-is.
    remotePatterns: [
      { protocol: 'https', hostname: '**.gravatar.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.kinde.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: '**.convex.cloud' },
    ],
    // A profile picture is never rendered larger than this.
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  serverExternalPackages: ['@react-pdf/renderer'],
}

/**
 * Sentry's build step, applied only once a project exists to point it at.
 *
 * Two things it does that the runtime SDK cannot. It uploads source maps, so a
 * production stack trace names a line in this repository rather than a column
 * in a minified chunk — without it an error report is barely worth reading. And
 * it serves the SDK through `/monitoring` on this domain, so an ad blocker
 * cannot quietly drop the reports; blockers already interfere here, which is
 * how the portfolio page's ERR_BLOCKED_BY_CLIENT turned up.
 *
 * The org and project are now real, so this is unconditional. Source maps are
 * the part that still needs a credential: uploads happen only when
 * SENTRY_AUTH_TOKEN is present, which is a build-time secret and separate from
 * the DSN. Without it the build succeeds and simply uploads nothing.
 */
const SENTRY_ORG = process.env.SENTRY_ORG ?? 'devrel-studio'
const SENTRY_PROJECT = process.env.SENTRY_PROJECT ?? 'javascript-nextjs'

export default withSentryConfig(nextConfig, {
      org: SENTRY_ORG,
      project: SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Widens the set of client files uploaded, which materially improves
      // client-side stack traces.
      widenClientFileUpload: true,
      /**
       * Not Sentry's default of '/monitoring'.
       *
       * The tunnel exists to stop ad blockers dropping error reports, and the
       * default path is itself on their lists: tested in a real browser, a POST
       * to /monitoring with Sentry's query string is blocked outright, while
       * the same request to this path arrives. /api/monitoring is blocked too,
       * so it is the word rather than the prefix.
       *
       * It sits under /api deliberately. proxy.ts lets every non-auth /api path
       * through untouched, so the tunnel cannot be bounced to the sign-in page
       * and needs no entry in the public-route list to maintain.
       */
      tunnelRoute: '/api/client-events',
      silent: !process.env.CI,
    })
