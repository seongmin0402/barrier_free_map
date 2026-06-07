import type { AppLocale } from "@/lib/app-settings";
import {
  arriveMessage,
  crosswalkNowText,
  maneuverLabel,
} from "@/lib/i18n/navigation";
import { formatDistance } from "./geo";
import type { ManeuverKind, RouteStep } from "./types";

/** 안내 문장에 묻힌 거리(m) 추출 */
function parseDistanceFromText(text: string): number | null {
  const km = text.match(/([\d.]+)\s*km/i);
  if (km) return parseFloat(km[1]) * 1000;
  const m = text.match(/([\d.]+)\s*m\b/i);
  if (m) return parseFloat(m[1]);
  return null;
}

function instructionForStep(step: RouteStep, locale: AppLocale): string {
  switch (step.maneuver) {
    case "crosswalk":
      return crosswalkNowText(locale);
    case "ramp":
      return locale === "en" ? "Use the ramp" : "경사로 이동";
    case "stairs":
      return locale === "en" ? "Use the stairs" : "계단 이용";
    case "elevator":
    case "arrive":
      return step.text;
    case "depart":
    case "straight":
      return locale === "en" ? "Continue straight" : "직진";
    default:
      return maneuverLabel(step.maneuver, locale);
  }
}

export interface StepDisplayMeta {
  distanceM: number | null;
  distanceLabel: string | null;
  instruction: string;
}

/** 목록 UI — 거리와 안내 문장 분리 */
export function stepDisplayMeta(step: RouteStep, locale: AppLocale): StepDisplayMeta {
  let distanceM =
    step.distance > 1 ? step.distance : parseDistanceFromText(step.text);

  if (step.maneuver === "arrive" || step.maneuver === "elevator") {
    distanceM = step.distance > 1 ? step.distance : null;
  }

  const distanceLabel =
    distanceM != null && distanceM > 1 ? formatDistance(distanceM, locale) : null;

  return {
    distanceM,
    distanceLabel,
    instruction: instructionForStep(step, locale),
  };
}

/** 단계 아이콘·배경 — 지도 경로 색과 맞춤 */
export function stepManeuverStyle(maneuver: ManeuverKind): {
  bg: string;
  fg: string;
  ring: string;
} {
  switch (maneuver) {
    case "crosswalk":
      return {
        bg: "bg-green-600",
        fg: "text-white",
        ring: "ring-green-600/30",
      };
    case "ramp":
      return {
        bg: "bg-orange-600",
        fg: "text-white",
        ring: "ring-orange-600/30",
      };
    case "stairs":
      return {
        bg: "bg-red-600",
        fg: "text-white",
        ring: "ring-red-600/30",
      };
    case "elevator":
      return {
        bg: "bg-teal-600",
        fg: "text-white",
        ring: "ring-teal-600/30",
      };
    case "arrive":
      return {
        bg: "bg-red-600",
        fg: "text-white",
        ring: "ring-red-600/30",
      };
    default:
      return {
        bg: "bg-blue-600",
        fg: "text-white",
        ring: "ring-blue-600/30",
      };
  }
}
