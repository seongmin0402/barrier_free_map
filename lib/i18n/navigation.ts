import type { AppLocale } from "@/lib/app-settings";
import type { ManeuverKind, WalkwayType } from "@/lib/routing/types";

export function hazardText(type: WalkwayType, locale: AppLocale): string | null {
  const ko: Record<WalkwayType, string | null> = {
    path: null,
    stairs: "계단이 있습니다",
    crosswalk: "횡단보도를 건너세요",
    ramp: "경사로가 있습니다",
  };
  const en: Record<WalkwayType, string | null> = {
    path: null,
    stairs: "stairs ahead",
    crosswalk: "cross the crosswalk",
    ramp: "ramp ahead",
  };
  return (locale === "en" ? en : ko)[type];
}

export function maneuverLabel(maneuver: ManeuverKind, locale: AppLocale): string {
  const labels: Record<AppLocale, Record<ManeuverKind, string>> = {
    ko: {
      depart: "출발",
      straight: "직진",
      left: "좌회전",
      "slight-left": "왼쪽 방향",
      right: "우회전",
      "slight-right": "오른쪽 방향",
      uturn: "유턴",
      arrive: "도착",
    },
    en: {
      depart: "depart",
      straight: "continue straight",
      left: "turn left",
      "slight-left": "bear left",
      right: "turn right",
      "slight-right": "bear right",
      uturn: "make a U-turn",
      arrive: "arrive",
    },
  };
  return labels[locale][maneuver] ?? labels[locale].straight;
}

export function arriveMessage(locale: AppLocale): string {
  return locale === "en"
    ? "You have arrived at your destination"
    : "목적지에 도착했습니다";
}

export function departStraightText(distance: string, locale: AppLocale): string {
  return locale === "en"
    ? `Continue straight for ${distance}`
    : `경로를 따라 ${distance} 직진하세요`;
}

export function aheadTurnText(distance: string, turnLabel: string, locale: AppLocale): string {
  return locale === "en" ? `In ${distance}, ${turnLabel}` : `${distance} 앞에서 ${turnLabel}`;
}

export function turnThenContinueText(turnLabel: string, locale: AppLocale): string {
  return locale === "en" ? `${turnLabel}, then continue` : `${turnLabel} 후 계속 이동`;
}

export function continueStraightPlaceholder(locale: AppLocale): string {
  return locale === "en" ? "Continue along the route" : "경로를 따라 직진하세요";
}

/** GPS 추적 중 음성 안내 문장 */
export function navSpeechText(
  locale: AppLocale,
  distanceM: number,
  distanceLabel: string,
  maneuver: ManeuverKind,
): string {
  if (maneuver === "arrive") return arriveMessage(locale);
  const turn = maneuverLabel(maneuver, locale);
  return locale === "en" ? `In ${distanceLabel}, ${turn}` : `${distanceLabel} 앞 ${turn}`;
}

export function remainingDistanceLabel(locale: AppLocale): string {
  return locale === "en" ? "Remaining" : "남은 거리";
}

/** 경로 이탈 후 재탐색 시 음성 안내 (출발 문구 포함) */
export function offRouteRerouteSpeech(locale: AppLocale, departText: string): string {
  return locale === "en"
    ? `You have left the route. ${departText}`
    : `경로를 벗어났습니다. ${departText}`;
}
