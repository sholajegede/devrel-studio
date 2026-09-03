"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { KindeProvider } from "@kinde-oss/kinde-auth-nextjs";
import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";

// ── Convex client ─────────────────────────────────────────────────────────────
//
// This module is imported by the root layout, so anything thrown here takes the
// entire site down — including `/` and `/pricing`, neither of which
// read from Convex at all. A missing or malformed NEXT_PUBLIC_CONVEX_URL used
// to do exactly that.
//
// Instead we fall back to a syntactically valid host that never resolves. The
// provider mounts, marketing pages render normally, and any `useQuery` stays
// `undefined` — which every caller already handles as its loading state.

const UNCONFIGURED_URL = "https://convex-not-configured.invalid";

function createConvexClient(): ConvexReactClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!url) {
    console.error(
      "[convex] NEXT_PUBLIC_CONVEX_URL is not set. Pages that read data will " +
        "stay in their loading state; marketing pages are unaffected.",
    );
    return new ConvexReactClient(UNCONFIGURED_URL);
  }

  try {
    return new ConvexReactClient(url);
  } catch (error) {
    console.error("[convex] Failed to initialise client for", url, error);
    return new ConvexReactClient(UNCONFIGURED_URL);
  }
}

const convex = createConvexClient();

// Kinde's own endpoint for the current session. The browser client reads it on
// mount; we re-read it directly when Convex asks for a *fresh* token, because
// the hook's in-memory copy is only as new as its last render.
const KINDE_SESSION_ENDPOINT = "/api/auth/setup";

async function fetchFreshIdToken(): Promise<string | null> {
  try {
    const response = await fetch(KINDE_SESSION_ENDPOINT, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) return null;

    const state = await response.json();
    return typeof state?.idTokenRaw === "string" ? state.idTokenRaw : null;
  } catch (error) {
    console.error("[convex] Could not refresh the Kinde session:", error);
    return null;
  }
}

function useAuthFromKinde() {
  const { getIdTokenRaw, isAuthenticated, isLoading } = useKindeBrowserClient();

  // `fetchAccessToken` must keep the same identity for the life of the session.
  //
  // Convex takes it as a dependency of the effect that owns the socket's
  // authentication. A new identity tears that effect down and sets it back up,
  // and the teardown calls `client.clearAuth()` — so between the two, the socket
  // has no verified identity and every mounted query re-runs unauthenticated.
  // Queries that insist on a caller threw there, and a query that throws during
  // render unmounts the route: the dashboard went blank and a reload fixed it,
  // which is exactly why it read as random.
  //
  // Depending on `getIdTokenRaw` did that on most renders. Kinde rebuilds its
  // whole client object — every accessor on it included — each time its own
  // state settles, so the function is a fresh reference nearly every time even
  // though it does the same thing. Reading it through a ref keeps the callback
  // stable while still calling the newest version of it.
  const getIdTokenRawRef = useRef(getIdTokenRaw);
  useEffect(() => {
    getIdTokenRawRef.current = getIdTokenRaw;
  }, [getIdTokenRaw]);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      // Convex sets this when the token it holds is at or near expiry. Handing
      // back the same expired token — which is all `getIdTokenRaw` can do —
      // drops the connection to unauthenticated for the rest of the session.
      if (forceRefreshToken) {
        const refreshed = await fetchFreshIdToken();
        if (refreshed) return refreshed;
      }

      const token = getIdTokenRawRef.current?.();
      return token ?? null;
    },
    []
  );

  return useMemo(
    () => ({
      isLoading: isLoading ?? true,
      isAuthenticated: isAuthenticated ?? false,
      fetchAccessToken,
    }),
    [isLoading, isAuthenticated, fetchAccessToken]
  );
}

function ConvexKindeProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useAuthFromKinde}>
      {children}
    </ConvexProviderWithAuth>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <KindeProvider>
      <ConvexKindeProvider>{children}</ConvexKindeProvider>
    </KindeProvider>
  );
}
