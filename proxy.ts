import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";
import { NextResponse, NextRequest, NextFetchEvent } from 'next/server';
import { adminHostFor, isAdminHost, isReservedSubdomain } from '@/lib/naming';
import {
  callerCountry,
  callerIp,
  hashSessionTokenEdge,
  isBot,
  isTrackablePath,
  normaliseRoute,
  referrerHost,
  visitorHashEdge,
} from '@/lib/view-tracking';

// ─────────────────────────────────────────────
// Route matching
// ─────────────────────────────────────────────

const publicRoutes = [
  '/',
  '/contact(.*)',
  '/pricing(.*)',
  '/privacy(.*)',
  '/terms(.*)',
  '/demo(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/auth(.*)',
  // Public portfolios — /@handle, and the internal path it rewrites to
  '/@(.*)',
  '/portfolio(.*)',
  // Invitation links are opened by people who do not have an account yet — the
  // page renders a sign-in prompt itself rather than being bounced by Kinde,
  // which would lose the token from the URL.
  '/invite(.*)',
  // Sentry's tunnel needs no entry here: it is set to /api/client-events in
  // next.config.mjs, and the check below lets every non-auth /api path through
  // before this list is consulted.
  // Crawler-facing files. These are generated routes rather than files in
  // /public, so they pass through this proxy — without them a crawler asking
  // for the sitemap gets bounced to the Kinde sign-in page.
  '/robots.txt',
  '/sitemap.xml',
];

const createRouteMatcher = (routes: string[]) => {
  return (req: NextRequest) => {
    const pathname = req.nextUrl.pathname;
    return routes.some(route => {
      const regex = new RegExp(`^${route.replace(/\(.*\)/g, '.*')}$`);
      return regex.test(pathname);
    });
  };
};

const isPublicRoute = createRouteMatcher(publicRoutes);

// ─────────────────────────────────────────────
// Subdomain detection
// ─────────────────────────────────────────────

// The list lives in lib/naming.ts, shared with the Convex function that decides
// whether a slug may be claimed. Two copies drifted apart before: a slug Convex
// allowed but the proxy reserved produced a dashboard that could be created and
// then never reached, with nothing on screen to explain it.

/**
 * Whether a host is a reserved subdomain that should not resolve at all.
 *
 * `getSubdomain` returns null for these, which previously meant they fell
 * through and rendered the marketing site — so demo.devrel.studio quietly
 * served the landing page. A name that is not a client dashboard and not the
 * apex should be a 404, not a second copy of the homepage.
 *
 * `www` is the exception: it is the canonical host.
 */
const isDeadSubdomain = (hostname: string): boolean => {
  const parts = hostname.split('.');
  const isLocal = hostname.includes('localhost');

  if (isLocal ? parts.length < 2 || parts[0] === 'localhost' : parts.length < 3) {
    return false;
  }

  const candidate = parts[0];
  return candidate !== 'www' && isReservedSubdomain(candidate);
};

// ─────────────────────────────────────────────
// Client-owned domains
// ─────────────────────────────────────────────
//
// reports.acme.com, pointed here by the client, serving that client's dashboard.
//
// The proxy has no database, so an unrecognised host costs one lookup against a
// Convex HTTP endpoint. That only ever happens for a host which is neither the
// apex, nor a subdomain of it, nor the console — which is to say, only for hosts
// that are custom domains or nothing at all.
//
// Answers are held in module scope. A middleware isolate serves many requests,
// so the first request on a domain pays for the lookup and the rest do not; a
// negative answer is cached too, and for less time, so a domain being set up
// starts working within the minute without letting a typo cost a lookup on
// every request forever.

const DOMAIN_TTL_MS = 5 * 60 * 1000;
const DOMAIN_MISS_TTL_MS = 60 * 1000;

const domainCache = new Map<string, { slug: string | null; at: number }>();

const resolveCustomDomain = async (hostname: string): Promise<string | null> => {
  const cached = domainCache.get(hostname);
  const ttl = cached?.slug ? DOMAIN_TTL_MS : DOMAIN_MISS_TTL_MS;
  if (cached && Date.now() - cached.at < ttl) return cached.slug;

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return null;

  try {
    // Convex HTTP actions answer on .convex.site, not the .convex.cloud origin
    // the browser client uses.
    const endpoint = `${convexUrl.replace('.convex.cloud', '.convex.site')}/resolve-domain?host=${encodeURIComponent(hostname)}`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(2000) });
    const slug = response.ok ? ((await response.json())?.slug ?? null) : null;

    domainCache.set(hostname, { slug, at: Date.now() });
    return slug;
  } catch {
    // A lookup that fails must not take the request with it. The host falls
    // through to the 404 it would have got before custom domains existed.
    domainCache.set(hostname, { slug: null, at: Date.now() });
    return null;
  }
};

/** Whether this host is one the product already knows how to route. */
const isKnownHost = (hostname: string): boolean => {
  const bare = hostname.split(':')[0];
  return (
    bare === 'localhost' ||
    bare.endsWith('.localhost') ||
    bare.endsWith('devrel.studio') ||
    bare.endsWith('.vercel.app')
  );
};

