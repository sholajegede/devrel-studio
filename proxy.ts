import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";
import { NextResponse, NextRequest } from 'next/server';
import { isReservedSubdomain } from '@/lib/naming';

// ─────────────────────────────────────────────
// Route matching
// ─────────────────────────────────────────────

const publicRoutes = [
  '/',
  '/contact(.*)',
  '/pricing(.*)',
  '/waitlist(.*)',
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
// Proxy
// ─────────────────────────────────────────────

export default function proxy(req: NextRequest) {
  const hostname = req.headers.get('host') || '';
  const subdomain = getSubdomain(hostname);
  const pathname = req.nextUrl.pathname;

  // API routes (other than Kinde's own) bypass everything
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Client dashboards ([slug].devrel.studio) are visited by managers who do not
  // have a devrel.studio account, so Kinde auth is deliberately NOT applied
  // here. Access is gated by the manager access code, enforced server-side in
  // app/(subdomain)/[subdomain]/layout.tsx.
  if (subdomain) {
    return handleSubdomainRewrite(subdomain, req);
  }

  // Public portfolios are addressed as /@handle, but `@folder` means a parallel
  // route slot in the App Router, so the page itself lives at /portfolio/handle
  // and the pretty URL is a rewrite.
  if (pathname.startsWith('/@')) {
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = `/portfolio/${pathname.slice(2)}`;
    return NextResponse.rewrite(rewriteUrl);
  }

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
