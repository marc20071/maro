
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
          // Update request cookies.
          list.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          // Recreate response with updated request cookies.
          response = NextResponse.next({ request });

          // Persist refreshed cookies in the browser.
          list.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Verify the current Supabase session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Determine whether this route is public.
  const isPublic = PUBLIC.some(
    (publicPath) =>
      path === publicPath || path.startsWith(publicPath + "/")
  );

  // Redirect unauthenticated visitors from protected routes.
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

  // Redirect authenticated users away from login.
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";

    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  runtime: "nodejs",
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico|webp)$).*)",
  ],
};
