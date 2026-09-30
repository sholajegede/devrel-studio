'use client'

import { deviceFromWidth, refHost, type EventName } from '@/lib/jobs/analytics'

// The browser side of job board analytics. Events are queued and sent together,
// and whatever is left goes out when the tab is hidden or closed.

interface Queued {
  event: EventName
  path: string
  slug?: string
  company?: string
  label?: string
  n?: number
}

export interface TrackProps {
  slug?: string
  company?: string
  label?: string
  n?: number
}

const VISITOR_KEY = 'devrel-jobs-vid'
const FLUSH_MS = 2000
const MAX_QUEUE = 25

let queue: Queued[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let signedIn = false
let refSent = false
let memoryId: string | null = null

const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`

function visitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY)
    if (existing) return existing
    const made = randomId()
    localStorage.setItem(VISITOR_KEY, made)
    return made
  } catch {
    memoryId ??= randomId()
    return memoryId
  }
}

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem('devrel-jobs-sid')
    if (existing) return existing
    const made = randomId()
    sessionStorage.setItem('devrel-jobs-sid', made)
    return made
  } catch {
    return visitorId()
  }
}

export function setSignedIn(value: boolean) {
  signedIn = value
}

export function flush() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (queue.length === 0 || typeof window === 'undefined') return
  const events = queue
  queue = []
  const ref = !refSent ? refHost(document.referrer, window.location.host) : undefined
  refSent = true
  const body = JSON.stringify({
    visitor: visitorId(),
    session: sessionId(),
    device: deviceFromWidth(window.innerWidth),
    ref,
    signedIn,
    events,
  })
  try {
    void fetch('/api/jobs/track', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => undefined)
  } catch {
    // Dropped. Analytics is never worth an error on the page.
  }
}

export function track(event: EventName, props: TrackProps = {}) {
  if (typeof window === 'undefined') return
  queue.push({ event, path: window.location.pathname, ...props })
  if (queue.length >= MAX_QUEUE) flush()
  else if (!timer) timer = setTimeout(flush, FLUSH_MS)
}
