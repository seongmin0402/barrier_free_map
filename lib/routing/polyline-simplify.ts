import { haversineMeters, projectOnSegment, type LatLng } from "./geo";
import type { WalkwayType } from "./types";

export interface GuideSegment {
  type: WalkwayType;
}

/** 단순화 시 꼭짓점 유지 — 횡단보도·경사로·계단 경계 */
const GUIDANCE_BOUNDARY = new Set<string>(["crosswalk", "ramp", "stairs"]);

export interface GuidePolyline {
  coords: LatLng[];
  segs: GuideSegment[];
  /** 안내용 좌표 인덱스 → 승강기 문구 */
  elevatorText: Map<number, string>;
}

/** 점 p와 선분 a-b 사이 수직 거리(m) */
function perpendicularDistanceM(p: LatLng, a: LatLng, b: LatLng): number {
  return projectOnSegment(p, a, b).distance;
}

/** Douglas–Peucker — 유지할 원본 인덱스 목록 */
export function douglasPeuckerIndices(
  coords: LatLng[],
  toleranceM: number,
  mustKeep: Set<number> = new Set(),
): number[] {
  if (coords.length <= 2) {
    return coords.map((_, i) => i);
  }

  const kept = new Set<number>(mustKeep);
  kept.add(0);
  kept.add(coords.length - 1);

  function simplifyRange(start: number, end: number) {
    if (end - start < 2) return;

    const a = coords[start];
    const b = coords[end];
    let maxDist = 0;
    let maxIdx = -1;

    for (let i = start + 1; i < end; i++) {
      if (kept.has(i)) {
        simplifyRange(start, i);
        simplifyRange(i, end);
        return;
      }
      const d = perpendicularDistanceM(coords[i], a, b);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }

    if (maxDist > toleranceM && maxIdx >= 0) {
      kept.add(maxIdx);
      simplifyRange(start, maxIdx);
      simplifyRange(maxIdx, end);
    }
  }

  simplifyRange(0, coords.length - 1);
  return [...kept].sort((x, y) => x - y);
}

/** 구간 [fromIdx, toIdx]에서 가장 긴 seg type (거리 가중) */
function dominantSegType(
  coords: LatLng[],
  segs: GuideSegment[],
  fromIdx: number,
  toIdx: number,
): WalkwayType {
  const totals = new Map<WalkwayType, number>();
  for (let i = fromIdx; i < toIdx && i < segs.length; i++) {
    const t = segs[i]?.type ?? "path";
    const len =
      i + 1 < coords.length ? haversineMeters(coords[i], coords[i + 1]) : 1;
    totals.set(t, (totals.get(t) ?? 0) + len);
  }
  let best: WalkwayType = "path";
  let bestLen = 0;
  for (const [t, len] of totals) {
    if (len > bestLen) {
      bestLen = len;
      best = t;
    }
  }
  return best;
}

/** 지도용 원본 coords는 유지하고, 턴바이턴 안내용으로만 단순화 */
export function simplifyForGuidance(
  coords: LatLng[],
  segs: GuideSegment[],
  elevatorTextAtCoord: Map<number, string>,
  toleranceM = 10,
): GuidePolyline {
  if (coords.length < 2) {
    return { coords: [...coords], segs: [...segs], elevatorText: new Map(elevatorTextAtCoord) };
  }

  const mustKeep = new Set<number>([0, coords.length - 1]);
  for (const idx of elevatorTextAtCoord.keys()) {
    mustKeep.add(idx);
  }
  for (let i = 0; i < segs.length; i++) {
    const t = segs[i]?.type ?? "path";
    const tPrev = i > 0 ? (segs[i - 1]?.type ?? "path") : null;
    if (GUIDANCE_BOUNDARY.has(t) || (tPrev && GUIDANCE_BOUNDARY.has(tPrev) && t !== tPrev)) {
      mustKeep.add(i);
      mustKeep.add(i + 1);
    }
  }

  const kept = douglasPeuckerIndices(coords, toleranceM, mustKeep);
  const guideCoords = kept.map((i) => coords[i]);

  const guideSegs: GuideSegment[] = [];
  for (let k = 0; k < kept.length - 1; k++) {
    guideSegs.push({ type: dominantSegType(coords, segs, kept[k], kept[k + 1]) });
  }

  const guideElevator = new Map<number, string>();
  for (const [origIdx, text] of elevatorTextAtCoord) {
    const guideIdx = kept.indexOf(origIdx);
    if (guideIdx >= 0) guideElevator.set(guideIdx, text);
  }

  return { coords: guideCoords, segs: guideSegs, elevatorText: guideElevator };
}
