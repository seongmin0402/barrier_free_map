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

export const FOOTPRINT_STROKE = {
  strokeColor: "#2563eb",
  strokeWeight: 2,
  strokeOpacity: 0.88,
  fillColor: "rgba(37, 99, 235, 0)",
  fillOpacity: 0,
  zIndex: 50,
} as const;

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
