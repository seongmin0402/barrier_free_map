import type { AppLocale } from "@/lib/app-settings";
import type { ManeuverKind, WalkwayType } from "@/lib/routing/types";

export function hazardText(type: WalkwayType, locale: AppLocale): string | null {
  const ko: Partial<Record<string, string | null>> = {
    path: null,
    indoor: null,
    stairs: "계단이 있습니다",
    crosswalk: "횡단보도를 건너세요",
    ramp: "경사로가 있습니다",
    elevator: null,
  };
  const en: Partial<Record<string, string | null>> = {
    path: null,
    indoor: null,
    stairs: "stairs ahead",
    crosswalk: "cross the crosswalk",
    ramp: "ramp ahead",
    elevator: null,
  };
  return (locale === "en" ? en : ko)[type] ?? null;
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
      elevator: "승강기",
      crosswalk: "횡단보도",
      ramp: "경사로",
      stairs: "계단",
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
      elevator: "elevator",
      crosswalk: "crosswalk",
      ramp: "ramp",
      stairs: "stairs",
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

/** 승강기 탑승 안내 — 회전 안내와 분리 */
export function elevatorTransferText(
  floorLabel: string,
  locale: AppLocale,
  elevatorName?: string,
): string {
  if (elevatorName) {
    return locale === "en"
      ? `Take ${elevatorName} to ${floorLabel}`
      : `${elevatorName}를 이용해 ${floorLabel}으로 이동하세요`;
  }
  return locale === "en"
    ? `Take the elevator to ${floorLabel}`
    : `승강기를 이용해 ${floorLabel}으로 이동하세요`;
}

/** GPS 추적 중 단계별 음성 — 거리 예고 + 승강기 전체 문장 */
export function navStepSpeechText(
  locale: AppLocale,
  stepText: string,
  distanceM: number,
  distanceLabel: string,
  maneuver: ManeuverKind,
): string {
  if (maneuver === "arrive") return arriveMessage(locale);

  const withDistance =
    distanceM > 12
      ? locale === "en"
        ? `In ${distanceLabel}, ${stepText}`
        : `${distanceLabel} 앞, ${stepText}`
      : stepText;

  if (maneuver === "elevator" || maneuver === "straight" || isGuidanceManeuver(maneuver)) {
    return withDistance;
  }

  const turn = maneuverLabel(maneuver, locale);
  return distanceM > 12
    ? locale === "en"
      ? `In ${distanceLabel}, ${turn}`
      : `${distanceLabel} 앞 ${turn}`
    : locale === "en"
      ? `${turn} now`
      : `지금 ${turn}`;
}

/** 경사로·계단·횡단보도 등 — 구간 단위 한 줄 안내 */
export function isGuidanceManeuver(m: ManeuverKind): boolean {
  return m === "crosswalk" || m === "ramp" || m === "stairs";
}

export function guidanceManeuverFor(type: WalkwayType): ManeuverKind | null {
  if (type === "crosswalk") return "crosswalk";
  if (type === "ramp") return "ramp";
  if (type === "stairs") return "stairs";
  return null;
}

export function featureFollowText(
  type: WalkwayType,
  distance: string,
  locale: AppLocale,
): string | null {
  if (type === "crosswalk") {
    return locale === "en"
      ? `Cross the crosswalk for ${distance}`
      : `횡단보도를 ${distance} 구간에서 건너세요`;
  }
  if (type === "ramp") {
    return locale === "en"
      ? `Follow the ramp for ${distance}`
      : `경사로를 따라 ${distance} 이동하세요`;
  }
  if (type === "stairs") {
    return locale === "en"
      ? `Use the stairs for ${distance}`
      : `계단 구간을 ${distance} 이동하세요`;
  }
  if (type === "indoor") {
    return locale === "en"
      ? `Continue indoors for ${distance}`
      : `실내 통로를 따라 ${distance} 이동하세요`;
  }
  return null;
}

/** GPS 추적 중 음성 안내 문장 (회전 전용 — navStepSpeechText 권장) */
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
