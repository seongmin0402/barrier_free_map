import type { LatLng } from "./geo";
import { haversineMeters } from "./geo";
import type { NavigationCameraMap } from "./nav-camera";

const PRELOAD_SPACING_M = 75;
const PRELOAD_MAX_POINTS = 14;

function sampleRoutePoints(coords: LatLng[]): LatLng[] {
  if (coords.length < 2) return coords.length ? [coords[0]] : [];
  const out: LatLng[] = [coords[0]];
  let acc = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const len = haversineMeters(a, b);
    acc += len;
    if (acc >= PRELOAD_SPACING_M) {
      out.push(b);
      acc = 0;
      if (out.length >= PRELOAD_MAX_POINTS) break;
    }
  }

  const last = coords[coords.length - 1];
  if (out[out.length - 1] !== last && out.length < PRELOAD_MAX_POINTS) {
    out.push(last);
  }
  return out;
}

export type TilePreloadMap = NavigationCameraMap & {
  relayout?: () => void;
};

/**
 * 안내 시작 후 idle 틈에 경로 코리더 타일을 미리 받음.
 * programmaticCameraRef가 true일 때는 호출 측에서 스킵한다.
 */
export function preloadRouteTiles(
  map: TilePreloadMap,
  createLatLng: (lat: number, lng: number) => unknown,
  coords: LatLng[],
  onPointApplied?: () => void,
): () => void {
  const samples = sampleRoutePoints(coords);
  if (!samples.length || !map.setCenter) return () => {};

  let index = 0;
  let cancelled = false;
  let idleListener: unknown = null;

  const maps = typeof window !== "undefined" ? window.naver?.maps : undefined;
  const addListener = maps?.Event?.addListener as
    | ((target: unknown, evt: string, handler: () => void) => unknown)
    | undefined;
  const removeListener = (maps?.Event as { removeListener?: (l: unknown) => void } | undefined)
    ?.removeListener;

  const step = () => {
    if (cancelled || index >= samples.length) {
      if (idleListener != null) removeListener?.(idleListener);
      return;
    }
    const p = samples[index++];
    try {
      map.setCenter?.(createLatLng(p.lat, p.lng));
      onPointApplied?.();
    } catch {
      /* ignore */
    }
    if (index < samples.length && addListener) {
      idleListener = addListener(map, "idle", step);
    }
  };

  if (addListener) {
    idleListener = addListener(map, "idle", step);
  } else {
    step();
  }

  return () => {
    cancelled = true;
    if (idleListener != null) removeListener?.(idleListener);
  };
}
