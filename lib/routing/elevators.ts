import { normalizeBuildingId } from "./graph";
import type { LatLng } from "./geo";

export interface ElevatorRecord {
  id: string;
  name: string;
  buildingId: string;
  floors: string[];
  point: LatLng;
}

interface ElevatorGeoFeature {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry?: { type: "Point"; coordinates?: number[] };
}

function propString(props: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = props[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  for (const [k, v] of Object.entries(props)) {
    if (keys.some((want) => k.trim() === want) && v != null && String(v).trim()) {
      return String(v).trim();
    }
  }
  return "";
}

function parseFloors(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,/|]/)
    .map((s) => s.trim().toUpperCase().replace(/\s+/g, ""))
    .filter(Boolean);
}

export function parseElevators(collection: { features?: ElevatorGeoFeature[] } | null): ElevatorRecord[] {
  if (!collection?.features?.length) return [];
  const out: ElevatorRecord[] = [];
  for (const f of collection.features) {
    const props = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const [lng, lat] = coords;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

    const id = propString(props, "id", "ev_id") || `ev_${out.length + 1}`;
    const buildingId = normalizeBuildingId(
      propString(props, "building_id", "building_id ", "buildingId"),
    );
    const name = propString(props, "elevator_name", "name") || id;
    const floors = parseFloors(propString(props, "floor_served", "floor_served ", "floors"));

    out.push({ id, name, buildingId, floors, point: { lat, lng } });
  }
  return out;
}
