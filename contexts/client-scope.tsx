'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

// ── Client scope ──────────────────────────────────────────────────────────────
//
// Which client the whole dashboard is looking at. Every page reads this, so a
// selection made once on the overview still applies on content, pipeline and
// reports.
//
// Kept in the browser rather than on the user record: it is a view preference,
// not data. Persisting it server-side would mean a write on every change and a
// round trip before the first render, to remember something that matters only
// to the tab it was chosen in.

const STORAGE_KEY = 'devrel-client-scope'

export const ALL_CLIENTS = 'all'

interface ClientScope {
  /** A client slug, or ALL_CLIENTS. */
  scope: string
  setScope: (next: string) => void
  clients: { slug: string; name: string }[]
  /** True while the client list is still loading. */
  isLoading: boolean
  /** Filter helper — every page needs the same three lines otherwise. */
  matches: (clientSlug?: string) => boolean
}

const Context = createContext<ClientScope>({
  scope: ALL_CLIENTS,
  setScope: () => {},
  clients: [],
  isLoading: true,
  matches: () => true,
})

export function ClientScopeProvider({ children }: { children: React.ReactNode }) {
  const clientRows = useQuery(api.clients.getClients, {})
  const [scope, setScopeState] = useState<string>(ALL_CLIENTS)

  // Read after mount: localStorage does not exist during server rendering, and
  // seeding state from it directly would be a hydration mismatch.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) setScopeState(stored)
  }, [])

  const clients = useMemo(
    () =>
      (clientRows ?? [])
        .filter((client) => !!client.slug)
        .map((client) => ({ slug: client.slug!, name: client.company || client.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [clientRows],
  )

  // A stored slug can outlive the client it named — deleted, renamed, or
  // belonging to a workspace the user has since left. Falling back to "all" is
  // better than a dashboard that silently shows nothing.
  useEffect(() => {
    if (!clientRows) return
    if (scope === ALL_CLIENTS) return
    if (!clients.some((client) => client.slug === scope)) {
      setScopeState(ALL_CLIENTS)
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [clientRows, clients, scope])

  const setScope = useCallback((next: string) => {
    setScopeState(next)
    if (next === ALL_CLIENTS) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const matches = useCallback(
    (clientSlug?: string) => scope === ALL_CLIENTS || clientSlug === scope,
    [scope],
  )

  return (
    <Context.Provider
      value={{ scope, setScope, clients, isLoading: clientRows === undefined, matches }}
    >
      {children}
    </Context.Provider>
  )
}

export function useClientScope() {
  return useContext(Context)
}
