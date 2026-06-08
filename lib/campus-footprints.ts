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

/** 등급 무관 단색 폴리곤 */
export const FOOTPRINT_FILL_COLOR = "#005D91";
export const FOOTPRINT_STROKE_COLOR = "#004A73";
export const FOOTPRINT_FILL_SELECTED = "#0078B8";
export const FOOTPRINT_STROKE_SELECTED = "#005D91";

/** @deprecated 등급별 색상 미사용 — 하위 호환용 */
export const FOOTPRINT_LEVEL_STROKE: Record<"A" | "B" | "C", string> = {
  A: FOOTPRINT_STROKE_COLOR,
  B: FOOTPRINT_STROKE_COLOR,
  C: FOOTPRINT_STROKE_COLOR,
};

/** @deprecated 등급별 색상 미사용 — 하위 호환용 */
export const FOOTPRINT_STROKE_UNKNOWN = FOOTPRINT_STROKE_COLOR;

export type FootprintAccessibilityLevel = "A" | "B" | "C";

export function footprintStrokeOptions(
  _level: FootprintAccessibilityLevel | null,
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
  return {
    strokeColor: selected ? FOOTPRINT_STROKE_SELECTED : FOOTPRINT_STROKE_COLOR,
    strokeWeight: selected ? 3 : 1.5,
    strokeOpacity: selected ? 1 : 0.88,
    fillColor: selected ? FOOTPRINT_FILL_SELECTED : FOOTPRINT_FILL_COLOR,
    fillOpacity: selected ? 0.88 : 0.72,
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
