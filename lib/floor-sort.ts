import type { FloorPhotoGroupClient } from "@/lib/building-types";

/**
 * 건물 층 표기(B1, 1F, 2F, RF 등)를 지하→지상 오름차순으로 정렬할 때 사용하는 키.
 * 숫자가 작을수록 더 아래(지하) 층.
 */
export function floorSortKey(raw: string): number {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return 9999;

  if (s.startsWith("RF") || s.startsWith("PH") || s.includes("옥탑")) {
    const m = s.match(/(\d+)/);
    return 800 + (m ? parseInt(m[1], 10) : 0);
  }

  const basement = s.match(/^B(\d+)/);
  if (basement) return -parseInt(basement[1], 10);

  if (s.startsWith("LG") || s.startsWith("LB")) {
    const m = s.match(/(\d+)/);
    return m ? -50 - parseInt(m[1], 10) : -50;
  }

  if (s === "GF" || s === "G" || s === "GL" || s === "G.F") return 0;
  const g = s.match(/^G(\d*)F?$/);
  if (g) return g[1] ? parseInt(g[1], 10) * 0.001 : 0;

  const mf = s.match(/^M(\d*)F?$/i);
  if (mf) {
    const n = mf[1] ? parseInt(mf[1], 10) : 1;
    return 1 + n * 0.01;
  }

  const range = s.match(/^(\d+)\s*F?\s*[~\-~]/);
  if (range) return parseInt(range[1], 10);

  const nf = s.match(/^(\d+)\s*F$/i) ?? s.match(/^(\d+)층$/);
  if (nf) return parseInt(nf[1], 10);

  const p = s.match(/^P(\d+)/i);
  if (p) return -100 - parseInt(p[1], 10);

  const any = s.match(/(\d+)/);
  return any ? parseInt(any[1], 10) + 0.5 : 9999;
}

/** "B1 2F 1F" / "B1,1F" 등 공백·쉼표로 구분된 층 나열 정렬 */
export function sortFloorTokens(label: string): string {
  const t = label.trim();
  if (!t) return t;
  const tokens = t.split(/[\s,，/|]+/).filter(Boolean);
  if (tokens.length <= 1) return t;
  return [...tokens].sort((a, b) => floorSortKey(a) - floorSortKey(b)).join(" ");
}

/** "B1:1장 | 2F:2장 | 1F:6장" 형태 정렬 (콜론 앞 층 기준) */
export function sortFloorPhotoSummary(summary: string): string {
  const t = summary.trim();
  if (!t) return t;
  const parts = t.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return t;
  const sorted = [...parts].sort((a, b) => {
    const fa = (a.split(":")[0] ?? a).trim();
    const fb = (b.split(":")[0] ?? b).trim();
    return floorSortKey(fa) - floorSortKey(fb);
  });
  return sorted.join(" | ");
}

export function sortFloorPhotoGroups(groups: FloorPhotoGroupClient[]): FloorPhotoGroupClient[] {
  if (!groups?.length) return [];
  return [...groups].sort((a, b) => floorSortKey(a.floor) - floorSortKey(b.floor));
}