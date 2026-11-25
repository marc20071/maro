
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  "/",
  "/coding",
  "/medicine",
  "/learning",
  "/login",
  "/admin-login",
  "/auth",
  "/offline.html",
  "/manifest.webmanifest",
  "/sw.js",
  "/api/chat",
];

const PUBLIC_FILES = [
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/offline.html",
  "/sw.js",
];

const PUBLIC_DIRECTORIES = [
  "/icons",
  "/images",
  "/assets",
];

// Files located in public/ should be served without authentication.
function isPublicFile(path: string): boolean {
  // Explicitly public files
  if (PUBLIC_FILES.includes(path)) {
    return true;
  }

  // Public static directories
  if (
    PUBLIC_DIRECTORIES.some(
      (directory) =>
        path === directory || path.startsWith(directory + "/")
    )
  ) {
    return true;
  }

  // SEO verification files and common static file extensions
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
      (publicPath !== "/" && path.startsWith(publicPath + "/"))
  );
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Allow static/public files without authentication.
  // No Supabase request is needed for these.
  if (isPublicFile(path)) {
    return NextResponse.next();
  }

  // 2. Allow designated public routes.
  if (isPublicRoute(path)) {
    return NextResponse.next();
  }

  // 3. Supabase authentication for protected routes.
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
          list: {
            name: string;
            value: string;
            options?: Parameters<typeof response.cookies.set>[2];
          }[]
        ) {
          list.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          list.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 4. Protect API endpoints.
  if (!user && path.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Not signed in." },
      { status: 401 }
    );
  }

  // 5. Protect pages from unauthenticated visitors.
  if (!user) {
    const url = request.nextUrl.clone();

    url.pathname = "/login";
    url.search = "";

    return NextResponse.redirect(url);
  }

  // 6. Redirect logged-in users away from login.
  if (user && path === "/login") {
    const url = request.nextUrl.clone();

    url.pathname = "/";
    url.search = "";

    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
