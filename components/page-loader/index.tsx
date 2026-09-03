import { FullPageLoader } from '@/components/brand/brand-loader'

/**
 * Kept as the default export it has always been.
 *
 * Six pages and the user context already render `<PageLoader />`, and the point
 * of the change is what a wait looks like, not what it is called. Rewiring the
 * inside means every one of them switches over without a diff of its own, and
 * without the risk that comes with editing seven files to do one thing.
 */
const PageLoader = () => <FullPageLoader />

export default PageLoader
