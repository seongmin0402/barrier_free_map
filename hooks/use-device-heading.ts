"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  compassAgeMs,
  createDeviceHeadingSnapshot,
  parseCompassHeading,
  requestDeviceOrientationPermission,
  smoothCompassHeading,
  supportsDeviceOrientation,
  type DeviceHeadingSnapshot,
} from "@/lib/device-orientation";

/**
 * 기기 나침반(DeviceOrientation) 추적.
 * rAF/지도 루프에서 ref를 직접 읽어 React 리렌더 없이 60fps에 가깝게 사용.
 */
export function useDeviceHeading(enabled: boolean) {
  const snapshotRef = useRef<DeviceHeadingSnapshot>(createDeviceHeadingSnapshot());
  const smoothedRef = useRef<number | null>(null);

  const requestPermission = useCallback(async () => {
    if (!supportsDeviceOrientation()) {
      snapshotRef.current.permission = "unsupported";
      return false;
    }
    const granted = await requestDeviceOrientationPermission();
    snapshotRef.current.permission = granted ? "granted" : "denied";
    return granted;
  }, []);

  useEffect(() => {
    if (!enabled) {
      snapshotRef.current = createDeviceHeadingSnapshot();
      smoothedRef.current = null;
      return;
    }

    if (!supportsDeviceOrientation()) {
      snapshotRef.current.permission = "unsupported";
      return;
    }

    let lastEventAt = 0;
    const onOrientation = (event: DeviceOrientationEvent) => {
      const now = performance.now();
      if (now - lastEventAt < 14) return;
      lastEventAt = now;

      const raw = parseCompassHeading(event);
      if (raw == null) return;

      const smoothed = smoothCompassHeading(smoothedRef.current, raw);
      smoothedRef.current = smoothed;
      snapshotRef.current = {
        heading: smoothed,
        updatedAt: Date.now(),
        permission: snapshotRef.current.permission === "denied" ? "denied" : "granted",
        active: true,
      };
    };

    const useAbsolute = typeof window !== "undefined" && "ondeviceorientationabsolute" in window;
    const eventName: "deviceorientationabsolute" | "deviceorientation" = useAbsolute
      ? "deviceorientationabsolute"
      : "deviceorientation";

    window.addEventListener(eventName, onOrientation as EventListener, true);

    if (snapshotRef.current.permission === "prompt") {
      snapshotRef.current.permission = "granted";
    }
    snapshotRef.current.active = true;

    return () => {
      window.removeEventListener(eventName, onOrientation as EventListener, true);
      snapshotRef.current = createDeviceHeadingSnapshot();
      smoothedRef.current = null;
    };
  }, [enabled]);

  return {
    deviceHeadingRef: snapshotRef,
    requestPermission,
    getCompassAgeMs: () => compassAgeMs(snapshotRef.current),
  };
}
