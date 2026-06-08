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

export type FuseHeadingInput = {
  /** 기기 나침반 (DeviceOrientation) */
  compassHeading: number | null;
  compassAgeMs: number;
  /** Geolocation coords.heading */
  gpsHeading: number | null | undefined;
  /** 이전→현재 GPS 좌표 이동 방향 */
  movementBearing: number | null;
  /** 경로 진행 방향 */
  routeHeading: number | null;
  /** GPS speed (m/s). null이면 이동 거리로 추정 */
  speedMps: number | null;
  /** 직전 GPS와의 거리(m) */
  movedMeters: number;
};

const COMPASS_MAX_AGE_MS = 800;
const COMPASS_STALE_MS = 2500;

/**
 * 나침반 · GPS · 이동 · 경로 방향을 상황에 맞게 융합.
 * - 정지/저속: 나침반 우선 (바라보는 방향)
 * - 보행 중: 나침반 + GPS/이동 방향 블렌드
 * - 나침반 없음: GPS heading → 이동 → 경로
 */
export function fuseNavigationHeading(input: FuseHeadingInput): number | null {
  const {
    compassHeading,
    compassAgeMs,
    gpsHeading,
    movementBearing,
    routeHeading,
    speedMps,
    movedMeters,
  } = input;

  const compassOk =
    compassHeading != null &&
    Number.isFinite(compassHeading) &&
    compassAgeMs <= COMPASS_STALE_MS;
  const compassFresh = compassOk && compassAgeMs <= COMPASS_MAX_AGE_MS;

  const gpsOk = gpsHeading != null && Number.isFinite(gpsHeading) && gpsHeading >= 0;
  const moving =
    (speedMps != null && speedMps > 0.6) ||
    movedMeters > 1.5 ||
    movementBearing != null;

  let speed = speedMps ?? 0;
  if (speedMps == null && movedMeters > 0) {
    speed = Math.min(movedMeters * 2, 2.5);
  }

  if (compassOk && moving && (gpsOk || movementBearing != null)) {
    const course = gpsOk ? gpsHeading! : movementBearing!;
    const motionWeight = Math.min(1, Math.max(0, (speed - 0.4) / 2.2));
    const freshnessBoost = compassFresh ? 0 : 0.25;
    const compassWeight = Math.max(0.2, 0.75 - motionWeight * 0.55 - freshnessBoost);
    return lerpAngleDeg(compassHeading!, course, 1 - compassWeight);
  }

  if (compassOk) return compassHeading!;

  if (gpsOk && moving) return gpsHeading!;
  if (movementBearing != null && movedMeters > 0.8) return movementBearing;
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

export const NAV_FOLLOW_ZOOM = 16;
/** look-ahead가 클수록 방향 변화 시 setCenter 점프가 커져 타일 재로딩이 잦아짐 */
export const NAV_LOOK_AHEAD_M = 24;
/** 화면 가장자리 이 비율 안쪽이면 지도를 움직이지 않음 (edge follow) */
export const NAV_EDGE_MARGIN_RATIO = 0.24;
/** edge follow 재중심 최소 간격(ms) — 타일 요청 겹침 방지 */
export const NAV_CAMERA_MIN_INTERVAL_MS = 900;
export const NAV_MAP_ROTATION_SCALE = 1.38;

/** rAF 추적 보간 (60fps 기준) */
export const NAV_POS_LERP = 0.28;
export const NAV_HEADING_LERP = 0.22;

export type NavigationCameraMap = {
  setCenter?: (ll: unknown) => void;
  setZoom?: (z: number) => void;
  getZoom?: () => number;
  getSize?: () => { width: number; height: number };
  getProjection?: () => {
    fromCoordToOffset: (coord: unknown) => { x: number; y: number };
  };
  panBy?: (point: unknown) => void;
};

export type ScreenOffset = { x: number; y: number };
export type MapSize = { width: number; height: number };

/** 사용자 좌표의 지도 뷰포트 픽셀 위치 */
export function getUserScreenOffset(
  map: NavigationCameraMap,
  createLatLng: (lat: number, lng: number) => unknown,
  user: LatLng,
): ScreenOffset | null {
  const projection = map.getProjection?.();
  if (!projection?.fromCoordToOffset) return null;
  return projection.fromCoordToOffset(createLatLng(user.lat, user.lng));
}

/**
 * 사용자 마커가 안전 영역(화면 중앙부)을 벗어났을 때만 true.
 * 카카오/네이버 앱 길안내의 edge-follow와 동일한 원리.
 */
export function shouldRecenterEdgeFollow(
  userOffset: ScreenOffset,
  mapSize: MapSize,
  bottomObstructionVh = 0,
  marginRatio = NAV_EDGE_MARGIN_RATIO,
): boolean {
  const obstructionPx = (bottomObstructionVh / 100) * mapSize.height;
  const visibleBottom = mapSize.height - obstructionPx;
  const visibleH = Math.max(mapSize.height * 0.3, visibleBottom);
  const marginX = mapSize.width * marginRatio;
  const marginY = visibleH * marginRatio;
  const minX = marginX;
  const maxX = mapSize.width - marginX;
  const minY = marginY;
  const maxY = visibleBottom - marginY;
  return (
    userOffset.x < minX ||
    userOffset.x > maxX ||
    userOffset.y < minY ||
    userOffset.y > maxY
  );
}

export type NavigationCameraOptions = {
  zoom?: number;
  /** 모바일 하단 패널 높이(vh). 0이면 하단 가림 없음 */
  bottomObstructionVh?: number;
  /** 첫 GPS 등 즉시 줌·중심 맞춤 */
  snap?: boolean;
  /** true일 때만 panBy로 하단 패널 보정 (매 프레임 panBy는 지도 타일 깨짐 유발) */
  adjustViewport?: boolean;
  /** look-ahead 거리(m). 기본 NAV_LOOK_AHEAD_M */
  lookAheadM?: number;
  /** 카메라 look-ahead 방향(deg). 미지정 시 headingDeg 사용 */
  lookAheadHeadingDeg?: number;
};

function isValidLatLng(user: LatLng): boolean {
  return (
    Number.isFinite(user.lat) &&
    Number.isFinite(user.lng) &&
    Math.abs(user.lat) <= 90 &&
    Math.abs(user.lng) <= 180
  );
}

/**
 * 길안내 카메라 — setCenter(look-ahead) + (snap 시 1회) panBy 뷰포트 보정.
 * 반환값은 지도 회전 transform-origin(픽셀)입니다.
 *
 * 타일 재로딩을 줄이려면 호출 측(campus-map rAF)에서 이동·방향 임계값·최소 간격으로
 * setCenter 빈도를 제한하고, panBy는 최초 뷰포트 보정(adjustViewport) 1회만 사용한다.
 */
export function applyNavigationCamera(
  map: NavigationCameraMap,
  createLatLng: (lat: number, lng: number) => unknown,
  createPoint: (x: number, y: number) => unknown,
  user: LatLng,
  headingDeg: number,
  options: NavigationCameraOptions = {},
): { originX: number; originY: number } | null {
  if (!isValidLatLng(user)) return null;

  const zoom = options.zoom ?? NAV_FOLLOW_ZOOM;
  const curZoom = map.getZoom?.() ?? 0;
  if (options.snap || curZoom < zoom) {
    map.setZoom?.(zoom);
  }

  const heading = Number.isFinite(headingDeg) ? headingDeg : 0;
  const lookAheadHeading = Number.isFinite(options.lookAheadHeadingDeg)
    ? options.lookAheadHeadingDeg!
    : heading;
  const lookAheadM = options.lookAheadM ?? NAV_LOOK_AHEAD_M;
  const ahead = navigationCenterForUser(user, lookAheadHeading, lookAheadM);
  map.setCenter?.(createLatLng(ahead.lat, ahead.lng));

  const projection = map.getProjection?.();
  const size = map.getSize?.();
  if (!projection?.fromCoordToOffset || !size?.width || !size?.height) {
    return size ? { originX: size.width / 2, originY: size.height / 2 } : null;
  }

  const userLl = createLatLng(user.lat, user.lng);
  let userOffset = projection.fromCoordToOffset(userLl);

  if (options.adjustViewport && map.panBy) {
    const obstructionVh = Math.max(0, options.bottomObstructionVh ?? 0);
    const obstructionPx = (obstructionVh / 100) * size.height;
    const visibleH = Math.max(size.height * 0.22, size.height - obstructionPx);
    const targetUserY = obstructionPx + visibleH * 0.4;
    const targetUserX = size.width * 0.5;

    const panX = targetUserX - userOffset.x;
    const panY = targetUserY - userOffset.y;

    if (Math.abs(panX) > 0.5 || Math.abs(panY) > 0.5) {
      map.panBy(createPoint(panX, panY));
      userOffset = projection.fromCoordToOffset(userLl);
    }
  }

  return { originX: userOffset.x, originY: userOffset.y };
}
