import { SectionLoader } from '@/components/brand/brand-loader'

/**
 * Shown while a dashboard route is being fetched.
 *
 * There was no `loading.tsx` anywhere in the app before this, which meant a
 * navigation between routes showed the page you were leaving until the next one
 * was ready — nothing acknowledged the click. The sidebar and header live in the
 * layout and stay put; only the content area waits, so this fills that area
 * rather than the viewport.
 *
 * Worth knowing: a `loading.tsx` replaces the outgoing page immediately, which
 * on a fast navigation would be a flash of loader where there used to be
 * content. The loader's own entrance is delayed past the point where most of
 * these resolve, so in practice the quick ones still draw nothing at all.
 */
export default function DashboardLoading() {
  return <SectionLoader className="min-h-[70vh]" />
}
