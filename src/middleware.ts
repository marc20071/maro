
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/coding',
  '/medicine',
  '/learning',
  '/admin-login',
  '/auth',
  '/offline.html',
  '/manifest.webmanifest',
  '/sw.js',
  '/api/chat',
];

const PUBLIC_FILES = [
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/manifest.webmanifest',
  '/offline.html',
  '/sw.js',
];

const PUBLIC_DIRECTORIES = [
  '/icons',
  '/images',
  '/assets',
];

function isPublicFile(path: string): boolean {
  if (PUBLIC_FILES.includes(path)) {
    return true;
  }

  if (
    PUBLIC_DIRECTORIES.some(
      (directory) =>
        path === directory || path.startsWith(directory + '/')
    )
  ) {
    return true;
  }

  // Allow static assets and SEO verification files.
  if (
    /\.(txt|xml|html|htm|json|webmanifest|css|js|map|png|svg|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|pdf)$/i.test(
      path
    )
  ) {
    return true;
  }

  return false;
}

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(
    (publicPath) =>
      path === publicPath ||
      (publicPath !== '/' && path.startsWith(publicPath + '/'))
  );
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Public static files: no authentication required.
  if (isPublicFile(path)) {
    return NextResponse.next();
  }

  // 2. Public pages and APIs: no authentication required.
  // The login page is handled separately so logged-in users
  // can be redirected away from it.
  if (path !== '/login' && isPublicRoute(path)) {
    return NextResponse.next();
  }

  // 3. Initialize Supabase authentication.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Parameters<typeof response.cookies.set>[2];
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 4. Logged-in users should not stay on the login page.
  if (user && path === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';

    return NextResponse.redirect(url);
  }

  // 5. Allow visitors to access the login page.
  if (path === '/login') {
    return response;
  }

  // 6. Protect private API endpoints.
  if (!user && path.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Not signed in.' },
      { status: 401 }
    );
  }

  // 7. Protect all remaining private pages.
  if (!user) {
    const url = request.nextUrl.clone();

    url.pathname = '/login';
    url.search = '';

    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};