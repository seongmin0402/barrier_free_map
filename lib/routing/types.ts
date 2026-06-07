import type { LatLng } from "./geo";

export type WalkwayType = "path" | "crosswalk" | "stairs" | "ramp" | string;

export interface WalkwayFeature {
  type: "Feature";
  properties: {
    id?: string;
    type?: WalkwayType;
    memo?: string | null;
    slope_pct?: number | null;
  };
  geometry:
    | { type: "LineString"; coordinates: number[][] }
    | { type: "MultiLineString"; coordinates: number[][][] };
}

export interface EntranceFeature {
  type: "Feature";
  properties: {
    id?: string;
    building_id?: string;
    building_name?: string;
    entrance_code?: string;
    entrance_name?: string;
    floor?: string;
    entrance_type?: string;
  };
  geometry: { type: "Point"; coordinates: number[] };
}

export interface FeatureCollection<F> {
  type: "FeatureCollection";
  features: F[];
}

/** 그래프 엣지 */
export interface GraphEdge {
  to: string;
  distance: number;
  type: WalkwayType;
}

export interface GraphNode {
  id: string;
  lat: number;
  lng: number;
}

export interface WalkwayGraph {
  nodes: Map<string, GraphNode>;
  adjacency: Map<string, GraphEdge[]>;
}

/** 보행로 + 엘리베이터 허브 노드 메타 */
export interface RoutingGraph extends WalkwayGraph {
  elevatorNodeIds: Set<string>;
}

export interface BuildingEntrance {
  id: string;
  buildingId: string;
  buildingName: string;
  entranceType: string;
  entranceName: string;
  floor: string;
  point: LatLng;
}

/** 길찾기 출발/도착 지점 */
export type RoutePointKind = "building" | "gps" | "map";

export interface RoutePoint {
  kind: RoutePointKind;
  label: string;
  point: LatLng;
  buildingId?: string;
}

export type ManeuverKind =
  | "depart"
  | "straight"
  | "left"
  | "slight-left"
  | "right"
  | "slight-right"
  | "uturn"
  | "arrive";

export interface RouteStep {
  /** 안내 문구 */
  text: string;
  /** 이 단계 주행 거리(m) */
  distance: number;
  /** 회전 지점 좌표 */
  at: LatLng;
  maneuver: ManeuverKind;
  edgeType: WalkwayType;
  /** 계단/경사로/횡단보도 등 경고 문구 (없으면 null) */
  hazard: string | null;
}

export interface ComputedRoute {
  coords: LatLng[];
  distance: number;
  steps: RouteStep[];
  hasStairs: boolean;
  hasCrosswalk: boolean;
  hasElevator: boolean;
  /** coords[i] → coords[i+1] 구간의 종류 (length = coords.length - 1) */
  segmentTypes: WalkwayType[];
}
