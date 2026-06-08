"use client";

import { useEffect, useState, type RefObject } from "react";
import type { NavMetricsDisplayRef } from "@/hooks/use-navigation";

const METRICS_UI_INTERVAL_MS = 220;

/** HUD·패널 공통 — metricsDisplayRef를 rAF로 읽어 React 리렌더 최소화 */
export function useNavMetricsDisplay(
  metricsDisplayRef: NavMetricsDisplayRef,
  active: boolean,
): { remaining: number | null; distanceToNext: number | null } {
  const [metrics, setMetrics] = useState<{
    remaining: number | null;
    distanceToNext: number | null;
  }>({ remaining: null, distanceToNext: null });

  useEffect(() => {
    if (!active) {
      setMetrics({ remaining: null, distanceToNext: null });
      return;
    }

    let frame: number | null = null;
    let lastUiAt = 0;

    const tick = (now: number) => {
      if (now - lastUiAt >= METRICS_UI_INTERVAL_MS) {
        lastUiAt = now;
        const snap = metricsDisplayRef.current;
        if (snap) {
          setMetrics({
            remaining: Math.round(snap.remaining),
            distanceToNext: Math.max(0, Math.round(snap.distanceToNext)),
          });
        }
      }
      frame = requestAnimationFrame(tick);
    };

    const snap = metricsDisplayRef.current;
    if (snap) {
      setMetrics({
        remaining: Math.round(snap.remaining),
        distanceToNext: Math.max(0, Math.round(snap.distanceToNext)),
      });
    }

    frame = requestAnimationFrame(tick);
    return () => {
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [active, metricsDisplayRef]);

  return metrics;
}
