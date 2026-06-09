import {
  angleDelta,
  bearingDeg,
  formatDistance,
  haversineMeters,
  indexOfCoord,
  projectOnSegment,
  type LatLng,
} from "./geo";
import { tryFixedRoutePair } from "./fixed-routes";
import { nearestNode, rankEntrancesForBuilding } from "./graph";
import { walkPathLengthBetween, walkPolylineLength } from "./polyline-simplify";
import type { AppLocale } from "@/lib/app-settings";
import { formatFloorLabel, type ElevatorRecord } from "./elevators";
import {
  aheadTurnText,
  arriveMessage,
  continueStraightPlaceholder,
  crosswalkAheadText,
  crosswalkNowText,
  departStraightText,
  elevatorTransferText,
  featureFollowText,
  guidanceManeuverFor,
  hazardText,
  isGuidanceManeuver,
  maneuverLabel,
  turnThenContinueText,
} from "@/lib/i18n/navigation";
import type {
  BuildingEntrance,
  ComputedRoute,
  GraphEdge,
  ManeuverKind,
  RoutePairResult,
  RoutePoint,
  RouteProfile,
  RouteStep,
  RoutingGraph,
  WalkwayType,
} from "./types";

type RouteWeightMode = "physical" | "shortest" | "elevator" | "accessible" | "accessibleFallback";

export interface ComputeRouteOptions {
  /** fast: 최단 거리(계단·승강기 무관) / comfort: 계단 없음·승강기 우선 */
  profile?: RouteProfile;
}

/** type별 비용 가중치 — physical은 거리만, shortest는 계단 약간 불리 */
export function edgeWeight(type: WalkwayType, mode: RouteWeightMode = "shortest"): number {
  if (mode === "physical") return 1;
  switch (type) {
    case "stairs":
      if (mode === "accessible") return Infinity;
      if (mode === "accessibleFallback") return 22;
      return mode === "elevator" ? 6.5 : 2.6;
    case "elevator":
      return 0.22;
    case "ramp":
      if (mode === "accessible") return 0.7;
      if (mode === "accessibleFallback") return 0.78;
      return mode === "elevator" ? 1.02 : 1.05;
    case "crosswalk":
      return 1.1;
    case "indoor":
      return mode === "elevator" ? 0.82 : 1;
    default:
      if (mode === "accessible") return 1.02;
      if (mode === "accessibleFallback") return 1.04;
      return mode === "elevator" ? 0.95 : 1;
  }
}

/** 경사도(%) — 완만할수록 비용 증가 적음 */
function slopeCostMultiplier(slopePct: number | null | undefined): number {
  if (slopePct == null || !Number.isFinite(slopePct)) return 1;
  const slope = Math.abs(slopePct);
  if (slope <= 5) return 1;
  if (slope <= 8) return 1 + (slope - 5) * 0.07;
  return 1 + (slope - 8) * 0.14 + 0.21;
}

/** 편의 승강기 — 최단 경로와 크게 다르지 않으면 우선 */
const ELEVATOR_COMFORT_CLOSE_M = 75;
const ELEVATOR_COMFORT_RATIO = 1.15;
const ELEVATOR_COMFORT_EXTRA_M = 45;
/** 계단 회피 등으로만 허용하는 추가 우회 상한 */
const ELEVATOR_EXTENDED_RATIO = 1.22;
const ELEVATOR_EXTENDED_EXTRA_M = 55;
/** 승강기 경로에 부여하는 가상 단축 */
const ELEVATOR_SCORE_BONUS_M = 150;
const ELEVATOR_COMFORT_BONUS_M = 130;
const NO_ELEVATOR_PENALTY_M = 130;
/** 최단 경로에 계단이 많을 때 승강기 미사용 추가 패널티 */
const NO_ELEVATOR_STAIRS_THRESHOLD_M = 18;
/** 기준(최단) 경로 선형에서 승강기까지 허용 거리 — “길 위” 승강기 */
const ELEVATOR_ON_CORRIDOR_M = 55;
/** 경로에 승강기가 2곳 이상이면 불필요한 우회로 간주 — 추가 패널티 */
const EXTRA_ELEVATOR_STOP_PENALTY_M = 130;
/** 계단 없는 경로가 최단 대비 허용하는 우회 */
const ACCESSIBLE_DETOUR_RATIO = 1.32;
const ACCESSIBLE_DETOUR_EXTRA_M = 55;
/** 목적지 근처(진행 65%+) 승강기 우회 허용 추가 거리(m) */
const LATE_ELEVATOR_MAX_EXTRA_M = 32;

interface SegmentInfo {
  type: WalkwayType;
}

interface DijkstraOptions {
  mode?: RouteWeightMode;
  elevatorNodeIds?: Set<string>;
  /** 지정 시 해당 승강기만 허브 할인 — 단일 승강기 경유 경로 생성용 */
  focusElevatorId?: string;
}

function isOtherElevatorHub(
  fromId: string,
  toId: string,
  elevatorNodeIds: Set<string>,
  focusElevatorId: string,
): boolean {
  return (
    (elevatorNodeIds.has(fromId) && fromId !== focusElevatorId) ||
    (elevatorNodeIds.has(toId) && toId !== focusElevatorId)
  );
}

function edgeCost(
  edge: GraphEdge,
  mode: RouteWeightMode,
  fromId: string,
  toId: string,
  elevatorNodeIds: Set<string>,
  focusElevatorId?: string,
): number {
  if (
    focusElevatorId &&
    isOtherElevatorHub(fromId, toId, elevatorNodeIds, focusElevatorId)
  ) {
    return edge.distance * edgeWeight(edge.type, mode);
  }

  let cost = edge.distance * edgeWeight(edge.type, mode);
  if (mode === "elevator" && (elevatorNodeIds.has(fromId) || elevatorNodeIds.has(toId))) {
    cost *= 0.65;
  }
  // shortest 탐색에서도 승강기 허브 인근은 약간 유리하게 (경유 유도)
  if (mode === "shortest" && (elevatorNodeIds.has(fromId) || elevatorNodeIds.has(toId))) {
    cost *= 0.88;
  }
  if (mode === "accessible" || mode === "accessibleFallback") {
    cost *= slopeCostMultiplier(edge.slopePct);
  }
  return cost;
}

