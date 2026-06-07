import type { WalkwayType } from "./types";

/** 보행로 종류별 경로 색상 */
export function segmentColor(type: WalkwayType): string {
  switch (type) {
    case "crosswalk":
      return "#16a34a";
    case "stairs":
      return "#ef4444";
    case "ramp":
      return "#a855f7";
    case "elevator":
      return "#0d9488";
    case "indoor":
      return "#0891b2";
    default:
      return "#2563eb";
  }
}

/** 길찾기 범례 항목 (UI 표시용) */
export const ROUTE_LEGEND: Array<{ type: WalkwayType; label: string; color: string }> = [
  { type: "path", label: "보행로", color: segmentColor("path") },
  { type: "crosswalk", label: "횡단보도", color: segmentColor("crosswalk") },
  { type: "stairs", label: "계단", color: segmentColor("stairs") },
  { type: "ramp", label: "경사로", color: segmentColor("ramp") },
  { type: "elevator", label: "승강기", color: segmentColor("elevator") },
];
