/** 패널 경고 — 재탐색보다 먼저 표시 */
export const OFF_ROUTE_WARN_M = 25;

/** 경로 이탈 시 현재 위치→목적지 재탐색 */
export const OFF_ROUTE_REROUTE_M = 25;

/** 도착 판정 시 허용하는 최대 경로 이탈(m) */
export const OFF_ROUTE_ARRIVE_MAX_M = 30;

/** 안내 시작 직후 GPS 튐으로 재탐색하지 않는 시간(ms) */
export const REROUTE_MIN_START_MS = 4000;

/** 자동 재탐색 최소 간격(ms) */
export const REROUTE_COOLDOWN_MS = 5000;

/** 수동 재검색 버튼 연타 방지(ms) */
export const MANUAL_REROUTE_COOLDOWN_MS = 1000;

/** GPS 콜백·진행 계산 최소 간격(ms) */
export const NAV_PROGRESS_COMPUTE_MS = 150;

/** 재검색 직후 경로 방향 대신 이동 방향 유지 — 이탈이 클 때 카메라·마커 튐 방지(m) */
export const REROUTE_HEADING_HOLD_OFF_ROUTE_M = 18;

/** 재탐색 직후 단계 음성 억제(ms) — 수동은 더 짧게 */
export const REROUTE_SPEECH_BLOCK_MS = 5500;
export const MANUAL_REROUTE_SPEECH_BLOCK_MS = 3200;
