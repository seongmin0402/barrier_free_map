/** GeoJSON building footprints (EPSG:4326 / CRS84) for map overlay */

export type FootprintGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export interface FootprintFeature {
  type: "Feature";
  properties: {
    fid?: number;
    id?: string | null;
    building_n?: string | null;
  };
  geometry: FootprintGeometry;
}

export interface FootprintFeatureCollection {
  type: "FeatureCollection";
  features: FootprintFeature[];
}

/** 접근성 등급별 폴리곤 테두리 (CURSOR_PROMPT 색상) */
export const FOOTPRINT_LEVEL_STROKE: Record<"A" | "B" | "C", string> = {
  A: "#22A557",
  B: "#F5A623",
  C: "#DC3545",
};

/** buildings.json에 없거나 등급 정보가 없는 건물 */
export const FOOTPRINT_STROKE_UNKNOWN = "#1a1a1a";

/** 테두리와 같은 색상, fillOpacity로 연하게 표시 */
const FOOTPRINT_FILL_OPACITY: Record<"A" | "B" | "C" | "unknown", { default: number; selected: number }> = {
  A: { default: 0.22, selected: 0.32 },
  B: { default: 0.24, selected: 0.34 },
  C: { default: 0.22, selected: 0.32 },
  unknown: { default: 0.1, selected: 0.16 },
};

export type FootprintAccessibilityLevel = keyof typeof FOOTPRINT_LEVEL_STROKE;

export function footprintStrokeOptions(
  level: FootprintAccessibilityLevel | null,
  selected: boolean,
): {
  strokeColor: string;
  strokeWeight: number;
  strokeOpacity: number;
  fillColor: string;
  fillOpacity: number;
  zIndex: number;
  clickable: boolean;
} {
  const strokeColor =
    level != null ? FOOTPRINT_LEVEL_STROKE[level] : FOOTPRINT_STROKE_UNKNOWN;
  const fillKey = level ?? "unknown";
  const fillOpacity = FOOTPRINT_FILL_OPACITY[fillKey][selected ? "selected" : "default"];

  return {
    strokeColor,
    strokeWeight: selected ? 4 : 2.5,
    strokeOpacity: selected ? 1 : 0.9,
    fillColor: strokeColor,
    fillOpacity,
    zIndex: selected ? 220 : 50,
    clickable: true,
  };
}

type LatLngCtor = new (lat: number, lng: number) => unknown;

function ringsToPaths(rings: number[][][], LatLng: LatLngCtor): unknown[][] {
  return rings.map((ring) => ring.map(([lng, lat]) => new LatLng(lat, lng)));
}

/** One Naver Polygon per GeoJSON polygon (Polygon or each part of MultiPolygon). */
export function footprintPolygonPathGroups(
  geometry: FootprintGeometry,
  LatLng: LatLngCtor,
): unknown[][][] {
  if (geometry.type === "Polygon") {
    return [ringsToPaths(geometry.coordinates, LatLng)];
  }
  return geometry.coordinates.map((rings) => ringsToPaths(rings, LatLng));
}