function dijkstra(
  graph: RoutingGraph,
  startId: string,
  endId: string,
  options: DijkstraOptions = {},
): string[] | null {
  const mode = options.mode ?? "shortest";
  const elevatorNodeIds = options.elevatorNodeIds ?? graph.elevatorNodeIds;
  const focusElevatorId = options.focusElevatorId;

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  dist.set(startId, 0);

  const pq: Array<{ id: string; d: number }> = [{ id: startId, d: 0 }];

  while (pq.length) {
    let bestIdx = 0;
    for (let i = 1; i < pq.length; i++) {
      if (pq[i].d < pq[bestIdx].d) bestIdx = i;
    }
    const { id } = pq.splice(bestIdx, 1)[0];
    if (visited.has(id)) continue;
    visited.add(id);
    if (id === endId) break;

    const edges = graph.adjacency.get(id) ?? [];
    const baseDist = dist.get(id) ?? Infinity;
    for (const edge of edges) {
      if (visited.has(edge.to)) continue;
      const cost = edgeCost(edge, mode, id, edge.to, elevatorNodeIds, focusElevatorId);
      const nd = baseDist + cost;
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd);
        prev.set(edge.to, id);
        pq.push({ id: edge.to, d: nd });
      }
    }
  }

  if (!prev.has(endId) && startId !== endId) return null;

  const path: string[] = [];
  let cur: string | undefined = endId;
  while (cur != null) {
    path.unshift(cur);
    if (cur === startId) break;
    cur = prev.get(cur);
  }
  if (path[0] !== startId) return null;
  return path;
}

function pathUsesElevator(graph: RoutingGraph, nodePath: string[]): boolean {
  return elevatorsUsedOnPath(graph, nodePath).length > 0;
}

/** 경로 정점으로 승강기 허브를 지나가는지 (도보로 스쳐 지나가는 경우 포함) */
function pathVisitsElevatorHub(graph: RoutingGraph, nodePath: string[]): boolean {
  return elevatorIdsOnPath(graph, nodePath).length > 0;
}

function pathUsesCorridorElevator(
  graph: RoutingGraph,
  nodePath: string[],
  corridorElevators: Set<string>,
): boolean {
  if (!corridorElevators.size) return false;
  for (const id of elevatorIdsOnPath(graph, nodePath)) {
    if (corridorElevators.has(id)) return true;
  }
  for (const id of elevatorsUsedOnPath(graph, nodePath)) {
    if (corridorElevators.has(id)) return true;
  }
  return false;
}

/** 안내 문구·지도 표시용 — 허브 경유도 승강기 구간으로 안내 */
function elevatorsForGuidance(graph: RoutingGraph, nodePath: string[]): string[] {
  const out = new Set(elevatorsUsedOnPath(graph, nodePath));
  for (const id of elevatorIdsOnPath(graph, nodePath)) out.add(id);
  return [...out];
}

function pathPhysicalDistance(graph: RoutingGraph, nodePath: string[]): number {
  let total = 0;
  for (let i = 0; i < nodePath.length - 1; i++) {
    const a = graph.nodes.get(nodePath[i]);
    const b = graph.nodes.get(nodePath[i + 1]);
    if (!a || !b) continue;
    total += haversineMeters(a, b);
  }
  return total;
}

function pathHasStairs(graph: RoutingGraph, nodePath: string[]): boolean {
  return pathStairMeters(graph, nodePath) > 0;
}

function pathStairMeters(graph: RoutingGraph, nodePath: string[]): number {
  let total = 0;
  for (let i = 0; i < nodePath.length - 1; i++) {
    if (edgeTypeBetween(graph, nodePath[i], nodePath[i + 1]) !== "stairs") continue;
    const a = graph.nodes.get(nodePath[i]);
    const b = graph.nodes.get(nodePath[i + 1]);
    if (!a || !b) continue;
    total += haversineMeters(a, b);
  }
  return total;
}

function pathRampMeters(graph: RoutingGraph, nodePath: string[]): number {
  let total = 0;
  for (let i = 0; i < nodePath.length - 1; i++) {
    if (edgeTypeBetween(graph, nodePath[i], nodePath[i + 1]) !== "ramp") continue;
    const a = graph.nodes.get(nodePath[i]);
    const b = graph.nodes.get(nodePath[i + 1]);
    if (!a || !b) continue;
    total += haversineMeters(a, b);
  }
  return total;
}

function pathWeightedCost(
  graph: RoutingGraph,
  nodePath: string[],
  mode: RouteWeightMode,
): number {
  let total = 0;
  const elevatorNodeIds = graph.elevatorNodeIds;
  for (let i = 0; i < nodePath.length - 1; i++) {
    const from = nodePath[i];
    const to = nodePath[i + 1];
    const edges = graph.adjacency.get(from) ?? [];
    const edge = edges.find((e) => e.to === to);
    if (!edge) continue;
    total += edgeCost(edge, mode, from, to, elevatorNodeIds);
  }
  return total;
}

function accessiblePathBetween(
  graph: RoutingGraph,
  startId: string,
  endId: string,
): string[] | null {
  return (
    dijkstra(graph, startId, endId, { mode: "accessible" }) ??
    dijkstra(graph, startId, endId, { mode: "accessibleFallback" })
  );
}

function mergeNodePaths(first: string[], second: string[]): string[] {
  if (first[first.length - 1] === second[0]) return [...first, ...second.slice(1)];
  return [...first, ...second];
}

function pathSignature(nodePath: string[]): string {
  return nodePath.join("\0");
}

function withinElevatorComfortBudget(dist: number, shortestDist: number): boolean {
  const detour = dist - shortestDist;
  if (detour <= ELEVATOR_COMFORT_CLOSE_M) return true;
  return dist <= shortestDist * ELEVATOR_COMFORT_RATIO + ELEVATOR_COMFORT_EXTRA_M;
}

function withinElevatorExtendedBudget(dist: number, shortestDist: number): boolean {
  if (withinElevatorComfortBudget(dist, shortestDist)) return true;
  return dist <= shortestDist * ELEVATOR_EXTENDED_RATIO + ELEVATOR_EXTENDED_EXTRA_M;
}

/** 0=출발, 1=도착 방향으로 얼마나 진행했는지 (직선 투영) */
function progressAlongRoute(point: LatLng, start: LatLng, end: LatLng): number {
  const abx = end.lng - start.lng;
  const aby = end.lat - start.lat;
  const apx = point.lng - start.lng;
  const apy = point.lat - start.lat;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return 0;
  return (apx * abx + apy * aby) / ab2;
}

function minDistPointToNodePath(graph: RoutingGraph, nodePath: string[], point: LatLng): number {
  let best = Infinity;
  for (let i = 0; i < nodePath.length - 1; i++) {
    const a = graph.nodes.get(nodePath[i]);
    const b = graph.nodes.get(nodePath[i + 1]);
    if (!a || !b) continue;
    const { distance } = projectOnSegment(point, a, b);
    if (distance < best) best = distance;
  }
  return best;
}

