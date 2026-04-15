import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export type Locale = "zh" | "en" | "de";
export const locales: Locale[] = ["zh", "en", "de"];
export const defaultLocale: Locale = "zh";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale: Locale = locales.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
