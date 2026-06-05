import { haversineMeters, projectOnSegment, type LatLng } from "./geo";
import type { ComputedRoute, RouteStep } from "./types";

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

/** 좌표열의 누적 거리 배열 */
function cumulativeDistances(coords: LatLng[]): number[] {
  const cum = [0];
  for (let i = 0; i < coords.length - 1; i++) {
    cum.push(cum[i] + haversineMeters(coords[i], coords[i + 1]));
  }
  return cum;
}

/** GPS 위치를 경로에 투영해 진행 상황 계산 */
export function computeProgress(
  route: ComputedRoute,
  user: LatLng,
): RouteProgress | null {
  const { coords, steps } = route;
  if (coords.length < 2) return null;

  const cum = cumulativeDistances(coords);
  const total = cum[cum.length - 1];

  // 가장 가까운 세그먼트 찾기
  let bestDist = Infinity;
  let bestAlong = 0;
  let bestSnap: LatLng = coords[0];
  for (let i = 0; i < coords.length - 1; i++) {
    const { point, distance, t } = projectOnSegment(user, coords[i], coords[i + 1]);
    if (distance < bestDist) {
      bestDist = distance;
      const segLen = haversineMeters(coords[i], coords[i + 1]);
      bestAlong = cum[i] + segLen * t;
      bestSnap = point;
    }
  }

  // 각 단계의 경로상 위치(누적거리)
  const stepAlong = (step: RouteStep): number => {
    const idx = coords.indexOf(step.at);
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

  // 현재 위치 이후의 첫 단계
  let stepIndex = steps.length - 1;
  for (let i = 0; i < steps.length; i++) {
    const along = stepAlong(steps[i]);
    if (along > bestAlong + 1) {
      stepIndex = i;
      break;
    }
  }

  const nextAlong = stepAlong(steps[stepIndex]);
  const distanceToNext = Math.max(0, nextAlong - bestAlong);
  const remaining = Math.max(0, total - bestAlong);

  return {
    stepIndex,
    distanceToNext,
    remaining,
    offRoute: bestDist,
    snapped: bestSnap,
  };
}