/** 기준 최단 경로 “길 위”에 있는 승강기 id (경로 정점 또는 코리더 인근) */
function corridorElevatorIds(
  graph: RoutingGraph,
  referencePath: string[],
): Set<string> {
  const out = new Set<string>();
  for (const evId of graph.elevatorNodeIds) {
    if (referencePath.includes(evId)) {
      out.add(evId);
      continue;
    }
    const node = graph.nodes.get(evId);
    if (!node) continue;
    if (minDistPointToNodePath(graph, referencePath, node) <= ELEVATOR_ON_CORRIDOR_M) {
      out.add(evId);
    }
  }
  return out;
}

function elevatorIdsOnPath(graph: RoutingGraph, nodePath: string[]): string[] {
  return nodePath.filter((id) => graph.elevatorNodeIds.has(id));
}

/** 승강기 엣지 또는 층 이동이 실제로 일어난 승강기만 */
function elevatorsUsedOnPath(graph: RoutingGraph, nodePath: string[]): string[] {
  const used: string[] = [];
  for (let i = 0; i < nodePath.length; i++) {
    const id = nodePath[i];
    if (!graph.elevatorNodeIds.has(id)) continue;

    const viaElevEdge =
      (i > 0 && edgeTypeBetween(graph, nodePath[i - 1], id) === "elevator") ||
      (i + 1 < nodePath.length && edgeTypeBetween(graph, id, nodePath[i + 1]) === "elevator");
    if (viaElevEdge) {
      used.push(id);
      continue;
    }

    if (i > 0 && i + 1 < nodePath.length) {
      const fIn = floorBetween(graph, nodePath[i - 1], id);
      const fOut = floorBetween(graph, id, nodePath[i + 1]);
      if (fIn && fOut && normalizeFloorCode(fIn) !== normalizeFloorCode(fOut)) {
        used.push(id);
      }
    }
  }
  return used;
}

/** 후보 경로 점수 (낮을수록 좋음) — 승강기 우선 · 길 위 승강기 · 계단 최소 */
function pathNearBackwardElevator(
  graph: RoutingGraph,
  nodePath: string[],
  startNode: LatLng,
  endNode: LatLng,
  maxDistM = 14,
): boolean {
  for (const evId of graph.elevatorNodeIds) {
    const n = graph.nodes.get(evId);
    if (!n) continue;
    if (progressAlongRoute(n, startNode, endNode) >= 0.05) continue;
    if (minDistPointToNodePath(graph, nodePath, n) <= maxDistM) return true;
  }
  return false;
}

/** 최단 경로 인근 승강기 허브를 경유하고, 우회가 작을 때 */
function isComfortElevatorPath(
  graph: RoutingGraph,
  nodePath: string[],
  shortestDist: number,
  startNode: LatLng,
  endNode: LatLng,
  corridorElevators: Set<string>,
): boolean {
  if (!pathUsesCorridorElevator(graph, nodePath, corridorElevators)) return false;
  if (pathNearBackwardElevator(graph, nodePath, startNode, endNode)) return false;

  const dist = pathPhysicalDistance(graph, nodePath);
  if (!withinElevatorComfortBudget(dist, shortestDist)) return false;

  const hubs = [...elevatorIdsOnPath(graph, nodePath), ...elevatorsUsedOnPath(graph, nodePath)];
  return hubs.some((id) => {
    if (!corridorElevators.has(id)) return false;
    const n = graph.nodes.get(id)!;
    return progressAlongRoute(n, startNode, endNode) >= 0.08;
  });
}

function scorePathCandidate(
  graph: RoutingGraph,
  nodePath: string[],
  shortestDist: number,
  startId: string,
  endId: string,
  corridorElevators: Set<string>,
  referenceStairM: number,
  preferAccessible = false,
): number {
  const dist = pathPhysicalDistance(graph, nodePath);
  const stairM = pathStairMeters(graph, nodePath);
  const rampM = pathRampMeters(graph, nodePath);
  const usesElevator = pathUsesElevator(graph, nodePath);
  const visitsHub = pathVisitsElevatorHub(graph, nodePath);
  const startNode = graph.nodes.get(startId)!;
  const endNode = graph.nodes.get(endId)!;
  const comfortElevator = isComfortElevatorPath(
    graph,
    nodePath,
    shortestDist,
    startNode,
    endNode,
    corridorElevators,
  );

  let score = dist;
  if (preferAccessible) {
    score += stairM * 110;
    if (stairM > 0) score += 900;
    score -= rampM * 0.22;
  } else {
    score += stairM * 12;
  }
  if (usesElevator || visitsHub) {
    score -= ELEVATOR_SCORE_BONUS_M;
    if (comfortElevator) score -= ELEVATOR_COMFORT_BONUS_M;
    if (visitsHub && !usesElevator) score -= 70;
  } else if (corridorElevators.size > 0) {
    score += NO_ELEVATOR_PENALTY_M;
    if (referenceStairM >= NO_ELEVATOR_STAIRS_THRESHOLD_M) score += 45;
  } else if (referenceStairM >= NO_ELEVATOR_STAIRS_THRESHOLD_M) {
    score += NO_ELEVATOR_PENALTY_M * 0.6;
  }

  const onPath = elevatorsUsedOnPath(graph, nodePath);

  if (onPath.length > 1) {
    const allOnCorridor = onPath.every((id) => corridorElevators.has(id));
    if (!allOnCorridor) {
      score += (onPath.length - 1) * EXTRA_ELEVATOR_STOP_PENALTY_M;
    }
  }

  if (onPath.length) {
    let bestProgress = 0;
    let onCorridor = false;
    for (const evId of onPath) {
      const n = graph.nodes.get(evId)!;
      const prog = progressAlongRoute(n, startNode, endNode);
      bestProgress = Math.max(bestProgress, prog);
      if (corridorElevators.has(evId)) onCorridor = true;
      if (prog < 0.05) score += 520;
      else if (prog < 0.12) score += 200;
      if (prog >= 0.15 && corridorElevators.has(evId)) {
        score -= 55;
      }
    }

    // 가는 방향 “길 위” 승강기 선호 — 출발지 인근(≈산학연구관)만 쓰는 경로는 불리
    if (bestProgress >= 0.15 && bestProgress <= 0.92) {
      score -= 120;
      score -= (bestProgress - 0.15) * 200;
    }

    if (onCorridor) {
      score -= 90;
    } else if (usesElevator) {
      score += 55;
    }
  }

  if (pathNearBackwardElevator(graph, nodePath, startNode, endNode)) {
    score += 450;
  }

  const detour = dist - shortestDist;
  if (preferAccessible && detour > 15) {
    score += detour * 0.72;
  } else if (!comfortElevator && detour > ELEVATOR_COMFORT_CLOSE_M) {
    score += (detour - ELEVATOR_COMFORT_CLOSE_M) * 0.9;
  } else if (!comfortElevator && detour > 0) {
    score += detour * 0.25;
  }
  return score;
}

