import {
  angleDelta,
  bearingDeg,
  formatDistance,
  haversineMeters,
  type LatLng,
} from "./geo";
import { nearestNode } from "./graph";
import type { AppLocale } from "@/lib/app-settings";
import { formatFloorLabel, type ElevatorRecord } from "./elevators";
import {
  aheadTurnText,
  arriveMessage,
  continueStraightPlaceholder,
  departStraightText,
  elevatorTransferText,
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

/** type별 비용 가중치 */
export function edgeWeight(type: WalkwayType, mode: RouteWeightMode = "shortest"): number {
  switch (type) {
    case "stairs":
      return mode === "elevator" ? 4.2 : 1.6;
    case "elevator":
      return 0.35;
    case "ramp":
      return 1.05;
    case "crosswalk":
      return 1.1;
    case "indoor":
      return mode === "elevator" ? 0.92 : 1;
    default:
      return 1;
  }
}

/** 엘리베이터 우선 시 허용 우회 (비율 + 절대 m) */
const ELEVATOR_DETOUR_RATIO = 1.32;
const ELEVATOR_DETOUR_EXTRA_M = 55;

interface SegmentInfo {
  type: WalkwayType;
}

interface DijkstraOptions {
  mode?: RouteWeightMode;
  elevatorNodeIds?: Set<string>;
}

function edgeCost(
  edge: GraphEdge,
  mode: RouteWeightMode,
  fromId: string,
  toId: string,
  elevatorNodeIds: Set<string>,
): number {
  let cost = edge.distance * edgeWeight(edge.type, mode);
  if (mode === "elevator" && (elevatorNodeIds.has(fromId) || elevatorNodeIds.has(toId))) {
    cost *= 0.82;
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
      const cost = edgeCost(edge, mode, id, edge.to, elevatorNodeIds);
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

function pathUsesElevator(nodePath: string[], elevatorNodeIds: Set<string>): boolean {
  return nodePath.some((id) => elevatorNodeIds.has(id));
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
  for (let i = 0; i < nodePath.length - 1; i++) {
    if (edgeTypeBetween(graph, nodePath[i], nodePath[i + 1]) === "stairs") return true;
  }
  return false;
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
  const out = new Map<number, string>();
  for (let i = 0; i < nodePath.length; i++) {
    if (!graph.elevatorNodeIds.has(nodePath[i])) continue;
    const elevator = graph.elevatorByNodeId.get(nodePath[i]);
    const targetFloor = inferElevatorTargetFloor(graph, nodePath, i, elevator);
    const floorLabel = formatFloorLabel(targetFloor, locale);
    out.set(coordOffset + i, elevatorTransferText(floorLabel, locale));
  }
  return out;
}

function hazardFor(type: WalkwayType, locale: AppLocale): string | null {
  return hazardText(type, locale);
}

function maneuverFromDelta(delta: number): ManeuverKind {
  const a = Math.abs(delta);
  if (a >= 150) return "uturn";
  if (a < 22) return "straight";
  if (a < 60) return delta > 0 ? "slight-right" : "slight-left";
  return delta > 0 ? "right" : "left";
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
    if (step.maneuver === "elevator") continue;
    const dist = formatDistance(step.distance, locale);
    if (step.maneuver === "depart") {
      step.text = departStraightText(dist, locale);
    } else if (step.maneuver === "arrive") {
      step.text = arriveMessage(locale);
    } else {
      const label = maneuverLabel(step.maneuver, locale);
      step.text = aheadTurnText(dist, label, locale);
    }
    if (step.hazard) {
      step.text += ` (${step.hazard})`;
    }
  }

  return steps;
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
  const steps = buildSteps(coords, fullSegs, locale, elevatorTextAtCoord);
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
  const shortest = dijkstra(graph, startId, endId, { mode: "shortest" });
  if (!shortest) return null;

  if (!graph.elevatorNodeIds.size) {
    return { nodePath: shortest, usesElevator: false };
  }

  const elevatorBiased = dijkstra(graph, startId, endId, { mode: "elevator" });
  if (!elevatorBiased) {
    return { nodePath: shortest, usesElevator: pathUsesElevator(shortest, graph.elevatorNodeIds) };
  }

  const shortestDist = pathPhysicalDistance(graph, shortest);
  const elevatorDist = pathPhysicalDistance(graph, elevatorBiased);
  const elevatorUses = pathUsesElevator(elevatorBiased, graph.elevatorNodeIds);

  if (
    elevatorUses &&
    (elevatorDist <= shortestDist * ELEVATOR_DETOUR_RATIO + ELEVATOR_DETOUR_EXTRA_M ||
      (pathHasStairs(graph, shortest) && !pathHasStairs(graph, elevatorBiased)))
  ) {
    return { nodePath: elevatorBiased, usesElevator: true };
  }

  return {
    nodePath: shortest,
    usesElevator: pathUsesElevator(shortest, graph.elevatorNodeIds),
  };
}

/**
 * 출발/도착 좌표로 보행로 그래프 기반 경로 계산.
 * 실내·엘리베이터가 포함된 그래프에서는 크게 돌지 않으면 승강기 경유를 우선한다.
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
