import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

const PUBLIC_PATHS = ["/", "/auth", "/create"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Refresh the auth session and protect main app routes.
 * Never throws — missing/invalid Supabase config must not take the app down.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  const env = getSupabaseEnv();
  if (!env) {
    return response;
  }

  try {
    let supabaseResponse = response;

    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    if (!user && !isPublicPath(pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }

    if (user && pathname === "/auth") {
      const selectUrl = request.nextUrl.clone();
      selectUrl.pathname = "/";
      selectUrl.search = "";
      return NextResponse.redirect(selectUrl);
    }

    return supabaseResponse;
  } catch (error) {
    console.error("Auth middleware failed:", error);
    return response;
  }
}