function collectPathCandidates(
  graph: RoutingGraph,
  startId: string,
  endId: string,
  preferAccessible = false,
): string[][] {
  const seen = new Set<string>();
  const candidates: string[][] = [];

  const add = (path: string[] | null) => {
    if (!path?.length) return;
    const sig = pathSignature(path);
    if (seen.has(sig)) return;
    seen.add(sig);
    candidates.push(path);
  };

  if (preferAccessible) {
    add(dijkstra(graph, startId, endId, { mode: "accessible" }));
    add(dijkstra(graph, startId, endId, { mode: "accessibleFallback" }));
  }

  add(dijkstra(graph, startId, endId, { mode: "shortest" }));
  add(dijkstra(graph, startId, endId, { mode: "elevator" }));

  for (const evId of graph.elevatorNodeIds) {
    const legTo = dijkstra(graph, startId, evId, { mode: "elevator", focusElevatorId: evId });
    const legFrom = dijkstra(graph, evId, endId, { mode: "elevator", focusElevatorId: evId });
    if (legTo && legFrom) add(mergeNodePaths(legTo, legFrom));
  }

  return candidates;
}

function edgeTypeBetween(graph: RoutingGraph, from: string, to: string): WalkwayType {
  const edges = graph.adjacency.get(from) ?? [];
  const e = edges.find((x: GraphEdge) => x.to === to);
  const raw = e?.type ?? "path";
  if (raw === "elevator") return "elevator";
  return raw;
}

function floorBetween(graph: RoutingGraph, from: string, to: string): string | null {
  const edges = graph.adjacency.get(from) ?? [];
  const e = edges.find((x: GraphEdge) => x.to === to);
  return e?.floor ?? null;
}

function normalizeFloorCode(floor: string): string {
  return floor.trim().toUpperCase().replace(/\s+/g, "");
}

/** 승강기 탑승 후 이동할 목표 층 추정 */
function inferElevatorTargetFloor(
  graph: RoutingGraph,
  nodePath: string[],
  elevIndex: number,
  elevator: ElevatorRecord | undefined,
): string {
  const elevId = nodePath[elevIndex];

  if (elevIndex + 1 < nodePath.length) {
    const exitFloor = floorBetween(graph, elevId, nodePath[elevIndex + 1]);
    if (exitFloor) return exitFloor;
  }

  const approachFloor =
    elevIndex > 0 ? floorBetween(graph, nodePath[elevIndex - 1], elevId) : null;

  if (elevator?.floors.length) {
    if (approachFloor) {
      const normApproach = normalizeFloorCode(approachFloor);
      const other = elevator.floors.find((f) => normalizeFloorCode(f) !== normApproach);
      if (other) return other;
    }
    if (elevator.floors.length === 1) return elevator.floors[0];
    return elevator.floors[elevator.floors.length - 1];
  }

  return "1F";
}

function buildElevatorStepsAtCoord(
  graph: RoutingGraph,
  nodePath: string[],
  coordOffset: number,
  locale: AppLocale,
): Map<number, string> {
  const usedElevators = new Set(elevatorsForGuidance(graph, nodePath));
  const out = new Map<number, string>();
  for (let i = 0; i < nodePath.length; i++) {
    if (!usedElevators.has(nodePath[i])) continue;
    const elevator = graph.elevatorByNodeId.get(nodePath[i]);
    const targetFloor = inferElevatorTargetFloor(graph, nodePath, i, elevator);
    const floorLabel = formatFloorLabel(targetFloor, locale);
    out.set(
      coordOffset + i,
      elevatorTransferText(floorLabel, locale, elevator?.name),
    );
  }
  return out;
}

function hazardFor(type: WalkwayType, locale: AppLocale): string | null {
  return hazardText(type, locale);
}

function maneuverFromDelta(delta: number): ManeuverKind {
  const a = Math.abs(delta);
  if (a >= 150) return "uturn";
  if (a < 32) return "straight";
  if (a < 70) return delta > 0 ? "slight-right" : "slight-left";
  return delta > 0 ? "right" : "left";
}

/** 횡단보도·경사로·계단 — 전용 안내 단계 생성 */
const GUIDANCE_SEGMENT = new Set<WalkwayType>(["crosswalk", "ramp", "stairs"]);

interface FeatureRun {
  startSeg: number;
  endSeg: number;
  type: WalkwayType;
  distance: number;
}

function collectFeatureRuns(coords: LatLng[], segs: SegmentInfo[]): FeatureRun[] {
  const runs: FeatureRun[] = [];
  let i = 0;
  while (i < segs.length) {
    const t = segs[i]?.type ?? "path";
    if (!GUIDANCE_SEGMENT.has(t)) {
      i++;
      continue;
    }
    const startSeg = i;
    let dist = haversineMeters(coords[i], coords[i + 1]);
    i++;
    while (i < segs.length && (segs[i]?.type ?? "path") === t) {
      dist += haversineMeters(coords[i], coords[i + 1]);
      i++;
    }
    runs.push({ startSeg, endSeg: i, type: t, distance: dist });
  }
  return runs;
}

/** 경사로·계단 polyline 꺾임 — 구간 단위로 안내 */
const CONTINUOUS_FEATURE = new Set<WalkwayType>(["ramp", "stairs", "crosswalk"]);

function isTurnManeuver(m: ManeuverKind): boolean {
  return (
    m !== "depart" &&
    m !== "arrive" &&
    m !== "elevator" &&
    m !== "straight" &&
    !isGuidanceManeuver(m)
  );
}

