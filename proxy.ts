import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 request proxy (replaces middleware.ts).
 * Always fall through to the app — never return a 404 from here.
 */
export async function proxy(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (error) {
    console.error("proxy:", error);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
