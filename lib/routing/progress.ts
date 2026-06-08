import { haversineMeters, indexOfCoord, projectOnSegment, type LatLng } from "./geo";
import { walkPathLengthBetween } from "./polyline-simplify";
import type { ComputedRoute, RouteStep, WalkwayType } from "./types";

export interface RouteProgress {
  /** 현재 진행 중인 단계 인덱스 */
  stepIndex: number;
  /** 다음 회전/도착 지점까지 거리(m) */
  distanceToNext: number;
  /** 남은 총 거리(m) */
  remaining: number;
  /** 경로에서 벗어난 정도(m) */
  offRoute: number;
  /** 경로상 가장 가까운 좌표 */
  snapped: LatLng;
  /** 가장 가까운 세그먼트 인덱스 — 다음 계산 힌트용 */
  nearestSegmentIndex: number;
}

export type ComputeProgressOptions = {
  /** 직전 계산의 nearestSegmentIndex — 근처만 스캔 */
  segmentHint?: number;
};

type ProgressRouteCache = {
  cum: number[];
  total: number;
  stepAlong: number[];
  segList: { type: WalkwayType }[];
};

const progressCache = new WeakMap<ComputedRoute, ProgressRouteCache>();

/** 좌표열의 누적 보행 거리 배열 */
function cumulativeWalkDistances(coords: LatLng[], segs: WalkwayType[]): number[] {
  const segList = segs.map((type) => ({ type }));
  const cum = [0];
  for (let i = 0; i < coords.length - 1; i++) {
    cum.push(cum[i] + walkPathLengthBetween(coords, segList, i, i + 1));
  }
  return cum;
}

function stepAlongDistance(step: RouteStep, coords: LatLng[], cum: number[]): number {
  const idx = indexOfCoord(coords, step.at);
  if (idx >= 0) return cum[idx];
  let bi = 0;
  let bd = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = haversineMeters(step.at, coords[i]);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  return cum[bi];
}

function getProgressCache(route: ComputedRoute): ProgressRouteCache {
  let cached = progressCache.get(route);
  if (cached) return cached;

  const { coords, steps, segmentTypes } = route;
  const segList = segmentTypes.map((type) => ({ type }));
  const cum = cumulativeWalkDistances(coords, segmentTypes);
  const stepAlong = steps.map((step) => stepAlongDistance(step, coords, cum));

  cached = {
    cum,
    total: cum[cum.length - 1] ?? 0,
    stepAlong,
    segList,
  };
  progressCache.set(route, cached);
  return cached;
}

function findNearestSegment(
  user: LatLng,
  coords: LatLng[],
  cum: number[],
  segList: { type: WalkwayType }[],
  segmentHint?: number,
): { bestDist: number; bestAlong: number; bestSnap: LatLng; bestSeg: number } {
  const segCount = coords.length - 1;
  if (segCount < 1) {
    return { bestDist: Infinity, bestAlong: 0, bestSnap: coords[0], bestSeg: 0 };
  }

  const scanRange = (start: number, end: number) => {
    let bestDist = Infinity;
    let bestAlong = 0;
    let bestSnap: LatLng = coords[0];
    let bestSeg = 0;

    const s = Math.max(0, start);
    const e = Math.min(segCount - 1, end);
    for (let i = s; i <= e; i++) {
      const { point, distance, t } = projectOnSegment(user, coords[i], coords[i + 1]);
      if (distance < bestDist) {
        bestDist = distance;
        const segWalkLen = walkPathLengthBetween(coords, segList, i, i + 1);
        bestAlong = cum[i] + segWalkLen * t;
        bestSnap = point;
        bestSeg = i;
      }
    }
    return { bestDist, bestAlong, bestSnap, bestSeg };
  };

  const hint = Number.isFinite(segmentHint) ? Math.floor(segmentHint!) : 0;
  let result = scanRange(hint - 10, hint + 28);

  if (result.bestDist > 22) {
    result = scanRange(0, segCount - 1);
  }

  return result;
}

/** GPS 위치를 경로에 투영해 진행 상황 계산 */
export function computeProgress(
  route: ComputedRoute,
  user: LatLng,
  options: ComputeProgressOptions = {},
): RouteProgress | null {
  const { coords, steps } = route;
  if (coords.length < 2) return null;

  const cache = getProgressCache(route);
  const { cum, total, stepAlong, segList } = cache;

  const { bestDist, bestAlong, bestSnap, bestSeg } = findNearestSegment(
    user,
    coords,
    cum,
    segList,
    options.segmentHint,
  );

  let stepIndex = 0;
  for (let i = 0; i < steps.length; i++) {
    const along = stepAlong[i];
    if (along > bestAlong + 14) {
      stepIndex = i;
      break;
    }
    stepIndex = i;
  }

  const remaining = Math.max(0, total - bestAlong);

  const arriveIdx = steps.length - 1;
  if (
    stepIndex === arriveIdx &&
    steps[arriveIdx]?.maneuver === "arrive" &&
    remaining > 25
  ) {
    stepIndex = Math.max(0, arriveIdx - 1);
  }

  const adjustedNextAlong = stepAlong[stepIndex] ?? 0;
  const adjustedDistanceToNext = Math.max(0, adjustedNextAlong - bestAlong);

  return {
    stepIndex,
    distanceToNext: adjustedDistanceToNext,
    remaining,
    offRoute: bestDist,
    snapped: bestSnap,
    nearestSegmentIndex: bestSeg,
  };
}
