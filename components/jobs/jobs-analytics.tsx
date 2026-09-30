'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useConvexAuth } from 'convex/react'
import { flush, setSignedIn, track } from '@/lib/jobs/track'
import { jobSlugFromPath, pathGroup } from '@/lib/jobs/analytics'

const RESERVED_JOB_PATHS = new Set(['salaries', 'companies', 'remote', 'contract', 'roles', 'out', 'feed.xml', 'llms.txt'])

function anchorOf(target: EventTarget | null): HTMLAnchorElement | null {
  return target instanceof Element ? target.closest('a[href]') : null
}

function describe(anchor: HTMLAnchorElement): { kind: 'apply' | 'job' | 'company' | 'kit' | 'cta' | 'outbound' | 'nav' | null; slug?: string; label: string } {
  const url = new URL(anchor.href, window.location.href)
  const parts = url.pathname.split('/').filter(Boolean)
  if (url.host !== window.location.host) return { kind: 'outbound', label: url.host.replace(/^www\./, '') }
  if (parts[0] === 'jobs' && parts[1] === 'out' && parts[2]) return { kind: 'apply', slug: parts[2], label: pathGroup(window.location.pathname) }
  if (parts[0] === 'jobs' && parts[1] === 'companies' && parts[2]) return { kind: 'company', label: parts[2] }
  if (parts[0] === 'jobs' && parts.length === 2 && !RESERVED_JOB_PATHS.has(parts[1])) return { kind: 'job', slug: parts[1], label: pathGroup(window.location.pathname) }
  if (parts[0] === 'dashboard' && parts[1] === 'jobs' && parts[2] === 'kit' && parts[3]) return { kind: 'kit', slug: parts[3], label: pathGroup(window.location.pathname) }
  if (parts[0] === 'sign-up' || parts[0] === 'sign-in') return { kind: 'cta', label: `${parts[0]} from ${pathGroup(window.location.pathname)}` }
  return { kind: 'nav', label: url.pathname }
}

/**
 * Mount once per page tree. Records page views and time on page, and listens
 * for clicks, copies and right clicks, so most of the board is covered without
 * each button having to report itself.
 */
export function JobsAnalytics() {
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useConvexAuth()
  const started = useRef(Date.now())
  const deepest = useRef(0)
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    if (!isLoading) setSignedIn(isAuthenticated)
  }, [isAuthenticated, isLoading])

  const leave = () => {
    const seconds = Math.min(Math.round((Date.now() - started.current) / 1000), 3600)
    if (lastPath.current && seconds >= 1) {
      track('page_leave', { n: seconds, label: `scroll ${deepest.current}%` })
    }
    started.current = Date.now()
  }

  useEffect(() => {
    if (lastPath.current !== null) leave()
    lastPath.current = pathname
    deepest.current = 0
    started.current = Date.now()
    track('page_view', { slug: jobSlugFromPath(pathname) ?? undefined, label: new URLSearchParams(window.location.search).get('utm_source')?.toLowerCase() || undefined })
    if (jobSlugFromPath(pathname)) track('job_view', { slug: jobSlugFromPath(pathname) ?? undefined })
    if (pathname === '/dashboard/jobs/pro') track('pro_view')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max <= 0) return
      const pct = Math.min(100, Math.round(((window.scrollY / max) * 100) / 25) * 25)
      if (pct > deepest.current) deepest.current = pct
    }
    const onClick = (event: MouseEvent) => {
      const anchor = anchorOf(event.target)
      if (!anchor) return
      const info = describe(anchor)
      if (info.kind === 'apply') track('apply_click', { slug: info.slug, label: info.label })
      else if (info.kind === 'job') track('job_open', { slug: info.slug, label: info.label })
      else if (info.kind === 'company') track('company_click', { label: info.label, company: info.label })
      else if (info.kind === 'kit') track('nav_click', { slug: info.slug, label: 'tailor cv' })
      else if (info.kind === 'cta') track('cta_click', { label: info.label })
      else if (info.kind === 'outbound') track('outbound_click', { label: info.label })
      else if (info.kind === 'nav') track('nav_click', { label: info.label })
    }
    const onContext = (event: MouseEvent) => {
      const anchor = anchorOf(event.target)
      if (!anchor) return
      const info = describe(anchor)
      track('link_menu', { slug: info.slug, label: `${info.kind}: ${info.label}` })
    }
    const onCopy = () => {
      const text = window.getSelection()?.toString().trim() ?? ''
      if (!text) return
      if (/^https?:\/\//i.test(text)) {
        let host = 'link'
        try {
          host = new URL(text).host.replace(/^www\./, '')
        } catch {
          /* keep the default */
        }
        track('link_copy', { label: host, slug: jobSlugFromPath(window.location.pathname) ?? undefined })
      } else {
        track('text_copy', { n: text.length, label: pathGroup(window.location.pathname), slug: jobSlugFromPath(window.location.pathname) ?? undefined })
      }
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        leave()
        flush()
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('click', onClick, true)
    document.addEventListener('contextmenu', onContext, true)
    document.addEventListener('copy', onCopy)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('contextmenu', onContext, true)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      leave()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
