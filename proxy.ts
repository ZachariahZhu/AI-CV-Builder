import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["zh", "en", "de"];
const defaultLocale = "zh";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const hasLocaleCookie = request.cookies.has("NEXT_LOCALE");
  if (!hasLocaleCookie) {
    const acceptLang = request.headers.get("accept-language") ?? "";
    const preferred = acceptLang.split(",")[0]?.split("-")[0]?.toLowerCase();
    const detected = locales.includes(preferred) ? preferred : defaultLocale;
    response.cookies.set("NEXT_LOCALE", detected, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
