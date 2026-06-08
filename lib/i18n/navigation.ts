import type { AppLocale } from "@/lib/app-settings";
import { formatDistance } from "@/lib/routing/geo";
import { estimateWalkMinutes } from "@/lib/routing/route-estimate";
import type { ComputedRoute, ManeuverKind, WalkwayType } from "@/lib/routing/types";

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

/** 횡단보도 — 회전 안내와 같은 “Xm 앞” 표현 */
export function crosswalkAheadText(distance: string, locale: AppLocale): string {
  return locale === "en"
    ? `In ${distance}, cross the crosswalk`
    : `${distance} 앞 횡단보도를 건너세요`;
}

export function crosswalkNowText(locale: AppLocale): string {
  return locale === "en" ? "Cross the crosswalk" : "횡단보도를 건너세요";
}

export type NavSpeechPhase = "far" | "approaching" | "imminent" | "now";

const PHASE_ORDER: NavSpeechPhase[] = ["far", "approaching", "imminent", "now"];

export function navSpeechPhase(distanceM: number): NavSpeechPhase {
  if (distanceM <= 10) return "now";
  if (distanceM <= 30) return "imminent";
  if (distanceM <= 65) return "approaching";
  return "far";
}

export function navSpeechPhaseRank(phase: NavSpeechPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

function turnSpeech(
  locale: AppLocale,
  maneuver: ManeuverKind,
  phase: NavSpeechPhase,
  distanceLabel: string,
): string {
  const turn = maneuverLabel(maneuver, locale);
  if (phase === "far") {
    return locale === "en" ? `In ${distanceLabel}, ${turn}` : `${distanceLabel} 앞 ${turn}`;
  }
  if (phase === "approaching") {
    return locale === "en" ? `Soon, ${turn}` : `곧 ${turn}입니다`;
  }
  return locale === "en" ? `${turn} now` : `지금 ${turn}`;
}

function hazardSpeech(
  locale: AppLocale,
  maneuver: ManeuverKind,
  phase: NavSpeechPhase,
  distanceLabel: string,
  stepText: string,
): string {
  if (maneuver === "stairs") {
    if (phase === "far") {
      return locale === "en"
        ? `In ${distanceLabel}, stairs ahead`
        : `${distanceLabel} 앞 계단 구간이 있습니다`;
    }
    if (phase === "approaching") {
      return locale === "en" ? "Stairs coming up soon" : "곧 계단이 있습니다";
    }
    return locale === "en" ? "There are stairs" : "계단이 있습니다";
  }
  if (maneuver === "ramp") {
    if (phase === "far") {
      return locale === "en" ? `In ${distanceLabel}, ramp ahead` : `${distanceLabel} 앞 경사로가 있습니다`;
    }
    if (phase === "approaching") {
      return locale === "en" ? "Ramp coming up soon" : "곧 경사로가 있습니다";
    }
    return locale === "en" ? "Use the ramp" : "경사로가 있습니다";
  }
  if (maneuver === "crosswalk") {
    if (phase === "now" || phase === "imminent") return crosswalkNowText(locale);
    if (phase === "approaching") {
      return locale === "en" ? "Crosswalk coming up soon" : "곧 횡단보도입니다";
    }
    return crosswalkAheadText(distanceLabel, locale);
  }
  return stepText;
}

/** GPS 추적 중 단계별 음성 — 거리·단계(멀리/곧/지금)별 예고 */
export function navStepSpeechText(
  locale: AppLocale,
  stepText: string,
  distanceM: number,
  distanceLabel: string,
  maneuver: ManeuverKind,
  phase: NavSpeechPhase = navSpeechPhase(distanceM),
): string {
  if (maneuver === "arrive") return arriveMessage(locale);

  if (maneuver === "elevator" || maneuver === "straight") {
    return phase === "far" && distanceM > 12
      ? locale === "en"
        ? `In ${distanceLabel}, ${stepText}`
        : `${distanceLabel} 앞, ${stepText}`
      : stepText;
  }

  if (isGuidanceManeuver(maneuver)) {
    return hazardSpeech(locale, maneuver, phase, distanceLabel, stepText);
  }

  if (maneuver === "depart") {
    return phase === "far" && distanceM > 12
      ? locale === "en"
        ? `In ${distanceLabel}, ${stepText}`
        : `${distanceLabel} 앞, ${stepText}`
      : stepText;
  }

  return turnSpeech(locale, maneuver, phase, distanceLabel);
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
    return null;
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

/** 안내 시작 전 경로 요약 — 음성·스크린리더 공통 */
export function routePreviewSpeechText(
  locale: AppLocale,
  route: ComputedRoute,
  destLabel: string,
): string {
  const minutes = estimateWalkMinutes(route);
  const dist = formatDistance(route.distance, locale);
  const crosswalks = route.steps.filter((s) => s.maneuver === "crosswalk").length;
  const elevators = route.steps.filter((s) => s.maneuver === "elevator").length;

  if (locale === "en") {
    const parts = [
      `Route to ${destLabel}.`,
      `About ${minutes} minutes, ${dist} on foot.`,
    ];
    if (crosswalks > 0) {
      parts.push(`${crosswalks} crosswalk${crosswalks > 1 ? "s" : ""}.`);
    }
    if (elevators > 0) {
      parts.push(`${elevators} elevator transfer${elevators > 1 ? "s" : ""}.`);
    }
    if (route.hasStairs) parts.push("This route includes stairs.");
    else if (route.hasElevator) parts.push("Elevator segments are included.");
    parts.push("Guidance will begin now.");
    return parts.join(" ");
  }

  const parts = [
    `${destLabel}까지 경로입니다.`,
    `도보 약 ${minutes}분, ${dist}.`,
  ];
  if (crosswalks > 0) parts.push(`횡단보도 ${crosswalks}회.`);
  if (elevators > 0) parts.push(`승강기 ${elevators}회.`);
  if (route.hasStairs) parts.push("계단 구간이 포함되어 있습니다.");
  else if (route.hasElevator) parts.push("승강기 구간이 포함되어 있습니다.");
  parts.push("이제 길안내를 시작합니다.");
  return parts.join(" ");
}

/** 경로 이탈 후 재탐색 시 음성 안내 (출발 문구 포함) */
export function offRouteRerouteSpeech(locale: AppLocale, departText: string): string {
  return locale === "en"
    ? `You have left the route. ${departText}`
    : `경로를 벗어났습니다. ${departText}`;
}
