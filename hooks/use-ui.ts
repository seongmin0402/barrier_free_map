"use client";

import { useMemo } from "react";
import { useAppSettings } from "@/components/app-settings-provider";
import { getUi, type UiText } from "@/lib/i18n/ui";

export function useUi(): UiText {
  const { locale } = useAppSettings();
  return useMemo(() => getUi(locale), [locale]);
}
