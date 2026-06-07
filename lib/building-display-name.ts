/** 목록·라벨 등 좁은 UI용 — 캠퍼스 공통 접두어 제거 */
export function shortBuildingName(name: string): string {
  const trimmed = name.replace(/^공주대학교\s*/, "").trim();
  return trimmed.length > 0 ? trimmed : name;
}
