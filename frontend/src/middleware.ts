import { NextResponse, type NextRequest } from 'next/server';

const COOKIE = 'nt_token';

/**
 * Edge redirect for a smoother UX only. It decodes (does NOT verify) the JWT to
 * route visitors; real authentication, RBAC and ownership are enforced by the API.
 */
function readToken(req: NextRequest): { role?: string; exp?: number } | null {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = readToken(req);

  if (!session) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith('/admin') && session.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/tasks/:path*',
    '/projects/:path*',
    '/calendar/:path*',
    '/focus/:path*',
    '/mood/:path*',
    '/notes/:path*',
    '/analytics/:path*',
    '/notifications/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/admin/:path*',
  ],
};
