/** 위경도 유틸 (미터 거리, 방위각, 표시 포맷) */

export interface LatLng {
  lat: number;
  lng: number;
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
    const n = Math.round(meters);
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
