import { NextRequest, NextResponse } from "next/server";
import { auth } from "./lib/auth";
import { headers } from "next/headers";

const isPublicRoutes = ["/login"];

export async function proxy(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!isPublicRoutes.includes(req.nextUrl.pathname) && !session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
