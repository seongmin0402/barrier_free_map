"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  loadAppSettings,
  saveAppSettings,
  type AppLocale,
  type AppSettings,
} from "@/lib/app-settings";

type AppSettingsContextValue = {
  settings: AppSettings;
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadAppSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveAppSettings(settings);
    document.documentElement.lang = settings.locale === "en" ? "en" : "ko";
  }, [settings, hydrated]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const setLocale = useCallback(
    (locale: AppLocale) => {
      updateSettings({ locale });
    },
    [updateSettings],
  );

  const value = useMemo(
    () => ({
      settings,
      locale: settings.locale,
      setLocale,
      updateSettings,
    }),
    [settings, setLocale, updateSettings],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }
  return ctx;
}
