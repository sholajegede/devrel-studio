import { SectionLoader } from '@/components/brand/brand-loader'

/** As the dashboard's — the console's own chrome stays, the content waits. */
export default function AdminLoading() {
  return <SectionLoader className="min-h-[70vh]" />
}
