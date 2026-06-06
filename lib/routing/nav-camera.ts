import { bearingDeg, type LatLng } from "./geo";
import type { ComputedRoute } from "./types";
import type { RouteProgress } from "./progress";

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** 두 각도(0~360) 사이를 최단 경로로 보간 */
export function lerpAngleDeg(from: number, to: number, t: number): number {
  let diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
}

export function lerpLatLng(a: LatLng, b: LatLng, t: number): LatLng {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

/** bearing 방향으로 distanceM만큼 이동한 좌표 */
export function offsetByMeters(origin: LatLng, bearing: number, distanceM: number): LatLng {
  const brng = toRad(bearing);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const angDist = distanceM / EARTH_RADIUS_M;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

/** 진행 방향 기준 카메라 중심 — 사용자는 화면 아래쪽, 앞길이 위쪽 */
export function navigationCenterForUser(user: LatLng, headingDeg: number, backOffsetM = 38): LatLng {
  return offsetByMeters(user, (headingDeg + 360) % 360, backOffsetM);
}

/** GPS heading + 이동 방향 + 경로 방향을 합쳐 부드러운 방위각 계산 */
export function resolveNavigationHeading(
  prev: LatLng | null,
  current: LatLng,
  gpsHeading: number | null | undefined,
  routeHeading: number | null,
): number | null {
  if (gpsHeading != null && Number.isFinite(gpsHeading) && gpsHeading >= 0) {
    return gpsHeading;
  }
  if (prev) {
    const moved =
      Math.abs(prev.lat - current.lat) > 1e-7 || Math.abs(prev.lng - current.lng) > 1e-7;
    if (moved) return bearingDeg(prev, current);
  }
  return routeHeading;
}

/** 경로상 스냅 지점 기준 앞쪽 구간 방향 */
export function headingAlongRoute(route: ComputedRoute, progress: RouteProgress): number | null {
  const { coords } = route;
  if (coords.length < 2) return null;

  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const mid = {
      lat: (coords[i].lat + coords[i + 1].lat) / 2,
      lng: (coords[i].lng + coords[i + 1].lng) / 2,
    };
    const d =
      (mid.lat - progress.snapped.lat) ** 2 + (mid.lng - progress.snapped.lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  const from = coords[bestIdx];
  const to = coords[Math.min(bestIdx + 1, coords.length - 1)];
  if (from.lat === to.lat && from.lng === to.lng) return null;
  return bearingDeg(from, to);
}

export const NAV_FOLLOW_ZOOM = 17;
export const NAV_MAP_ROTATION_SCALE = 1.38;

/** rAF 추적 보간 (60fps 기준) */
export const NAV_POS_LERP = 0.24;
export const NAV_HEADING_LERP = 0.17;
