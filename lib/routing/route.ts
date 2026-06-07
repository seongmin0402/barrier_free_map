import {
  angleDelta,
  bearingDeg,
  formatDistance,
  haversineMeters,
  projectOnSegment,
  type LatLng,
} from "./geo";
import { nearestNode } from "./graph";
import { simplifyForGuidance } from "./polyline-simplify";
import type { AppLocale } from "@/lib/app-settings";
import { formatFloorLabel, type ElevatorRecord } from "./elevators";
import {
  aheadTurnText,
  arriveMessage,
  continueStraightPlaceholder,
  departStraightText,
  elevatorTransferText,
  featureFollowText,
  hazardText,
  maneuverLabel,
  turnThenContinueText,
} from "@/lib/i18n/navigation";
import type {
  ComputedRoute,
  GraphEdge,
  ManeuverKind,
  RouteStep,
  RoutingGraph,
  WalkwayType,
} from "./types";

type RouteWeightMode = "shortest" | "elevator";

/** type별 비용 가중치 — shortest에서도 계단은 상대적으로 비싸게 */
export function edgeWeight(type: WalkwayType, mode: RouteWeightMode = "shortest"): number {
  switch (type) {
    case "stairs":
      return mode === "elevator" ? 6.5 : 2.6;
    case "elevator":
      return 0.22;
    case "ramp":
      return mode === "elevator" ? 1.02 : 1.05;
    case "crosswalk":
      return 1.1;
    case "indoor":
      return mode === "elevator" ? 0.82 : 1;
    default:
      return mode === "elevator" ? 0.95 : 1;
  }
}

/** 승강기 우선 (유형별 가중치 도입 전 임시 설정) */
const ELEVATOR_DETOUR_CLOSE_M = 200;
const ELEVATOR_DETOUR_RATIO = 1.5;
const ELEVATOR_DETOUR_EXTRA_M = 100;
/** 승강기 경로에 부여하는 가상 단축 — 거리가 조금 길어도 승강기 경로 선호 */
const ELEVATOR_SCORE_BONUS_M = 160;
const NO_ELEVATOR_PENALTY_M = 250;
/** 기준(최단) 경로 선형에서 승강기까지 허용 거리 — “길 위” 승강기 */
const ELEVATOR_ON_CORRIDOR_M = 48;
/** 경로에 승강기가 2곳 이상이면 불필요한 우회로 간주 — 추가 패널티 */
const EXTRA_ELEVATOR_STOP_PENALTY_M = 130;

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

function mergeNodePaths(first: string[], second: string[]): string[] {
  if (first[first.length - 1] === second[0]) return [...first, ...second.slice(1)];
  return [...first, ...second];
}

function pathSignature(nodePath: string[]): string {
  return nodePath.join("\0");
}

function withinElevatorDetourBudget(dist: number, shortestDist: number): boolean {
  const detour = dist - shortestDist;
  if (detour <= ELEVATOR_DETOUR_CLOSE_M) return true;
  return dist <= shortestDist * ELEVATOR_DETOUR_RATIO + ELEVATOR_DETOUR_EXTRA_M;
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
function scorePathCandidate(
  graph: RoutingGraph,
  nodePath: string[],
  shortestDist: number,
  startId: string,
  endId: string,
  corridorElevators: Set<string>,
): number {
  const dist = pathPhysicalDistance(graph, nodePath);
  const stairM = pathStairMeters(graph, nodePath);
  const usesElevator = pathUsesElevator(graph, nodePath);
  let score = dist;
  score += stairM * 12;
  if (usesElevator) {
    score -= ELEVATOR_SCORE_BONUS_M;
  } else {
    score += NO_ELEVATOR_PENALTY_M;
  }

  const startNode = graph.nodes.get(startId)!;
  const endNode = graph.nodes.get(endId)!;
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
      if (prog >= 0.15 && corridorElevators.has(evId)) {
        score -= 55;
      }
    }

    // 가는 방향 “길 위” 승강기 선호 — 출발지 인근(≈산학연구관)만 쓰는 경로는 불리
    if (bestProgress >= 0.15 && bestProgress <= 0.92) {
      score -= 120;
      score -= (bestProgress - 0.15) * 200;
    }
    if (bestProgress < 0.12) score += 180;

    if (onCorridor) {
      score -= 90;
    } else if (usesElevator) {
      score += 55;
    }
  }

  const detour = dist - shortestDist;
  if (detour > ELEVATOR_DETOUR_CLOSE_M) {
    score += (detour - ELEVATOR_DETOUR_CLOSE_M) * 0.45;
  }
  return score;
}

