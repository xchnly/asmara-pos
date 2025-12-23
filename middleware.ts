// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  const { pathname } = request.nextUrl;

  // Public routes yang tidak perlu auth
  const publicRoutes = ['/', '/register', '/forgot-password'];
  
  // Jika mencoba akses protected route tanpa token
  if (!publicRoutes.includes(pathname) && !token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Jika sudah login tapi mencoba akses login page
  if (publicRoutes.includes(pathname) && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};