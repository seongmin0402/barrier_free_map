import type { BarrierBuilding } from "@/lib/building-types";
import type { FootprintFeatureCollection, FootprintGeometry } from "@/lib/campus-footprints";

function ringCentroid(ring: number[][]): { lat: number; lng: number } | null {
  const pts = ring.filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  if (pts.length < 3) return null;

  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const cross = x1 * y2 - x2 * y1;
    area2 += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(area2) < 1e-12) {
    const lng = pts.reduce((s, [lng]) => s + lng, 0) / pts.length;
    const lat = pts.reduce((s, [, lat]) => s + lat, 0) / pts.length;
    return { lat, lng };
  }
  const f = 1 / (3 * area2);
  return { lat: cy * f, lng: cx * f };
}

export function footprintCentroid(geometry: FootprintGeometry): { lat: number; lng: number } | null {
  if (geometry.type === "Polygon") {
    const outer = geometry.coordinates[0];
    return outer ? ringCentroid(outer) : null;
  }
  for (const poly of geometry.coordinates) {
    const outer = poly[0];
    const c = outer ? ringCentroid(outer) : null;
    if (c) return c;
  }
  return null;
}

function normalizeFootprintId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const id = String(raw).trim();
  return id.length > 0 ? id : null;
}

function normalizeFootprintName(raw: string | null | undefined, fallbackId: string): string {
  const name = String(raw ?? "").trim();
  return name.length > 0 ? name : fallbackId;
}

export function createUnsurveyedBuilding(
  id: string,
  name: string,
  lat: number,
  lng: number,
): BarrierBuilding {
  return {
    id,
    name,
    lat,
    lng,
    floorLabel: "",
    wheelchairAccess: false,
    elevatorAvailable: false,
    brailleAvailable: false,
    toiletAvailable: false,
    autoDoorAvailable: false,
    thresholdPresent: false,
    rampAvailable: false,
    parkingCapacity: 0,
    parkingDistanceEntranceM: 0,
    description: "",
    floorPhotoSummary: "",
    floorPhotoImageNames: "",
    floorPhotoGroups: [],
    facilities: [],
    accessibilityLevel: "unknown",
  };
}

/** buildings.json + GeoJSON 폴리곤에서 미조사 건물을 합친 전체 목록 */
export function mergeCampusBuildings(
  surveyed: BarrierBuilding[],
  footprints: FootprintFeatureCollection | null | undefined,
): BarrierBuilding[] {
  const byId = new Map<string, BarrierBuilding>();
  for (const b of surveyed) {
    if (b.id) byId.set(b.id, b);
  }

  const extras: BarrierBuilding[] = [];
  for (const feature of footprints?.features ?? []) {
    const id = normalizeFootprintId(feature.properties?.id);
    if (!id || byId.has(id)) continue;

    const centroid = footprintCentroid(feature.geometry);
    if (!centroid) continue;

    const entry = createUnsurveyedBuilding(
      id,
      normalizeFootprintName(feature.properties?.building_n, id),
      centroid.lat,
      centroid.lng,
    );
    byId.set(id, entry);
    extras.push(entry);
  }

  const all = [...byId.values()];
  all.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return all;
}

export function isUnsurveyedBuilding(building: BarrierBuilding): boolean {
  return building.accessibilityLevel === "unknown";
}
