import { haversineMeters, type LatLng } from "./geo";

const MAX_JUMP_M = 40;
const MIN_MOVE_M = 0.1;

export interface GpsSmoother {
  reset(): void;
  filter(raw: LatLng, accuracyM?: number | null): LatLng;
  /** 큰 점프(이전 위치 오류·재시작) — 스무딩 상태를 raw로 리셋 */
  hardSnap(raw: LatLng): LatLng;
}

/** GPS 좌표 지수 이동 평균 + 급격한 튐 억제 */
export function createGpsSmoother(baseAlpha = 0.38): GpsSmoother {
  let smoothed: LatLng | null = null;
  let samples = 0;

  return {
    reset() {
      smoothed = null;
      samples = 0;
    },
    hardSnap(raw: LatLng) {
      smoothed = { ...raw };
      samples = 1;
      return raw;
    },
    filter(raw: LatLng, accuracyM?: number | null): LatLng {
      samples++;
      if (!smoothed) {
        smoothed = { ...raw };
        return raw;
      }

      const jump = haversineMeters(smoothed, raw);
      const accuracy = accuracyM ?? null;

      if (samples > 5 && jump > MAX_JUMP_M && (accuracy == null || accuracy > 12)) {
        if (accuracy != null && accuracy <= 80) {
          smoothed = { ...raw };
          return raw;
        }
        return smoothed;
      }

      if (jump < MIN_MOVE_M) {
        return smoothed;
      }

      let alpha = baseAlpha;
      if (accuracy != null) {
        if (accuracy > 30) alpha = 0.16;
        else if (accuracy > 18) alpha = 0.24;
        else if (accuracy < 8) alpha = 0.48;
      }

      smoothed = {
        lat: smoothed.lat + alpha * (raw.lat - smoothed.lat),
        lng: smoothed.lng + alpha * (raw.lng - smoothed.lng),
      };
      return smoothed;
    },
  };
}