// ─────────────────────────────────────────────
// The admin host
// ─────────────────────────────────────────────
//
// admin.devrel.studio is its own origin for the console, and the only entrance
// to it. Being a separate origin is the point: local storage, cookies scoped to
// the host, and any edge rule the platform grows later all stop at the boundary
// rather than being shared with the product every customer uses.
//
// It is not the security boundary. Every query and mutation behind these pages
// still resolves the caller through `requireAdmin` server-side, because a host
// check is a check the network can be lied to about and a Convex guard is not.
//
// `admin` has been reserved in lib/naming.ts since before this existed, so no
// client could ever have claimed the name.

/**
 * Everything on the admin host lives under /admin internally.
 *
 * The routes were built at /admin and stay there: one set of pages, reachable
 * at one address. The rewrite is what makes admin.devrel.studio/users and
 * /admin/users the same page without maintaining two route trees.
 */
const handleAdminHost = async (
  req: NextRequest,
): Promise<NextResponse> => {
  const url = req.nextUrl.clone();
  const { pathname } = url;

  // Auth callbacks, static assets and API routes are addressed as themselves.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // The way in. Deliberately public: somebody arriving here is by definition
  // not signed in yet, and bouncing them to the product's sign-in page on
  // another origin is how an admin ends up signed in to the wrong thing.
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // Everything else needs a Kinde session before it is worth rewriting. The
  // console's own layout then decides whether this account is an *admin*, and
  // renders the same nothing as any unknown URL if it is not — so this gate
  // answers "signed in", never "allowed".
  //
  // `withAuth` hands back a redirect to the sign-in flow when there is no
  // session, and a pass-through when there is.
  const gate = (await (withAuth as unknown as (
    request: NextRequest,
  ) => Promise<NextResponse>)(req)) as NextResponse | undefined;

  if (gate && gate.status >= 300 && gate.status < 400) {
    // Kinde's own redirect starts the flow on the product's origin, which means
    // somebody who typed the console's address lands on a sign-in page belonging
    // to something else. Send them to the console's front door instead — it is
    // one click, on the host they asked for, and it is the page that knows to
    // come back here afterwards.
    const login = url.clone();
    login.pathname = '/login';
    login.search = '';
    return NextResponse.redirect(login);
  }

  if (pathname === '/' || pathname === '') {
    url.pathname = '/admin';
    return NextResponse.rewrite(url);
  }

  if (!pathname.startsWith('/admin')) {
    url.pathname = `/admin${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
};

const getSubdomain = (hostname: string): string | null => {
  const parts = hostname.split('.');

  // Local development: kinde.localhost:3000
  if (hostname.includes('localhost')) {
    if (parts.length >= 2 && parts[0] !== 'localhost') {
      const subdomain = parts[0];
      return isReservedSubdomain(subdomain) ? null : subdomain;
    }
    return null;
  }

  // Production: kinde.devrel.studio
  if (parts.length >= 3) {
    const subdomain = parts[0];
    return isReservedSubdomain(subdomain) ? null : subdomain;
  }

  return null;
};

const handleSubdomainRewrite = (
  subdomain: string,
  req: NextRequest
): NextResponse => {
  const url = req.nextUrl.clone();

  // Static assets and auth routes pass straight through
  if (url.pathname.startsWith('/_next') ||
      url.pathname.startsWith('/images') ||
      url.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  if (url.pathname === '/') {
    const rewriteUrl = url.clone();
    rewriteUrl.pathname = `/${subdomain}`;
    return NextResponse.rewrite(rewriteUrl);
  }

  if (!url.pathname.startsWith(`/${subdomain}/`)) {
    const rewriteUrl = url.clone();
    rewriteUrl.pathname = `/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(rewriteUrl);
  }

  return NextResponse.next();
};

// ─────────────────────────────────────────────
// View tracking
// ─────────────────────────────────────────────
//
// Both public surfaces are counted from here.
//
// For portfolios that is a choice — the page could count its own views — but
// for client dashboards it is the only option, and a good one: the proxy runs
// before the ISR cache, so a portfolio served from cache is still counted,
// which a server component in the page never could be.
//
// Nothing here is awaited by the request. `event.waitUntil` keeps the runtime
// alive for the POST after the response has already gone out, so tracking adds
// no latency to any page.

/** Which surface a request is for, or null when it is not a tracked one. */
function trackingTarget(
  req: NextRequest,
  subdomain: string | null,
): { surface: 'dashboard' | 'portfolio' | 'site'; target: string; path: string } | null {
  const pathname = req.nextUrl.pathname;
  if (!isTrackablePath(pathname)) return null;

  if (subdomain) {
    return { surface: 'dashboard', target: subdomain, path: pathname };
  }

  if (pathname.startsWith('/@')) {
    const rest = pathname.slice(2);
    const handle = rest.split('/')[0];
    if (!handle) return null;
    return { surface: 'portfolio', target: handle, path: `/${rest.slice(handle.length + 1)}` };
  }

  // Everything else on the product host: the marketing pages, pricing, and the
  // signed-in app.
  //
  // The path is normalised before it is stored, so /dashboard/edit/abc123 and
  // /dashboard/edit/def456 are one route rather than two rows nobody can group.
  // Ids are what make a page-view table useless at exactly the moment it gets
  // interesting, and they are also the part somebody could work backwards from.
  return { surface: 'site', target: 'site', path: normaliseRoute(pathname) };
}

