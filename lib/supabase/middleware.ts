import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

const PUBLIC_PREFIXES = ["/auth", "/create"];

function isPublicPath(pathname: string) {
  if (pathname === "/" || pathname === "") return true;
  return PUBLIC_PREFIXES.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function passThrough(request: NextRequest) {
  return NextResponse.next({ request });
}

function loginUrl(request: NextRequest) {
  return new URL("/auth", request.url);
}

function homeUrl(request: NextRequest) {
  return new URL("/", request.url);
}

/**
 * Refresh the auth session and protect game routes.
 * Never intercepts `/` — the home page handles login vs wrestler select.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/" || pathname === "") {
    return passThrough(request);
  }

  try {
    const env = getSupabaseEnv();
    if (!env) {
      return passThrough(request);
    }

    let supabaseResponse = passThrough(request);

    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = passThrough(request);
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (isPublicPath(pathname)) {
      if (user && pathname === "/auth") {
        return NextResponse.redirect(homeUrl(request));
      }
      return supabaseResponse;
    }

    if (!user) {
      return NextResponse.redirect(loginUrl(request));
    }

    return supabaseResponse;
  } catch (error) {
    console.error("Auth proxy failed:", error);
    return passThrough(request);
  }
}
