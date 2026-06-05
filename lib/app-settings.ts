/** 앱 설정 (localStorage) — 접근성 + 언어 */

export type AppLocale = "ko" | "en";

export type AppSettings = {
  highContrast: boolean;
  fontSize: number;
  locale: AppLocale;
};

export const SETTINGS_STORAGE_KEY = "barrier-free-map-settings";

const DEFAULT_SETTINGS: AppSettings = {
  highContrast: false,
  fontSize: 100,
  locale: "ko",
};

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const p = JSON.parse(raw) as Partial<AppSettings>;
    const fontSize =
      typeof p.fontSize === "number" && Number.isFinite(p.fontSize)
        ? Math.min(150, Math.max(80, Math.round(p.fontSize / 10) * 10))
        : DEFAULT_SETTINGS.fontSize;
    const locale: AppLocale = p.locale === "en" ? "en" : "ko";
    return {
      highContrast: typeof p.highContrast === "boolean" ? p.highContrast : false,
      fontSize,
      locale,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
