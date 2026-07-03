import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const session = await decrypt(req.cookies.get("session")?.value);

  const isAdminRoute = path.startsWith("/admin") && path !== "/admin/login";
  const isParticipantRoute = path.startsWith("/participante");

  if (isAdminRoute && session?.role !== "admin") {
    return NextResponse.redirect(new URL("/admin/login", req.nextUrl));
  }

  if (isParticipantRoute && session?.role !== "participant") {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/participante/:path*"],
};
