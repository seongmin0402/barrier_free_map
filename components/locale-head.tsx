"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAppSettings } from "@/components/app-settings-provider";
import { getPageMeta, type SitePage } from "@/lib/site-metadata";

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function pageFromPath(pathname: string): SitePage {
  return pathname.startsWith("/route") ? "route" : "home";
}

/** locale·경로에 따라 document title / description / og 태그 갱신 */
export function LocaleHead() {
  const { locale } = useAppSettings();
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    const page = pageFromPath(pathname);
    const meta = getPageMeta(locale, page);
    document.title = meta.title;
    setMeta("description", meta.description);
    setMeta("og:title", meta.title, "property");
    setMeta("og:description", meta.description, "property");
    setMeta("og:locale", meta.ogLocale, "property");
    setMeta(
      "og:locale:alternate",
      locale === "en" ? "ko_KR" : "en_US",
      "property",
    );
  }, [locale, pathname]);

  return null;
}