function formatStepText(step: RouteStep, locale: AppLocale): void {
  if (step.maneuver === "elevator") {
    step.hazard = null;
    return;
  }

  const dist = formatDistance(step.distance, locale);

  if (step.maneuver === "crosswalk") {
    step.text =
      step.distance > 1
        ? crosswalkAheadText(dist, locale)
        : crosswalkNowText(locale);
    step.hazard = null;
    return;
  }

  if (isGuidanceManeuver(step.maneuver)) {
    const follow = featureFollowText(step.edgeType, dist, locale);
    if (follow) {
      step.text = follow;
      step.hazard = null;
    }
    return;
  }

  const featureType =
    step.edgeType && CONTINUOUS_FEATURE.has(step.edgeType)
      ? step.edgeType
      : step.hazard === hazardText("ramp", locale)
        ? "ramp"
        : step.hazard === hazardText("stairs", locale)
          ? "stairs"
          : step.hazard === hazardText("crosswalk", locale)
            ? "crosswalk"
            : null;
  const follow = featureType ? featureFollowText(featureType, dist, locale) : null;

  if (follow && (step.maneuver === "depart" || step.maneuver === "straight")) {
    step.text = follow;
    step.edgeType = featureType ?? step.edgeType;
    step.hazard = null;
    return;
  }

  if (step.maneuver === "depart") {
    step.text = departStraightText(dist, locale);
  } else if (step.maneuver === "arrive") {
    step.text = arriveMessage(locale);
  } else {
    const label = maneuverLabel(step.maneuver, locale);
    step.text = aheadTurnText(dist, label, locale);
  }
}

/** 시설 안내(횡단보도·경사로·계단·승강기)는 병합하지 않음 */
function consolidateFeatureSteps(steps: RouteStep[], _locale: AppLocale): RouteStep[] {
  return steps;
}

function isMandatoryGuidanceStep(maneuver: RouteStep["maneuver"]): boolean {
  return maneuver === "elevator" || isGuidanceManeuver(maneuver);
}

/** 직전 직진이 짧을 때(≤22m) 사소한 회전 안내 생략 — 시설 안내 직전은 유지 */
function consolidateMicroTurns(steps: RouteStep[], locale: AppLocale): RouteStep[] {
  const out: RouteStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const prev = out[out.length - 1];
    const nextMandatory = steps.slice(i + 1).find((s) => isMandatoryGuidanceStep(s.maneuver));

    if (
      prev &&
      isTurnManeuver(step.maneuver) &&
      (prev.maneuver === "depart" || prev.maneuver === "straight") &&
      prev.distance <= 22 &&
      step.maneuver !== "uturn" &&
      !isMandatoryGuidanceStep(step.maneuver) &&
      !nextMandatory
    ) {
      prev.distance += step.distance;
      prev.at = step.at;
      formatStepText(prev, locale);
      continue;
    }
    out.push(step);
  }

  return out;
}

/** 연속 직진·출발 단계 병합 */
function consolidateStraightSteps(steps: RouteStep[], locale: AppLocale): RouteStep[] {
  const out: RouteStep[] = [];

  for (const step of steps) {
    const prev = out[out.length - 1];
    const mergeable =
      prev &&
      step.maneuver === "straight" &&
      (prev.maneuver === "depart" || prev.maneuver === "straight") &&
      prev.maneuver !== "elevator" &&
      step.maneuver !== "elevator" &&
      !isGuidanceManeuver(prev.maneuver) &&
      !isGuidanceManeuver(step.maneuver);

    if (mergeable) {
      prev.distance += step.distance;
      prev.at = step.at;
      if (step.hazard && !prev.hazard) prev.hazard = step.hazard;
      if (step.edgeType && step.edgeType !== "path" && prev.edgeType === "path") {
        prev.edgeType = step.edgeType;
      }
      formatStepText(prev, locale);
      continue;
    }

    out.push(step);
  }

  return out;
}

function segmentTypeAt(segs: SegmentInfo[], segIdx: number): WalkwayType {
  return segs[segIdx]?.type ?? "path";
}

/** coords[startIdx]부터 type 구간 끝 좌표 인덱스 */
function endOfFeatureAt(
  coords: LatLng[],
  segs: SegmentInfo[],
  startIdx: number,
  type: WalkwayType,
): number {
  let i = startIdx;
  while (i < coords.length - 1 && segmentTypeAt(segs, i) === type) {
    i++;
  }
  return i;
}

/** type 구간 시작 좌표 인덱스 (endIdx가 구간 끝일 때) */
function startOfFeatureAt(
  coords: LatLng[],
  segs: SegmentInfo[],
  endIdx: number,
  type: WalkwayType,
): number {
  let i = endIdx;
  while (i > 0 && segmentTypeAt(segs, i - 1) === type) {
    i--;
  }
  return i;
}

/** 지도 polyline 기준으로 단계별 거리 재계산 — 안내용 단순화 좌표 누적 오차 보정 */
function recalibrateStepDistances(
  fullCoords: LatLng[],
  segs: SegmentInfo[],
  steps: RouteStep[],
  locale: AppLocale,
): void {
  if (fullCoords.length < 2) return;

  let cursorIdx = 0;

  for (const step of steps) {
    const targetIdx = indexOfCoord(fullCoords, step.at, cursorIdx);

    if (step.maneuver === "depart") {
      if (targetIdx >= 0) cursorIdx = targetIdx;
      step.distance = 0;
      continue;
    }

    if (step.maneuver === "arrive") {
      step.distance = 0;
      cursorIdx = fullCoords.length - 1;
      continue;
    }

    if (targetIdx < 0) continue;

    if (step.maneuver === "crosswalk") {
      step.distance = walkPathLengthBetween(fullCoords, segs, cursorIdx, targetIdx);
      cursorIdx = endOfFeatureAt(fullCoords, segs, targetIdx, "crosswalk");
      continue;
    }

    if (isGuidanceManeuver(step.maneuver) && step.maneuver !== "crosswalk") {
      const featureType = step.edgeType ?? step.maneuver;
      const entryIdx = startOfFeatureAt(fullCoords, segs, targetIdx, featureType);
      step.distance = walkPathLengthBetween(fullCoords, segs, entryIdx, targetIdx);
      cursorIdx = targetIdx;
      continue;
    }

    step.distance = walkPathLengthBetween(fullCoords, segs, cursorIdx, targetIdx);
    cursorIdx = targetIdx;
  }

  for (const step of steps) {
    formatStepText(step, locale);
  }
}

function shouldAssignPendingToNewStep(last: RouteStep | undefined): boolean {
  if (!last) return true;
  return (
    isGuidanceManeuver(last.maneuver) ||
    last.maneuver === "elevator" ||
    last.maneuver === "crosswalk" ||
    last.maneuver === "ramp" ||
    last.maneuver === "stairs"
  );
}

function applyPendingToLastOrNext(
  steps: RouteStep[],
  pendingDist: number,
  pendingHazard: string | null,
  next: Omit<RouteStep, "text"> & { text?: string },
): void {
  const last = steps[steps.length - 1];
  if (shouldAssignPendingToNewStep(last)) {
    steps.push({
      ...next,
      distance: pendingDist,
      hazard: next.hazard ?? pendingHazard,
    } as RouteStep);
    return;
  }
  last.distance += pendingDist;
  if (pendingHazard && !last.hazard) last.hazard = pendingHazard;
  steps.push({ ...next, distance: 0 } as RouteStep);
}

