import { type NextRequest, NextResponse } from 'next/server';

export default async function proxy(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  const isValidToken = token && token !== "undefined";

  // Protected routes logic
  const isAuthPage = request.nextUrl.pathname.startsWith('/iniciar-sesion') || 
                     request.nextUrl.pathname.startsWith('/registro');
  const isDashboardPage = request.nextUrl.pathname.startsWith('/dashboard');

  if (isDashboardPage && !isValidToken) {
    return NextResponse.redirect(new URL('/iniciar-sesion', request.url));
  }

  if (isAuthPage && isValidToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
