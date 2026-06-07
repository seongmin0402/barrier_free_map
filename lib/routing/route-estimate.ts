import type { ComputedRoute } from "./types";

/** 접근성을 고려한 여유 보행 속도 (약 0.7 m/s) */
const WALK_SPEED_MPS = 0.7;

export function estimateWalkMinutes(route: ComputedRoute): number {
  let seconds = route.distance / WALK_SPEED_MPS;
  for (const t of route.segmentTypes) {
    if (t === "crosswalk") seconds += 25;
    else if (t === "stairs") seconds += 20;
    else if (t === "ramp") seconds += 8;
    else if (t === "elevator") seconds += 18;
  }
  const turns = route.steps.filter(
    (s) => s.maneuver !== "depart" && s.maneuver !== "arrive" && s.maneuver !== "straight",
  ).length;
  seconds += turns * 5;
  return Math.max(1, Math.ceil(seconds / 60));
}