function buildSteps(
  coords: LatLng[],
  segs: SegmentInfo[],
  locale: AppLocale,
  elevatorTextAtCoord: Map<number, string>,
): RouteStep[] {
  const steps: RouteStep[] = [];
  if (coords.length < 2) return steps;

  const featureRuns = collectFeatureRuns(coords, segs);
  const featureAtSegStart = new Map<number, FeatureRun>();
  const segInFeature = new Set<number>();
  for (const run of featureRuns) {
    featureAtSegStart.set(run.startSeg, run);
    for (let s = run.startSeg; s < run.endSeg; s++) segInFeature.add(s);
  }

  const elevatorCoordIndices = new Set(elevatorTextAtCoord.keys());
  const skipTurnAt = new Set<number>();
  for (const e of elevatorCoordIndices) {
    skipTurnAt.add(e + 1);
  }

  let pendingDist = 0;
  let pendingType: WalkwayType = segs[0]?.type ?? "path";
  let pendingHazard: string | null = hazardFor(pendingType, locale);

  steps.push({
    text: continueStraightPlaceholder(locale),
    distance: 0,
    at: coords[0],
    maneuver: "depart",
    edgeType: pendingType,
    hazard: pendingHazard,
  });

  for (let i = 0; i < coords.length - 1; i++) {
    const segLen = haversineMeters(coords[i], coords[i + 1]);
    const segType = segs[i]?.type ?? "path";

    const featureRun = featureAtSegStart.get(i);
    if (featureRun) {
      const last = steps[steps.length - 1];
      const approach = pendingDist;
      const approachHazard = pendingHazard;
      pendingDist = 0;
      pendingHazard = null;

      const maneuver = guidanceManeuverFor(featureRun.type)!;

      if (featureRun.type === "crosswalk") {
        steps.push({
          text: crosswalkAheadText(formatDistance(approach, locale), locale),
          distance: approach,
          at: coords[featureRun.startSeg],
          maneuver,
          edgeType: featureRun.type,
          hazard: null,
        });
      } else {
        if (!shouldAssignPendingToNewStep(last)) {
          last.distance += approach;
          if (approachHazard && !last.hazard) last.hazard = approachHazard;
        }
        steps.push({
          text:
            featureFollowText(featureRun.type, formatDistance(featureRun.distance, locale), locale) ??
            "",
          distance: featureRun.distance,
          at: coords[featureRun.endSeg],
          maneuver,
          edgeType: featureRun.type,
          hazard: null,
        });
      }

      if (featureRun.endSeg >= segs.length) {
        steps.push({
          text: arriveMessage(locale),
          distance: 0,
          at: coords[coords.length - 1],
          maneuver: "arrive",
          edgeType: segs[segs.length - 1]?.type ?? "path",
          hazard: null,
        });
        break;
      }

      i = featureRun.endSeg - 1;
      pendingType = segs[i]?.type ?? "path";
      continue;
    }

    if (segInFeature.has(i)) {
      continue;
    }

    pendingDist += segLen;
    pendingHazard = hazardFor(segType, locale);

    const elevatorText = elevatorTextAtCoord.get(i + 1);
    if (elevatorText) {
      applyPendingToLastOrNext(steps, pendingDist, pendingHazard, {
        text: elevatorText,
        at: coords[i + 1],
        maneuver: "elevator",
        edgeType: "elevator",
        hazard: null,
      });
      pendingDist = 0;
      pendingType = segType;
      pendingHazard = null;
      continue;
    }

    const isLastVertex = i + 1 >= coords.length - 1;
    if (isLastVertex) {
      const last = steps[steps.length - 1];
      if (!shouldAssignPendingToNewStep(last)) {
        last.distance += pendingDist;
        if (pendingHazard && !last.hazard) last.hazard = pendingHazard;
      }
      steps.push({
        text: arriveMessage(locale),
        distance: 0,
        at: coords[coords.length - 1],
        maneuver: "arrive",
        edgeType: segType,
        hazard: null,
      });
      break;
    }

    // 승강기 직후 복도 꺾임에서 잘못된 유턴 안내 생략
    if (skipTurnAt.has(i + 1)) {
      continue;
    }

    const segAfter = segs[i + 1]?.type ?? "path";
    if (CONTINUOUS_FEATURE.has(segType) || CONTINUOUS_FEATURE.has(segAfter)) {
      continue;
    }

    const inBearing = bearingDeg(coords[i], coords[i + 1]);
    const outBearing = bearingDeg(coords[i + 1], coords[i + 2]);
    const delta = angleDelta(inBearing, outBearing);
    const maneuver = maneuverFromDelta(delta);

    if (maneuver === "straight") continue;

    const label = maneuverLabel(maneuver, locale);
    applyPendingToLastOrNext(steps, pendingDist, pendingHazard, {
      text: turnThenContinueText(label, locale),
      at: coords[i + 1],
      maneuver,
      edgeType: segType,
      hazard: null,
    });
    pendingDist = 0;
    pendingType = segType;
    pendingHazard = null;
  }

  return consolidateStraightSteps(
    consolidateMicroTurns(consolidateFeatureSteps(steps, locale), locale),
    locale,
  );
}

function nodePathToRoute(
  graph: RoutingGraph,
  nodePath: string[],
  from: LatLng,
  to: LatLng,
  locale: AppLocale,
  usesElevatorRoute: boolean,
): ComputedRoute {
  const nodeCoords: LatLng[] = nodePath.map((id) => {
    const n = graph.nodes.get(id)!;
    return { lat: n.lat, lng: n.lng };
  });
  const segs: SegmentInfo[] = [];
  for (let i = 0; i < nodePath.length - 1; i++) {
    segs.push({
      type: edgeTypeBetween(graph, nodePath[i], nodePath[i + 1]),
    });
  }

  const coords: LatLng[] = [];
  const fullSegs: SegmentInfo[] = [];

  const startGap = haversineMeters(from, nodeCoords[0]);
  const coordOffset = startGap > 1 ? 1 : 0;
  if (startGap > 1) {
    coords.push(from);
    fullSegs.push({ type: "path" });
  }
  coords.push(...nodeCoords);
  fullSegs.push(...segs);

  const endGap = haversineMeters(nodeCoords[nodeCoords.length - 1], to);
  if (endGap > 1) {
    fullSegs.push({ type: "path" });
    coords.push(to);
  }

  const distance = walkPolylineLength(coords, fullSegs);

  const elevatorTextAtCoord = buildElevatorStepsAtCoord(graph, nodePath, coordOffset, locale);
  const steps = buildSteps(coords, fullSegs, locale, elevatorTextAtCoord);
  recalibrateStepDistances(coords, fullSegs, steps, locale);
  const segmentTypes = fullSegs.map((s) => s.type);
  const hasStairs = segmentTypes.some((s) => s === "stairs");
  const hasCrosswalk = segmentTypes.some((s) => s === "crosswalk");
  const hasElevator =
    usesElevatorRoute ||
    segmentTypes.some((s) => s === "elevator") ||
    elevatorTextAtCoord.size > 0;

  return { coords, distance, steps, hasStairs, hasCrosswalk, hasElevator, segmentTypes };
}

