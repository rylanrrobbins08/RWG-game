import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

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
    /*
     * Run on app routes except `/`. `.+` requires a path after the slash
     * so the home page is never intercepted.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).+)",
  ],
};
