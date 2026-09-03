import { FullPageLoader } from '@/components/brand/brand-loader'

/**
 * A client dashboard, resolving.
 *
 * The layout for this route is an async server component that asks Convex who
 * owns the subdomain and whether this visitor is through the access gate,
 * before anything at all can be drawn. That is a real round trip on a page
 * whose readers are the DevRel's clients, and it had nothing to show during it.
 *
 * Full-page rather than a section, because at this point there is no shell yet —
 * the layout that would provide one is what we are waiting for. The mark is the
 * right one to show: the gate this resolves into is DevRel Studio branded too.
 */
export default function SubdomainLoading() {
  return <FullPageLoader />
}