/** 빠른 경로 — 물리 거리 기준 최단 (계단·승강기 여부 무관) */
function pickFastNodePath(
  graph: RoutingGraph,
  startId: string,
  endId: string,
): { nodePath: string[]; usesElevator: boolean } | null {
  const physical =
    dijkstra(graph, startId, endId, { mode: "physical" }) ??
    dijkstra(graph, startId, endId, { mode: "shortest" });
  if (!physical) return null;
  return {
    nodePath: physical,
    usesElevator:
      pathUsesElevator(graph, physical) || pathVisitsElevatorHub(graph, physical),
  };
}

function pathUsesElevatorOrHub(graph: RoutingGraph, nodePath: string[]): boolean {
  return pathUsesElevator(graph, nodePath) || pathVisitsElevatorHub(graph, nodePath);
}

/** 목적지 직전 불필요한 승강기·되돌아감 우회 */
function isWastefulComfortDetour(
  graph: RoutingGraph,
  nodePath: string[],
  startId: string,
  endId: string,
  baselineDist: number,
): boolean {
  const startNode = graph.nodes.get(startId)!;
  const endNode = graph.nodes.get(endId)!;
  const dist = pathPhysicalDistance(graph, nodePath);

  if (pathNearBackwardElevator(graph, nodePath, startNode, endNode)) return true;

  const maxDist = baselineDist * ACCESSIBLE_DETOUR_RATIO + ACCESSIBLE_DETOUR_EXTRA_M;
  if (dist > maxDist) return true;

  for (const evId of elevatorsUsedOnPath(graph, nodePath)) {
    const n = graph.nodes.get(evId)!;
    const prog = progressAlongRoute(n, startNode, endNode);
    if (prog > 0.65 && dist > baselineDist + LATE_ELEVATOR_MAX_EXTRA_M) return true;
  }

  return false;
}

/** 최적 경로 — 계단 없음, 불필요한 승강기·우회 제거 */
function pickComfortNodePath(
  graph: RoutingGraph,
  startId: string,
  endId: string,
): { nodePath: string[]; usesElevator: boolean } | null {
  const accessibleDirect = dijkstra(graph, startId, endId, { mode: "accessible" });
  const baselinePath =
    accessibleDirect && !pathHasStairs(graph, accessibleDirect)
      ? accessibleDirect
      : accessiblePathBetween(graph, startId, endId);
  const baselineDist = baselinePath
    ? pathPhysicalDistance(graph, baselinePath)
    : Infinity;

  const candidates = collectPathCandidates(graph, startId, endId, true);
  const seenStairFree = new Set<string>();
  const stairFree: string[][] = [];

  const addStairFree = (path: string[] | null) => {
    if (!path?.length || pathHasStairs(graph, path)) return;
    const sig = pathSignature(path);
    if (seenStairFree.has(sig)) return;
    seenStairFree.add(sig);
    stairFree.push(path);
  };

  addStairFree(accessibleDirect);
  for (const path of candidates) addStairFree(path);

  if (!stairFree.length) {
    addStairFree(accessiblePathBetween(graph, startId, endId));
  }
  if (!stairFree.length) return null;

  const referencePath =
    dijkstra(graph, startId, endId, { mode: "shortest" }) ??
    dijkstra(graph, startId, endId, { mode: "physical" });
  const shortestDist = referencePath
    ? pathPhysicalDistance(graph, referencePath)
    : pathPhysicalDistance(graph, stairFree[0]);
  const corridorElevators = referencePath
    ? corridorElevatorIds(graph, referencePath)
    : new Set<string>();
  const referenceStairM = referencePath ? pathStairMeters(graph, referencePath) : 0;

  const baselineForFilter = Number.isFinite(baselineDist) ? baselineDist : shortestDist;
  let pool = stairFree.filter(
    (path) => !isWastefulComfortDetour(graph, path, startId, endId, baselineForFilter),
  );
  if (!pool.length) {
    pool = stairFree.filter((path) => !pathHasStairs(graph, path));
  }
  if (!pool.length) return null;

  let best = pool[0];
  let bestScore = scorePathCandidate(
    graph,
    best,
    shortestDist,
    startId,
    endId,
    corridorElevators,
    referenceStairM,
    true,
  );
  for (let i = 1; i < pool.length; i++) {
    const score = scorePathCandidate(
      graph,
      pool[i],
      shortestDist,
      startId,
      endId,
      corridorElevators,
      referenceStairM,
      true,
    );
    if (score < bestScore) {
      best = pool[i];
      bestScore = score;
    }
  }

  if (pathHasStairs(graph, best)) return null;

  if (baselinePath && !pathHasStairs(graph, baselinePath)) {
    const bestDist = pathPhysicalDistance(graph, best);
    const baseDist = pathPhysicalDistance(graph, baselinePath);
    const bestUsesLift = pathUsesElevatorOrHub(graph, best);
    const baseUsesLift = pathUsesElevatorOrHub(graph, baselinePath);
    if (
      bestUsesLift &&
      !baseUsesLift &&
      bestDist > baseDist + LATE_ELEVATOR_MAX_EXTRA_M
    ) {
      best = baselinePath;
    } else if (bestDist > baseDist + 50 && !bestUsesLift) {
      best = baselinePath;
    }
  }

  return {
    nodePath: best,
    usesElevator: pathUsesElevatorOrHub(graph, best),
  };
}

function pickNodePath(
  graph: RoutingGraph,
  startId: string,
  endId: string,
  options: { profile?: RouteProfile } = {},
): { nodePath: string[]; usesElevator: boolean } | null {
  const profile = options.profile ?? "fast";
  if (profile === "comfort") {
    return pickComfortNodePath(graph, startId, endId);
  }
  return pickFastNodePath(graph, startId, endId);
}

