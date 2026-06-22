/** 길안내 런타임 — 플랫폼 감지·Geolocation 옵션·페이지 가시성 */

export function isPageHidden(): boolean {
  if (typeof document === "undefined") return false;
  return document.visibilityState === "hidden";
}

/** iOS/Android/PC 공통 — 터치·좁은 뷰포트 기준 모바일 길안내 튜닝 */
export function isMobileNavViewport(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(max-width: 639px)").matches ||
    window.matchMedia("(hover: none) and (pointer: coarse)").matches
  );
}

export type NavGeoMode = "watch" | "once" | "recenter";

/** 플랫폼별 Geolocation 옵션 — iOS 배터리·데스크톱 타임아웃 균형 */
export function navGeolocationOptions(mode: NavGeoMode): PositionOptions {
  const mobile = isMobileNavViewport();
  switch (mode) {
    case "watch":
      return {
        enableHighAccuracy: true,
        maximumAge: mobile ? 500 : 1000,
        timeout: mobile ? 12000 : 15000,
      };
    case "recenter":
      return {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: mobile ? 8000 : 12000,
      };
    case "once":
    default:
      return {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: mobile ? 10000 : 15000,
      };
  }
}
