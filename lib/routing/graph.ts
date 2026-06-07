import { haversineMeters, type LatLng } from "./geo";
import type { ElevatorRecord } from "./elevators";
import type {
  BuildingEntrance,
  EntranceFeature,
  FeatureCollection,
  GraphEdge,
  GraphNode,
  RoutingGraph,
  WalkwayFeature,
  WalkwayGraph,
} from "./types";

/** 노드 키: 좌표를 6자리(~0.1m)로 반올림해 공유 끝점을 동일 노드로 병합 */
export function nodeKey(lng: number, lat: number): string {
  return `${lng.toFixed(6)},${lat.toFixed(6)}`;
}

const ELEVATOR_SNAP_M = 22;

function addBidirectionalEdge(
  adjacency: Map<string, GraphEdge[]>,
  from: string,
  to: string,
  distance: number,
  type: string,
) {
  if (from === to) return;
  const listA = adjacency.get(from);
  if (!listA) return;
  if (!listA.some((e) => e.to === to)) {
    listA.push({ to, distance, type });
  }
  const listB = adjacency.get(to);
  if (!listB) return;
  if (!listB.some((e) => e.to === from)) {
    listB.push({ to: from, distance, type });
  }
}

function lineStringsOf(feature: WalkwayFeature): number[][][] {
  const g = feature.geometry;
  if (g.type === "LineString") return [g.coordinates];
  if (g.type === "MultiLineString") return g.coordinates;
  return [];
}

/** 보행로 FeatureCollection → 그래프(노드/양방향 엣지) */
export function buildWalkwayGraph(
  collection: FeatureCollection<WalkwayFeature> | null | undefined,
): WalkwayGraph {
  const nodes = new Map<string, GraphNode>();
  const adjacency = new Map<string, GraphEdge[]>();

  if (!collection?.features?.length) return { nodes, adjacency };

  const ensureNode = (lng: number, lat: number): string => {
    const key = nodeKey(lng, lat);
    if (!nodes.has(key)) {
      nodes.set(key, { id: key, lat, lng });
      adjacency.set(key, []);
    }
    return key;
  };

  for (const feature of collection.features) {
    const type = String(feature.properties?.type ?? "path");
    for (const line of lineStringsOf(feature)) {
      for (let i = 0; i < line.length - 1; i++) {
        const [lng1, lat1] = line[i];
        const [lng2, lat2] = line[i + 1];
        if (
          !Number.isFinite(lng1) ||
          !Number.isFinite(lat1) ||
          !Number.isFinite(lng2) ||
          !Number.isFinite(lat2)
        ) {
          continue;
        }
        const a = ensureNode(lng1, lat1);
        const b = ensureNode(lng2, lat2);
        const dist = haversineMeters({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
        addBidirectionalEdge(adjacency, a, b, dist, type);
      }
    }
  }

  return { nodes, adjacency };
}

/** 실외·실내 보행로 + 엘리베이터 포인트를 포함한 길찾기 그래프 */
export function buildRoutingGraph(
  collection: FeatureCollection<WalkwayFeature> | null | undefined,
  elevators: ElevatorRecord[] | null | undefined,
): RoutingGraph {
  const base = buildWalkwayGraph(collection);
  const elevatorNodeIds = new Set<string>();

  if (!elevators?.length) {
    return { ...base, elevatorNodeIds };
  }

  for (const elv of elevators) {
    const { lat, lng } = elv.point;
    const key = nodeKey(lng, lat);

    if (!base.nodes.has(key)) {
      base.nodes.set(key, { id: key, lat, lng });
      base.adjacency.set(key, []);
    }
    elevatorNodeIds.add(key);

    const near = nearestNode(base, elv.point);
    if (near && near.id !== key && near.distance <= ELEVATOR_SNAP_M) {
      addBidirectionalEdge(base.adjacency, key, near.id, near.distance, "elevator");
    }
  }

  return { ...base, elevatorNodeIds };
}

/** 좌표에서 가장 가까운 그래프 노드 */
export function nearestNode(
  graph: WalkwayGraph,
  point: LatLng,
): { id: string; node: { lat: number; lng: number }; distance: number } | null {
  let bestId: string | null = null;
  let bestNode: { lat: number; lng: number } | null = null;
  let bestDist = Infinity;
  for (const [id, node] of graph.nodes) {
    const d = haversineMeters(point, node);
    if (d < bestDist) {
      bestDist = d;
      bestId = id;
      bestNode = node;
    }
  }
  if (!bestId || !bestNode) return null;
  return { id: bestId, node: bestNode, distance: bestDist };
}

/** building_id 정규화: b_19 → b-19, 공백 제거 */
export function normalizeBuildingId(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw).trim().replace(/_/g, "-").toLowerCase();
}

/** 출입구 FeatureCollection → 건물별 출입구 목록 */
export function parseEntrances(
  collection: FeatureCollection<EntranceFeature> | null | undefined,
): BuildingEntrance[] {
  if (!collection?.features?.length) return [];
  const out: BuildingEntrance[] = [];
  for (const f of collection.features) {
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const [lng, lat] = coords;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    out.push({
      id: String(f.properties?.id ?? ""),
      buildingId: normalizeBuildingId(f.properties?.building_id),
      buildingName: String(f.properties?.building_name ?? ""),
      entranceType: String(f.properties?.entrance_type ?? "").toLowerCase(),
      entranceName: String(f.properties?.entrance_name ?? ""),
      floor: String(f.properties?.floor ?? ""),
      point: { lat, lng },
    });
  }
  return out;
}

/**
 * 건물의 대표 출입구 좌표.
 * 추후 장애 유형별 가중치 전까지는 main(없으면 첫 출입구)을 사용.
 */
export function mainEntranceForBuilding(
  entrances: BuildingEntrance[],
  buildingId: string,
): BuildingEntrance | null {
  const norm = normalizeBuildingId(buildingId);
  const matches = entrances.filter((e) => e.buildingId === norm);
  if (!matches.length) return null;
  const main = matches.find((e) => e.entranceType === "main");
  return main ?? matches[0];
}