function pickBestComfortEntrance(
  graph: RoutingGraph,
  entrances: BuildingEntrance[],
  buildingId: string,
  otherPoint: LatLng,
): LatLng {
  const candidates = rankEntrancesForBuilding(graph, entrances, buildingId).slice(0, 5);
  if (!candidates.length) return otherPoint;

  const otherSnap = nearestNode(graph, otherPoint);
  if (!otherSnap) return candidates[0].point;

  let best = candidates[0].point;
  let bestCost = Infinity;
  for (const entrance of candidates) {
    const startSnap = nearestNode(graph, entrance.point);
    if (!startSnap) continue;
    const path = accessiblePathBetween(graph, startSnap.id, otherSnap.id);
    if (!path) continue;
    const walkM = pathPhysicalDistance(graph, path);
    const approachBias = haversineMeters(entrance.point, otherPoint) * 0.08;
    const cost = walkM + approachBias;
    if (cost < bestCost) {
      bestCost = cost;
      best = entrance.point;
    }
  }
  return best;
}

/** 최적(comfort) 경로용 출입구 — 경사로 접근 우선 */
export function resolveComfortRouteEndpoints(
  graph: RoutingGraph,
  entrances: BuildingEntrance[],
  origin: RoutePoint,
  destination: RoutePoint,
): { from: LatLng; to: LatLng } {
  const fromIsBuilding = origin.kind === "building" && !!origin.buildingId;
  const toIsBuilding = destination.kind === "building" && !!destination.buildingId;

  if (!fromIsBuilding && !toIsBuilding) {
    return { from: origin.point, to: destination.point };
  }

  let from = origin.point;
  let to = destination.point;

  if (fromIsBuilding && toIsBuilding) {
    const fromCandidates = rankEntrancesForBuilding(
      graph,
      entrances,
      origin.buildingId!,
    ).slice(0, 5);
    const toCandidates = rankEntrancesForBuilding(
      graph,
      entrances,
      destination.buildingId!,
    ).slice(0, 5);

    let bestFrom = from;
    let bestTo = to;
    let bestCost = Infinity;

    for (const fromEntrance of fromCandidates) {
      const startSnap = nearestNode(graph, fromEntrance.point);
      if (!startSnap) continue;
      for (const toEntrance of toCandidates) {
        const endSnap = nearestNode(graph, toEntrance.point);
        if (!endSnap) continue;
        const path = accessiblePathBetween(graph, startSnap.id, endSnap.id);
        if (!path) continue;
        const cost = pathPhysicalDistance(graph, path);
        if (cost < bestCost) {
          bestCost = cost;
          bestFrom = fromEntrance.point;
          bestTo = toEntrance.point;
        }
      }
    }
    return { from: bestFrom, to: bestTo };
  }

  if (fromIsBuilding) {
    from = pickBestComfortEntrance(graph, entrances, origin.buildingId!, destination.point);
  }
  if (toIsBuilding) {
    to = pickBestComfortEntrance(graph, entrances, destination.buildingId!, origin.point);
  }

  return { from, to };
}

/** 출발·도착 지점 기준 빠른/최적 경로를 함께 계산 */
export function computeRoutePair(
  graph: RoutingGraph,
  entrances: BuildingEntrance[],
  origin: RoutePoint,
  destination: RoutePoint,
  locale: AppLocale = "ko",
  elevators: ElevatorRecord[] = [],
): RoutePairResult {
  const fixed = tryFixedRoutePair(graph, entrances, elevators, origin, destination, locale);
  if (fixed) return fixed;

  const fastEndpoints = { from: origin.point, to: destination.point };
  const comfortEndpoints = resolveComfortRouteEndpoints(
    graph,
    entrances,
    origin,
    destination,
  );

  const fastRoute = computeRoute(graph, fastEndpoints.from, fastEndpoints.to, locale, {
    profile: "fast",
  });
  const comfortRoute =
    computeRoute(graph, comfortEndpoints.from, comfortEndpoints.to, locale, {
      profile: "comfort",
    }) ??
    computeRoute(graph, fastEndpoints.from, fastEndpoints.to, locale, {
      profile: "comfort",
    });

  return {
    fast: fastRoute,
    comfort: comfortRoute,
    endpoints: {
      fast: fastEndpoints,
      comfort: comfortEndpoints,
    },
  };
}

function routeSampleKey(route: ComputedRoute): string {
  const n = route.coords.length;
  if (n < 2) return "";
  const idx = [0, Math.floor(n * 0.33), Math.floor(n * 0.66), n - 1];
  return idx
    .map((i) => {
      const c = route.coords[i];
      return `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
    })
    .join("|");
}

/** UI — 빠른/최적 경로 선택 표시 여부 (실질적으로 다를 때만) */
export function routesAreDistinct(a: ComputedRoute, b: ComputedRoute): boolean {
  if (a === b) return false;

  const sampleA = routeSampleKey(a);
  const sampleB = routeSampleKey(b);
  if (
    sampleA &&
    sampleB &&
    sampleA === sampleB &&
    Math.abs(a.distance - b.distance) <= 12
  ) {
    return false;
  }

  if (a.hasStairs !== b.hasStairs) return true;
  if (a.hasElevator !== b.hasElevator) return true;
  if (Math.abs(a.distance - b.distance) > 12) return true;
  if (a.segmentTypes.join("\0") !== b.segmentTypes.join("\0")) return true;

  const eps = 1e-4;
  const coordDiff = (p: LatLng, q: LatLng) =>
    Math.abs(p.lat - q.lat) > eps || Math.abs(p.lng - q.lng) > eps;

  const samples = [0, 0.33, 0.66, 1] as const;
  for (const t of samples) {
    const ai = Math.min(a.coords.length - 1, Math.floor((a.coords.length - 1) * t));
    const bi = Math.min(b.coords.length - 1, Math.floor((b.coords.length - 1) * t));
    const ac = a.coords[ai];
    const bc = b.coords[bi];
    if (ac && bc && coordDiff(ac, bc)) return true;
  }

  return false;
}

/**
 * 출발/도착 좌표로 보행로 그래프 기반 경로 계산.
 * 승강기 경유가 가능하면 우선하며, 각 승강기별 경로를 비교해 선택한다.
 */
export function computeRoute(
  graph: RoutingGraph,
  from: LatLng,
  to: LatLng,
  locale: AppLocale = "ko",
  options: ComputeRouteOptions = {},
): ComputedRoute | null {
  if (!graph.nodes.size) return null;
  const startSnap = nearestNode(graph, from);
  const endSnap = nearestNode(graph, to);
  if (!startSnap || !endSnap) return null;

  const picked = pickNodePath(graph, startSnap.id, endSnap.id, {
    profile: options.profile ?? "fast",
  });
  if (!picked) return null;

  return nodePathToRoute(graph, picked.nodePath, from, to, locale, picked.usesElevator);
}
