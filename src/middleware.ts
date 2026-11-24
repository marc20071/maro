
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = [
  "/",
  "/coding",
  "/medicine",
  "/learning",
  "/login",
  "/api/chat",
  "/admin-login",
  "/auth",
  "/offline.html",
  "/manifest.webmanifest",
  "/sw.js",
  "/icons",
];

export async function middleware(request: NextRequest) {
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
          // Update request cookies so the current middleware
          // and downstream server components receive fresh values.
          list.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          // Recreate the response with the updated request.
          response = NextResponse.next({ request });

          // Persist refreshed cookies in the browser response.
          list.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Validate the session with Supabase.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Check whether the requested route is publicly accessible.
  const isPublic = PUBLIC.some(
    (publicPath) =>
      path === publicPath || path.startsWith(publicPath + "/")
  );

  // Protect private pages and API endpoints.
  if (!user && !isPublic) {
    if (path.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Not signed in." },
        { status: 401 }
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";

    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from the login page.
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";

    return NextResponse.redirect(url);
  }

  // Preserve the response containing refreshed authentication cookies.
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico|webp)$).*)",
  ],
};
