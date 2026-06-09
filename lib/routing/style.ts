import type { WalkwayType } from "./types";

/** 보행로 종류별 경로 색상 — 계단(빨강)·경사로(보라)·횡단보도(초록) 구분 */
export function segmentColor(type: WalkwayType): string {
  switch (type) {
    case "crosswalk":
      return "#16a34a";
    case "stairs":
      return "#dc2626";
    case "ramp":
      return "#9333ea";
    case "elevator":
    case "indoor":
      return "#2563eb";
    default:
      return "#2563eb";
  }
}

/** 길찾기 범례 항목 (UI·지도 공통) */
export const ROUTE_LEGEND: Array<{ type: WalkwayType; label: string; color: string }> = [
  { type: "path", label: "보행로", color: segmentColor("path") },
  { type: "crosswalk", label: "횡단보도", color: segmentColor("crosswalk") },
  { type: "ramp", label: "경사로", color: segmentColor("ramp") },
  { type: "stairs", label: "계단", color: segmentColor("stairs") },
];

/** 경로에 실제 등장하는 종류만 (실내=보행로 색, 승강기 구간=보행로) */
export function legendItemsForRoute(segmentTypes: WalkwayType[]) {
  const onRoute = new Set<WalkwayType>(segmentTypes);
  return ROUTE_LEGEND.filter(
    (l) => l.type === "path" || onRoute.has(l.type),
  );
}
