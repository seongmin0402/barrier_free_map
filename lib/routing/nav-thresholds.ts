/** 패널 경고 — 재탐색보다 먼저 표시 */
export const OFF_ROUTE_WARN_M = 25;

/** 경로 이탈 시 현재 위치→목적지 재탐색 */
export const OFF_ROUTE_REROUTE_M = 30;

/** 도착 판정 시 허용하는 최대 경로 이탈(m) */
export const OFF_ROUTE_ARRIVE_MAX_M = 30;

/** 안내 시작 직후 GPS 튐으로 재탐색하지 않는 시간(ms) */
export const REROUTE_MIN_START_MS = 4000;

/** 연속 재탐색 최소 간격(ms) */
export const REROUTE_COOLDOWN_MS = 8000;

/** 수동 재검색 버튼 연타 방지(ms) */
export const MANUAL_REROUTE_COOLDOWN_MS = 2500;
