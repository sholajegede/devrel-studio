import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";
import { NextResponse, NextRequest } from 'next/server';

const publicRoutes = [
  '/',
  '/about(.*)',
  '/contact(.*)',
  '/pricing(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/auth(.*)',
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

const getSubdomain = (hostname: string): string | null => {
  const parts = hostname.split('.');
  
  // Handle localhost subdomains (e.g., kinde.localhost:3000)
  if (hostname.includes('localhost')) {
    if (parts.length >= 2 && parts[0] !== 'localhost') {
      const subdomain = parts[0];
      console.log('[Proxy] Found localhost subdomain:', subdomain);
      return subdomain;
    }
    return null;
  }
  
  // Handle production subdomains (e.g., kinde.devrel.studio)
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (subdomain !== 'www') {
      return subdomain;
    }
  }
  
  return null;
};

const handleSubdomainRewrite = (
  subdomain: string,
  req: NextRequest
): NextResponse => {
  const url = req.nextUrl.clone();
  
  // Allow static assets and auth routes
  if (url.pathname.startsWith('/_next') || 
      url.pathname.startsWith('/images') ||
      url.pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }
  
  // Redirect root to the subdomain page
  if (url.pathname === '/') {
    const rewriteUrl = url.clone();
    rewriteUrl.pathname = `/${subdomain}`;
    console.log('[Proxy] Rewriting root to:', rewriteUrl.pathname);
    return NextResponse.rewrite(rewriteUrl);
  }

  // Rewrite the URL to point to the subdomain-specific folder
  if (!url.pathname.startsWith(`/${subdomain}/`)) {
    const rewriteUrl = url.clone();
    rewriteUrl.pathname = `/${subdomain}${url.pathname}`;
    console.log('[Proxy] Rewriting', url.pathname, 'to:', rewriteUrl.pathname);
    return NextResponse.rewrite(rewriteUrl);
  }

  return NextResponse.next();
};

export default function proxy(req: NextRequest) {
  const hostname = req.headers.get('host') || '';
  const subdomain = getSubdomain(hostname);
  const pathname = req.nextUrl.pathname;

  console.log('[Proxy] hostname:', hostname, 'subdomain:', subdomain, 'pathname:', pathname);

  // FIRST: Check if it's an API route (except /api/auth) - let it through immediately
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth')) {
    console.log('[Proxy] API route - bypassing all middleware');
    return NextResponse.next();
  }

  // Handle subdomain routing
  if (subdomain) {
    // Check if route is public for this subdomain
    if (isPublicRoute(req)) {
      return handleSubdomainRewrite(subdomain, req);
    }
    
    // Protected route - use Kinde auth and then rewrite
    return withAuth(req, async (req: any) => {
      return handleSubdomainRewrite(subdomain, req);
    });
  }

  // Main domain routing (no subdomain)
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