import type { AppLocale } from "@/lib/app-settings";
import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://knu-bfmap.com";

const META = {
  ko: {
    siteName: "공주대학교 신관캠퍼스 베리어프리맵",
    home: {
      title: "공주대학교 신관캠퍼스 베리어프리맵",
      description:
        "장애인, 노약자, 임산부 등 이동약자를 위한 공주대학교 신관캠퍼스 접근성 지도. 휠체어 경사로·출입구·보행로 기반 길찾기 안내를 제공합니다.",
    },
    route: {
      title: "길찾기",
      description:
        "공주대학교 신관캠퍼스 보행로 기반 길찾기. 출발지·도착지를 선택하고 GPS 음성 안내로 이동하세요.",
    },
    keywords: [
      "공주대학교",
      "신관캠퍼스",
      "베리어프리",
      "배리어프리",
      "접근성 지도",
      "이동약자",
      "휠체어 경사로",
      "캠퍼스 길찾기",
      "장애인 편의시설",
    ],
    ogLocale: "ko_KR",
  },
  en: {
    siteName: "Kongju National University Singwan Campus Barrier-Free Map",
    home: {
      title: "Kongju National University Singwan Campus Barrier-Free Map",
      description:
        "Accessibility map for Kongju National University Singwan Campus. Find wheelchair ramps, entrances, and walkway-based turn-by-turn directions.",
    },
    route: {
      title: "Directions",
      description:
        "Walkway-based directions on Kongju National University Singwan Campus. Set origin and destination for GPS voice guidance.",
    },
    keywords: [
      "Kongju National University",
      "Singwan Campus",
      "barrier-free",
      "accessibility map",
      "wheelchair",
      "campus directions",
      "walkway navigation",
    ],
    ogLocale: "en_US",
  },
} as const;

export type SitePage = "home" | "route";

export function getPageMeta(locale: AppLocale, page: SitePage) {
  const m = META[locale];
  const pageMeta = page === "route" ? m.route : m.home;
  const title =
    page === "home" ? pageMeta.title : `${pageMeta.title} | ${m.siteName}`;
  return {
    title,
    description: pageMeta.description,
    siteName: m.siteName,
    keywords: [...m.keywords],
    ogLocale: m.ogLocale,
  };
}

/** SSR 기본 메타 (한국어) */
export function buildRootMetadata(): Metadata {
  const ko = getPageMeta("ko", "home");
  const en = getPageMeta("en", "home");
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: ko.title,
      template: `%s | ${META.ko.siteName}`,
    },
    description: ko.description,
    keywords: ko.keywords,
    applicationName: ko.siteName,
    alternates: {
      canonical: "/",
      languages: {
        "ko-KR": "/",
        "en-US": "/",
      },
    },
    openGraph: {
      type: "website",
      locale: ko.ogLocale,
      alternateLocale: [en.ogLocale],
      url: SITE_URL,
      siteName: ko.siteName,
      title: ko.title,
      description: ko.description,
    },
    twitter: {
      card: "summary_large_image",
      title: ko.title,
      description: ko.description,
    },
  };
}

export function buildRouteMetadata(): Metadata {
  const ko = getPageMeta("ko", "route");
  const en = getPageMeta("en", "route");
  return {
    title: ko.title,
    description: ko.description,
    alternates: {
      canonical: "/route",
      languages: {
        "ko-KR": "/route",
        "en-US": "/route",
      },
    },
    openGraph: {
      title: ko.title,
      description: ko.description,
      locale: ko.ogLocale,
      alternateLocale: [en.ogLocale],
      url: `${SITE_URL}/route`,
    },
    twitter: {
      title: ko.title,
      description: ko.description,
    },
  };
}