function trackView(req: NextRequest, event: NextFetchEvent, subdomain: string | null): void {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.MANAGER_CODE_SECRET;
  // Without either of these there is nowhere to send a view, or no way to hash
  // one safely. Both are absent in local dev by default, and a dev server that
  // logs nothing is better than one that logs raw IPs.
  if (!convexUrl || !secret) return;

  const userAgent = req.headers.get('user-agent');
  if (isBot(userAgent)) return;

  const found = trackingTarget(req, subdomain);
  if (!found) return;

  // Convex HTTP actions are served from .convex.site, not the .convex.cloud
  // origin the browser client uses.
  const endpoint = `${convexUrl.replace('.convex.cloud', '.convex.site')}/track`;
  const hostname = req.headers.get('host') || '';

  event.waitUntil(
    (async () => {
      try {
        const visitorHash = await visitorHashEdge(callerIp(req.headers), userAgent, secret);

        // Present only on a client dashboard, and only once the manager has
        // entered their access code. It is what lets a view be attributed to a
        // named client rather than counted as anonymous.
        let sessionTokenHash: string | undefined;
        if (found.surface === 'dashboard') {
          const cookie = req.cookies.get(
            `mgr_session_${found.target.replace(/[^a-z0-9-]/gi, '')}`,
          )?.value;
          if (cookie) sessionTokenHash = await hashSessionTokenEdge(cookie, secret);
        }

        await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            surface: found.surface,
            target: found.target,
            path: found.path,
            visitorHash,
            sessionTokenHash,
            country: callerCountry(req.headers),
            referrer: referrerHost(req.headers.get('referer'), hostname),
          }),
        });
      } catch {
        // A page is never allowed to fail because it could not be counted.
      }
    })(),
  );
}

// ─────────────────────────────────────────────
// Proxy
// ─────────────────────────────────────────────

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  const hostname = req.headers.get('host') || '';
  const subdomain = getSubdomain(hostname);
  const pathname = req.nextUrl.pathname;

  // API routes (other than Kinde's own) bypass everything
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // A domain the product does not recognise is either a client's own or
  // nothing. Checked before anything else host-related, because every branch
  // below assumes the host is one of ours.
  if (!isKnownHost(hostname)) {
    const domainSlug = await resolveCustomDomain(hostname.split(':')[0]);
    if (domainSlug) {
      trackView(req, event, domainSlug);
      return handleSubdomainRewrite(domainSlug, req);
    }
    return new NextResponse('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    });
  }

  // The console has its own origin. Checked before the reserved-subdomain 404
  // below, which is what `admin` would otherwise fall into — it is on that list
  // precisely so no client could take the name before this existed.
  if (isAdminHost(hostname)) {
    return handleAdminHost(req);
  }

  // A reserved subdomain is not a client dashboard and is not the apex. Serving
  // the marketing site from it would put a second copy of the homepage on every
  // reserved name.
  if (isDeadSubdomain(hostname)) {
    return new NextResponse('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    });
  }

  // Client dashboards ([slug].devrel.studio) are visited by managers who do not
  // have a devrel.studio account, so Kinde auth is deliberately NOT applied
  // here. Access is gated by the manager access code, enforced server-side in
  // app/(subdomain)/[subdomain]/layout.tsx.
  if (subdomain) {
    trackView(req, event, subdomain);
    return handleSubdomainRewrite(subdomain, req);
  }

  // Public portfolios are addressed as /@handle, but `@folder` means a parallel
  // route slot in the App Router, so the page itself lives at /portfolio/handle
  // and the pretty URL is a rewrite.
  if (pathname.startsWith('/@')) {
    trackView(req, event, null);
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = `/portfolio/${pathname.slice(2)}`;
    return NextResponse.rewrite(rewriteUrl);
  }

  // One entrance. The console used to hang off /admin on the same host as
  // everybody's dashboard, which meant an admin's session for the product and
  // their authority over the platform lived on one origin — and that the link
  // existed, discoverably, in the sidebar of a page every customer opens.
  //
  // Old links keep working by landing where the console actually is.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const target = new URL(req.url);
    target.hostname = adminHostFor(hostname);
    target.pathname = pathname === '/admin' ? '/' : pathname.slice('/admin'.length);
    return NextResponse.redirect(target);
  }

  // The product host itself, which until now counted nothing about its own
  // pages. After the redirect above deliberately: a redirect is a hop, not a
  // page somebody read, and counting it would put /admin at the top of a list
  // of what people look at.
  trackView(req, event, null);

  // Main domain
  if (!isPublicRoute(req)) {
    return withAuth(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};
