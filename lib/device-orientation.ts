import { lerpAngleDeg } from "@/lib/routing/nav-camera";

/** iOS 13+ 나침반 권한 API */
type DeviceOrientationEventConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

export type DeviceHeadingSnapshot = {
  heading: number | null;
  /** 마지막 유효 heading 수신 시각 (ms) */
  updatedAt: number;
  permission: "granted" | "denied" | "prompt" | "unsupported";
  active: boolean;
};

export function supportsDeviceOrientation(): boolean {
  return typeof window !== "undefined" && "DeviceOrientationEvent" in window;
}

export function supportsCompassPermissionRequest(): boolean {
  if (typeof window === "undefined") return false;
  const Ctor = DeviceOrientationEvent as DeviceOrientationEventConstructor;
  return typeof Ctor.requestPermission === "function";
}

/** iOS Safari 등 — 사용자 탭(안내 시작) 직후 호출 */
export async function requestDeviceOrientationPermission(): Promise<boolean> {
  if (!supportsDeviceOrientation()) return false;
  const Ctor = DeviceOrientationEvent as DeviceOrientationEventConstructor;
  if (typeof Ctor.requestPermission === "function") {
    try {
      const result = await Ctor.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

function screenOrientationAngle(): number {
  if (typeof window === "undefined") return 0;
  return window.screen?.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0;
}

/**
 * DeviceOrientationEvent → 북쪽 기준 방위각(0~360°, 시계 방향).
 * iOS: webkitCompassHeading · Android/Chrome: absolute alpha + 화면 회전 보정
 */
export function parseCompassHeading(event: DeviceOrientationEvent): number | null {
  const ios = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
  if (ios != null && Number.isFinite(ios) && ios >= 0) {
    return ios % 360;
  }

  if (event.alpha == null || !Number.isFinite(event.alpha)) return null;

  if (event.absolute) {
    return ((360 - event.alpha) % 360 + 360) % 360;
  }

  const angle = screenOrientationAngle();
  return ((360 - event.alpha + angle) % 360 + 360) % 360;
}

const COMPASS_SMOOTH = 0.22;

/** 저역 통과 필터로 나침반 떨림 완화 */
export function smoothCompassHeading(prev: number | null, next: number): number {
  if (prev == null) return next;
  return lerpAngleDeg(prev, next, COMPASS_SMOOTH);
}

export function createDeviceHeadingSnapshot(): DeviceHeadingSnapshot {
  return {
    heading: null,
    updatedAt: 0,
    permission: supportsDeviceOrientation() ? "prompt" : "unsupported",
    active: false,
  };
}

export function compassAgeMs(snapshot: DeviceHeadingSnapshot, now = Date.now()): number {
  if (snapshot.heading == null || snapshot.updatedAt <= 0) return Infinity;
  return now - snapshot.updatedAt;
}

/** GPS watchPosition에서 갱신되는 이동·속도 스냅샷 */
export type NavMotionSnapshot = {
  gpsHeading: number | null;
  speedMps: number | null;
  movedMeters: number;
  movementBearing: number | null;
};
