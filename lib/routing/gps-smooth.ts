import { haversineMeters, type LatLng } from "./geo";

const MAX_JUMP_M = 40;
const MIN_MOVE_M = 0.25;

export interface GpsSmoother {
  reset(): void;
  filter(raw: LatLng, accuracyM?: number | null): LatLng;
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
    filter(raw: LatLng, accuracyM?: number | null): LatLng {
      samples++;
      if (!smoothed) {
        smoothed = { ...raw };
        return raw;
      }

      const jump = haversineMeters(smoothed, raw);
      const accuracy = accuracyM ?? null;

      if (samples > 2 && jump > MAX_JUMP_M && (accuracy == null || accuracy > 12)) {
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
