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
}

/** 좌표열의 누적 보행 거리 배열 */
function cumulativeWalkDistances(coords: LatLng[], segs: WalkwayType[]): number[] {
  const segList = segs.map((type) => ({ type }));
  const cum = [0];
  for (let i = 0; i < coords.length - 1; i++) {
    cum.push(cum[i] + walkPathLengthBetween(coords, segList, i, i + 1));
  }
  return cum;
}

/** GPS 위치를 경로에 투영해 진행 상황 계산 */
export function computeProgress(
  route: ComputedRoute,
  user: LatLng,
): RouteProgress | null {
  const { coords, steps, segmentTypes } = route;
  if (coords.length < 2) return null;

  const cum = cumulativeWalkDistances(coords, segmentTypes);
  const total = cum[cum.length - 1];
  const segList = segmentTypes.map((type) => ({ type }));

  // 가장 가까운 세그먼트 찾기
  let bestDist = Infinity;
  let bestAlong = 0;
  let bestSnap: LatLng = coords[0];
  for (let i = 0; i < coords.length - 1; i++) {
    const { point, distance, t } = projectOnSegment(user, coords[i], coords[i + 1]);
    if (distance < bestDist) {
      bestDist = distance;
      const segWalkLen = walkPathLengthBetween(coords, segList, i, i + 1);
      bestAlong = cum[i] + segWalkLen * t;
      bestSnap = point;
    }
  }

  // 각 단계의 경로상 위치(누적거리)
  const stepAlong = (step: RouteStep): number => {
    const idx = indexOfCoord(coords, step.at);
    if (idx >= 0) return cum[idx];
    // 참조가 안 맞으면 좌표로 최근접 탐색
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
  };

  // 현재 위치 기준 안내 단계 — 지나지 않은 다음 단계, 기본은 출발(0)
  let stepIndex = 0;
  for (let i = 0; i < steps.length; i++) {
    const along = stepAlong(steps[i]);
    if (along > bestAlong + 8) {
      stepIndex = i;
      break;
    }
    stepIndex = i;
  }

  const nextAlong = stepAlong(steps[stepIndex]);
  const distanceToNext = Math.max(0, nextAlong - bestAlong);
  const remaining = Math.max(0, total - bestAlong);

  // GPS가 경로 끝에 붙었지만 실제로는 멀리 있는 경우 arrive 단계로 점프하지 않음
  const arriveIdx = steps.length - 1;
  if (
    stepIndex === arriveIdx &&
    steps[arriveIdx]?.maneuver === "arrive" &&
    remaining > 25
  ) {
    stepIndex = Math.max(0, arriveIdx - 1);
  }

  const adjustedNextAlong = stepAlong(steps[stepIndex]);
  const adjustedDistanceToNext = Math.max(0, adjustedNextAlong - bestAlong);

  return {
    stepIndex,
    distanceToNext: adjustedDistanceToNext,
    remaining,
    offRoute: bestDist,
    snapped: bestSnap,
  };
}
