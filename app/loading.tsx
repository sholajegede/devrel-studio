import { FullPageLoader } from '@/components/brand/brand-loader'

/**
 * The fallback wait for every route without a closer one.
 *
 * The dashboard, the admin console, a client subdomain and a portfolio each
 * have their own `loading.tsx`, because each knows whether a shell is already
 * on screen. Everything else — the marketing pages, sign-in, the console's
 * front door, and the invitation page, which is `force-dynamic` and does a
 * Convex round trip plus a session lookup before it can draw anything — had
 * nothing at all, and fell back to showing the previous page until the next one
 * was ready.
 *
 * Full-page, since a route reaching this has no shell of its own yet. The
 * loader's entrance is delayed past the point where a fast navigation resolves,
 * so the static pages under it still draw nothing on the way in.
 */
export default function RootLoading() {
  return <FullPageLoader />
}
