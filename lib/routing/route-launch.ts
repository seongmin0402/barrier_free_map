/** 건물 상세 → 길찾기 페이지 자동 출발·도착 설정용 URL */

export function buildRouteToBuildingUrl(buildingId: string): string {
  const params = new URLSearchParams({
    dest: buildingId,
    from: "gps",
  });
  return `/route?${params.toString()}`;
}

export function parseRouteLaunchSearch(
  search: string,
): { buildingId: string; fromGps: boolean } | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const buildingId = params.get("dest")?.trim();
  if (!buildingId) return null;
  return { buildingId, fromGps: params.get("from") === "gps" };
}
