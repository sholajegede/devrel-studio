"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
} from "react";
import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { Id } from "@/convex/_generated/dataModel";
import PageLoader from "@/components/page-loader";
import { useRouter } from "next/navigation";

interface UserData {
  _id: Id<"users">;
  email: string;
  kindeId: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  imageStorageId?: Id<"_storage">;
  // Public portfolio — see convex/portfolio.ts
  handle?: string;
  bio?: string;
  websiteUrl?: string;
  githubUsername?: string;
  twitterUsername?: string;
  // Billing — see convex/billing.ts
  plan?: string;
  planStatus?: string;
}

type UserContextType = {
  user: ReturnType<typeof useKindeBrowserClient>["user"];
  profile?: UserData;
  setProfile: React.Dispatch<React.SetStateAction<UserData | undefined>>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useKindeBrowserClient();
  const userId = user?.id;

  // Kinde and Convex become authenticated at different moments. Kinde reads its
  // session from a cookie and reports a user almost immediately; Convex only
  // counts as authenticated once `client.setAuth` has run in an effect AND the
  // backend has verified the ID token over the socket. Between those two points
  // the query below would run *unauthenticated*, and an unauthenticated
  // `getCurrentUser` returns null — indistinguishable, from here, from "this
  // account has no profile row".
  //
  // That gap is what bounced people to the homepage. On a fast desktop link it
  // is a few milliseconds and usually loses the race; on mobile it is long
  // enough to win it every time, which is why every dashboard page redirected.
  //
  // So: hold the query until Convex itself says it is authenticated. A null
  // then means what it claims to mean.
  const { isAuthenticated: convexAuthenticated } = useConvexAuth();

  // Resolved from the verified token on the Convex side — no id is sent up.
  const fetchedProfile = useQuery(
    api.users.getCurrentUserProfile,
    convexAuthenticated && userId ? {} : "skip"
  );

  // Answered even when the profile query returns nothing, because a paused
  // account is exactly the case where it does. Without this the screen below
  // would tell somebody who has been locked out that their profile "is not ready
  // yet" and invite them to sign in again — the two states need opposite
  // messages and produce the same null.
  const status = useQuery(
    api.users.accountStatus,
    convexAuthenticated && userId ? {} : "skip"
  );

  const [profile, setProfile] = useState<UserData | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Let go of the profile the moment Convex stops being authenticated.
    //
    // `profile` is React state, so without this it stayed truthy across an auth
    // gap — a token rotating, a socket reconnecting after the laptop woke — and
    // every page in the app gates its queries on `profile?._id`. Those gates
    // stayed open onto an unauthenticated socket, which is how a transient
    // handshake became a page that renders nothing until it is reloaded.
    //
    // Dropping it closes the gates instead: the queries go back to "skip", the
    // pages show their loading state, and both come back on their own when the
    // handshake completes. Nothing is refetched that would not have been.
    if (!convexAuthenticated) {
      setProfile(undefined);
      setError(undefined);
      return;
    }

    if (fetchedProfile === null && userId) {
      setError("Profile not found.");
    } else if (fetchedProfile) {
      setProfile(fetchedProfile as UserData);
      setError(undefined);
    }
  }, [fetchedProfile, convexAuthenticated, userId]);

  if (isLoading) {
    return <PageLoader />;
  }

  // Paused. Said plainly, with the reason the operator wrote and one way to
  // answer it — an account somebody has stopped is not a bug for them to retry
  // their way out of.
  if (status?.paused) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-medium text-foreground">
            This account is paused
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing has been deleted — your content, clients and their dashboards
            are all still here, and everything comes back when the account is
            reopened.
          </p>
          {status.pausedReason && (
            <p className="mt-4 border-l-2 border-border pl-3 text-left text-sm text-muted-foreground">
              {status.pausedReason}
            </p>
          )}

          <div className="mt-6 flex items-center justify-center gap-2">
            <a
              href="mailto:support@devrel.studio"
              className="inline-flex h-10 items-center rounded-lg bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Contact support
            </a>
            <a
              href="/api/auth/logout"
              className="inline-flex h-10 items-center rounded-lg border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Sign out
            </a>
          </div>
        </div>
      </div>
    );
  }

  // A signed-in account with no profile row. Rare, and almost always a signup
  // whose profile has not been written yet.
  //
  // This used to push silently to the homepage, which is indistinguishable from
  // the app being broken — the reader has no idea whether they were signed out,
  // hit a bug, or are simply early. Saying so, and offering the two things that
  // actually resolve it, is the whole fix.
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-medium text-foreground">
            Your profile is not ready yet
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are signed in, but we could not find a profile for this account. If you have
            just signed up this usually clears within a moment.
          </p>

          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center rounded-lg bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex h-10 items-center rounded-lg border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Go home
            </button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Still stuck? Sign out and back in from{" "}
            <a href="/api/auth/logout" className="underline underline-offset-4">
              here
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, profile, setProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}