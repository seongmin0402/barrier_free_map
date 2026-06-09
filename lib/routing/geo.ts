/** 위경도 유틸 (미터 거리, 방위각, 표시 포맷) */

export interface LatLng {
  lat: number;
  lng: number;
}

/** 공주대 신관 캠퍼스 주변 — 잘못된 GPS·경로 좌표로 지도가 튀는 것 방지 */
export const CAMPUS_NAV_MAP_BOUNDS = {
  minLat: 36.43,
  maxLat: 36.52,
  minLng: 127.08,
  maxLng: 127.2,
} as const;

export function isFiniteLatLng(p: LatLng): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

/** 길안내·지도 카메라에 쓸 수 있는 좌표 (null island·캠퍼스 밖 오류 GPS 제외) */
export function isNavMapLatLng(p: LatLng): boolean {
  if (!isFiniteLatLng(p)) return false;
  if (Math.abs(p.lat) < 1e-4 && Math.abs(p.lng) < 1e-4) return false;
  const { minLat, maxLat, minLng, maxLng } = CAMPUS_NAV_MAP_BOUNDS;
  return p.lat >= minLat && p.lat <= maxLat && p.lng >= minLng && p.lng <= maxLng;
}

export function filterNavMapPoints(list: LatLng[]): LatLng[] {
  return list.filter(isNavMapLatLng);
}

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** 두 좌표 사이의 거리(m) — Haversine */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** a에서 b로 향하는 방위각(0~360, 북=0, 시계방향) */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/** 두 방위각 차이를 -180~180 으로 정규화 (양수=우회전 방향) */
export function angleDelta(fromBearing: number, toBearing: number): number {
  let d = toBearing - fromBearing;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/** 거리(m)를 사람이 읽기 좋은 문자열로 */
export function formatDistance(meters: number, locale: "ko" | "en" = "ko"): string {
  if (meters < 1) return locale === "en" ? "0 m" : "0m";
  if (meters < 1000) {
    // 현장 보행보다 polyline 합이 길게 나오는 경향 — 300m 미만은 내림 표시
    const n = meters < 300 ? Math.floor(meters) : Math.round(meters);
    return locale === "en" ? `${n} m` : `${n}m`;
  }
  const km = meters / 1000;
  const formatted =
    km < 10 ? km.toFixed(1) : km.toFixed(0);
  return locale === "en" ? `${formatted} km` : `${formatted}km`;
}

/**
 * 점 p를 선분 a-b에 투영한 지점과, p~투영점 거리(m)를 반환.
 * 짧은 거리에서는 평면 근사로 충분.
 */
export function projectOnSegment(
  p: LatLng,
  a: LatLng,
  b: LatLng,
): { point: LatLng; distance: number; t: number } {
  const latRef = toRad((a.lat + b.lat) / 2);
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(latRef);

  const ax = a.lng * mPerDegLng;
  const ay = a.lat * mPerDegLat;
  const bx = b.lng * mPerDegLng;
  const by = b.lat * mPerDegLat;
  const px = p.lng * mPerDegLng;
  const py = p.lat * mPerDegLat;

  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;
  let t = abLenSq === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * abx;
  const projY = ay + t * aby;
  const point: LatLng = { lng: projX / mPerDegLng, lat: projY / mPerDegLat };
  const dx = px - projX;
  const dy = py - projY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return { point, distance, t };
}

/** 경로상 좌표 인덱스 (동일 참조 우선, 이후 최근접) */
export function indexOfCoord(coords: LatLng[], point: LatLng, fromIdx = 0): number {
  for (let i = fromIdx; i < coords.length; i++) {
    if (coords[i] === point) return i;
  }
  for (let i = 0; i < fromIdx; i++) {
    if (coords[i] === point) return i;
  }
  let best = -1;
  let bestD = Infinity;
  for (let i = fromIdx; i < coords.length; i++) {
    const d = haversineMeters(point, coords[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** coords[fromIdx] → coords[toIdx] 구간 누적 거리(m) */
export function pathLengthAlong(coords: LatLng[], fromIdx: number, toIdx: number): number {
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return 0;
  const [lo, hi] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
  let sum = 0;
  for (let i = lo; i < hi; i++) {
    sum += haversineMeters(coords[i], coords[i + 1]);
  }
  return sum;
}
