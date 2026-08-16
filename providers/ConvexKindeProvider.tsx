"use client";

import { ReactNode, useCallback, useMemo } from "react";
import { KindeProvider } from "@kinde-oss/kinde-auth-nextjs";
import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";

// ── Convex client ─────────────────────────────────────────────────────────────
//
// This module is imported by the root layout, so anything thrown here takes the
// entire site down — including `/`, `/pricing` and `/waitlist`, none of which
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

function useAuthFromKinde() {
  const { getIdTokenRaw, isAuthenticated, isLoading } = useKindeBrowserClient();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const token = getIdTokenRaw();
      return token ?? null;
    },
    [getIdTokenRaw]
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
