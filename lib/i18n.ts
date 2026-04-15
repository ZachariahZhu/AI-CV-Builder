export type Locale = "zh" | "en" | "de";

export const locales: Locale[] = ["zh", "en", "de"];
export const defaultLocale: Locale = "zh";

export function setUserLocale(locale: Locale) {
  document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
  localStorage.setItem("NEXT_LOCALE", locale);
  window.location.reload();
}

export function getSavedLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem("NEXT_LOCALE");
  if (saved && locales.includes(saved as Locale)) return saved as Locale;
  return null;
}