function collectPathCandidates(
  graph: RoutingGraph,
  startId: string,
  endId: string,
): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  const add = (path: string[] | null) => {
    if (!path?.length) return;
    const sig = pathSignature(path);
    if (seen.has(sig)) return;
    seen.add(sig);
    candidates.push(path);
  };

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
  const usedElevators = new Set(elevatorsUsedOnPath(graph, nodePath));
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

/** 경사로·계단 polyline 꺾임 — 구간 단위로 안내 */
const CONTINUOUS_FEATURE = new Set<WalkwayType>(["ramp", "stairs"]);

function isTurnManeuver(m: ManeuverKind): boolean {
  return m !== "depart" && m !== "arrive" && m !== "elevator" && m !== "straight";
}

function formatStepText(step: RouteStep, locale: AppLocale): void {
  if (step.maneuver === "elevator") {
    step.hazard = null;
    return;
  }

  const dist = formatDistance(step.distance, locale);
  const featureType =
    step.edgeType && CONTINUOUS_FEATURE.has(step.edgeType)
      ? step.edgeType
      : step.hazard === hazardText("ramp", locale)
        ? "ramp"
        : step.hazard === hazardText("stairs", locale)
          ? "stairs"
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

/** 연속 경사로/계단 회전 안내를 한 step으로 병합 */
function consolidateFeatureSteps(steps: RouteStep[], locale: AppLocale): RouteStep[] {
  const out: RouteStep[] = [];

  for (const step of steps) {
    const prev = out[out.length - 1];
    const featureType =
      step.edgeType && CONTINUOUS_FEATURE.has(step.edgeType) ? step.edgeType : null;
    const prevFeature =
      prev?.edgeType && CONTINUOUS_FEATURE.has(prev.edgeType) ? prev.edgeType : null;

    if (
      prev &&
      featureType &&
      prevFeature === featureType &&
      isTurnManeuver(prev.maneuver) &&
      isTurnManeuver(step.maneuver)
    ) {
      prev.distance += step.distance;
      prev.at = step.at;
      prev.maneuver = "straight";
      prev.edgeType = featureType;
      prev.hazard = null;
      formatStepText(prev, locale);
      continue;
    }

    out.push(step);
  }

  return out;
}

/** 직전 직진이 짧을 때(≤22m) 사소한 회전 안내 생략 */
function consolidateMicroTurns(steps: RouteStep[], locale: AppLocale): RouteStep[] {
  const out: RouteStep[] = [];

  for (const step of steps) {
    const prev = out[out.length - 1];
    if (
      prev &&
      isTurnManeuver(step.maneuver) &&
      (prev.maneuver === "depart" || prev.maneuver === "straight") &&
      prev.distance <= 22 &&
      step.maneuver !== "uturn"
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
      step.maneuver !== "elevator";

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

function buildSteps(
  coords: LatLng[],
  segs: SegmentInfo[],
  locale: AppLocale,
  elevatorTextAtCoord: Map<number, string>,
): RouteStep[] {
  const steps: RouteStep[] = [];
  if (coords.length < 2) return steps;

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
    pendingDist += segLen;
    pendingHazard = hazardFor(segType, locale);

    const elevatorText = elevatorTextAtCoord.get(i + 1);
    if (elevatorText) {
      const last = steps[steps.length - 1];
      last.distance += pendingDist;
      if (pendingHazard && !last.hazard) last.hazard = pendingHazard;
      steps.push({
        text: elevatorText,
        distance: 0,
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
      last.distance += pendingDist;
      if (pendingHazard && !last.hazard) last.hazard = pendingHazard;
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

    const last = steps[steps.length - 1];
    last.distance += pendingDist;
    if (pendingHazard && !last.hazard) last.hazard = pendingHazard;

    const label = maneuverLabel(maneuver, locale);
    steps.push({
      text: turnThenContinueText(label, locale),
      distance: 0,
      at: coords[i + 1],
      maneuver,
      edgeType: segType,
      hazard: null,
    });
    pendingDist = 0;
    pendingType = segType;
    pendingHazard = null;
  }

  for (const step of steps) {
    formatStepText(step, locale);
  }

  return consolidateStraightSteps(consolidateMicroTurns(consolidateFeatureSteps(steps, locale), locale), locale);
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

  let distance = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    distance += haversineMeters(coords[i], coords[i + 1]);
  }

  const elevatorTextAtCoord = buildElevatorStepsAtCoord(graph, nodePath, coordOffset, locale);
  const guide = simplifyForGuidance(coords, fullSegs, elevatorTextAtCoord, 14);
  const steps = buildSteps(guide.coords, guide.segs, locale, guide.elevatorText);
  const segmentTypes = fullSegs.map((s) => s.type);
  const hasStairs = segmentTypes.some((s) => s === "stairs");
  const hasCrosswalk = segmentTypes.some((s) => s === "crosswalk");
  const hasElevator =
    usesElevatorRoute ||
    segmentTypes.some((s) => s === "elevator") ||
    elevatorTextAtCoord.size > 0;

  return { coords, distance, steps, hasStairs, hasCrosswalk, hasElevator, segmentTypes };
}

function pickNodePath(
  graph: RoutingGraph,
  startId: string,
  endId: string,
): { nodePath: string[]; usesElevator: boolean } | null {
  const candidates = collectPathCandidates(graph, startId, endId);
  if (!candidates.length) return null;

  const referencePath =
    dijkstra(graph, startId, endId, { mode: "shortest" }) ??
    dijkstra(graph, startId, endId, { mode: "elevator" });
  const corridorElevators = referencePath
    ? corridorElevatorIds(graph, referencePath)
    : new Set<string>();

  let shortest = candidates[0];
  let shortestDist = pathPhysicalDistance(graph, shortest);
  for (const path of candidates) {
    const d = pathPhysicalDistance(graph, path);
    if (d < shortestDist) {
      shortest = path;
      shortestDist = d;
    }
  }

  if (!graph.elevatorNodeIds.size) {
    return { nodePath: shortest, usesElevator: false };
  }

  const elevatorCandidates = candidates.filter((path) => {
    if (!pathUsesElevator(graph, path)) return false;
    const dist = pathPhysicalDistance(graph, path);
    if (withinElevatorDetourBudget(dist, shortestDist)) return true;
    return elevatorsUsedOnPath(graph, path).some((id) => corridorElevators.has(id));
  });

  const startNode = graph.nodes.get(startId)!;
  const endNode = graph.nodes.get(endId)!;

  /** 가는 방향 “길 위” 승강기 중 출발 직후가 아닌 구간(≈15% 이후) */
  const midCorridorElevatorPaths = elevatorCandidates.filter((path) =>
    elevatorsUsedOnPath(graph, path).some((id) => {
      if (!corridorElevators.has(id)) return false;
      const n = graph.nodes.get(id)!;
      return progressAlongRoute(n, startNode, endNode) >= 0.15;
    }),
  );

  const midOnlyElevatorPaths = midCorridorElevatorPaths.filter((path) => {
    const onPath = elevatorsUsedOnPath(graph, path);
    const hasStartNear = onPath.some((id) => {
      const n = graph.nodes.get(id)!;
      return progressAlongRoute(n, startNode, endNode) < 0.12;
    });
    return !hasStartNear;
  });

  const singleMidElevatorPaths = midCorridorElevatorPaths.filter((path) => {
    const onPath = elevatorsUsedOnPath(graph, path);
    if (onPath.length !== 1) return false;
    const n = graph.nodes.get(onPath[0])!;
    return (
      corridorElevators.has(onPath[0]) &&
      progressAlongRoute(n, startNode, endNode) >= 0.15
    );
  });

  let pool = elevatorCandidates.length > 0 ? elevatorCandidates : candidates;

  if (singleMidElevatorPaths.length > 0) {
    pool = singleMidElevatorPaths;
  } else if (midOnlyElevatorPaths.length > 0) {
    pool = midOnlyElevatorPaths;
  } else if (midCorridorElevatorPaths.length > 0) {
    pool = midCorridorElevatorPaths;
  }

  let best = pool[0];
  let bestScore = scorePathCandidate(graph, best, shortestDist, startId, endId, corridorElevators);
  for (let i = 1; i < pool.length; i++) {
    const score = scorePathCandidate(graph, pool[i], shortestDist, startId, endId, corridorElevators);
    if (score < bestScore) {
      best = pool[i];
      bestScore = score;
    }
  }

  return {
    nodePath: best,
    usesElevator: pathUsesElevator(graph, best),
  };
}

/**
 * 출발/도착 좌표로 보행로 그래프 기반 경로 계산.
 * 승강기 경유가 가능하면 우선하며, 각 승강기별 경로를 비교해 선택한다.
 * (유형별 가중치는 추후 별도 적용)
 */
export function computeRoute(
  graph: RoutingGraph,
  from: LatLng,
  to: LatLng,
  locale: AppLocale = "ko",
): ComputedRoute | null {
  if (!graph.nodes.size) return null;
  const startSnap = nearestNode(graph, from);
  const endSnap = nearestNode(graph, to);
  if (!startSnap || !endSnap) return null;

  const picked = pickNodePath(graph, startSnap.id, endSnap.id);
  if (!picked) return null;

  return nodePathToRoute(graph, picked.nodePath, from, to, locale, picked.usesElevator);
}
