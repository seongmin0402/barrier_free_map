import {
  angleDelta,
  bearingDeg,
  formatDistance,
  haversineMeters,
  type LatLng,
} from "./geo";
import { nearestNode } from "./graph";
import type {
  ComputedRoute,
  GraphEdge,
  ManeuverKind,
  RouteStep,
  WalkwayGraph,
  WalkwayType,
} from "./types";

/** type별 비용 가중치 (경사도 반영 전 임시값) */
export function edgeWeight(type: WalkwayType): number {
  switch (type) {
    case "stairs":
      return 1.6;
    case "ramp":
      return 1.05;
    case "crosswalk":
      return 1.1;
    default:
      return 1;
  }
}

interface SegmentInfo {
  type: WalkwayType;
}

/** 최소 힙 없이 간단 우선순위(노드 수가 작아 충분) */
function dijkstra(
  graph: WalkwayGraph,
  startId: string,
  endId: string,
): string[] | null {
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
      const cost = edge.distance * edgeWeight(edge.type);
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

function edgeTypeBetween(graph: WalkwayGraph, from: string, to: string): WalkwayType {
  const edges = graph.adjacency.get(from) ?? [];
  const e = edges.find((x: GraphEdge) => x.to === to);
  return e?.type ?? "path";
}

function hazardFor(type: WalkwayType): string | null {
  switch (type) {
    case "stairs":
      return "계단이 있습니다";
    case "crosswalk":
      return "횡단보도를 건너세요";
    case "ramp":
      return "경사로가 있습니다";
    default:
      return null;
  }
}

function maneuverFromDelta(delta: number): ManeuverKind {
  const a = Math.abs(delta);
  if (a >= 150) return "uturn";
  if (a < 22) return "straight";
  if (a < 60) return delta > 0 ? "slight-right" : "slight-left";
  return delta > 0 ? "right" : "left";
}

function maneuverLabel(maneuver: ManeuverKind): string {
  switch (maneuver) {
    case "left":
      return "좌회전";
    case "slight-left":
      return "왼쪽 방향";
    case "right":
      return "우회전";
    case "slight-right":
      return "오른쪽 방향";
    case "uturn":
      return "유턴";
    case "straight":
      return "직진";
    case "arrive":
      return "도착";
    default:
      return "출발";
  }
}

/**
 * 좌표열 + 구간 type으로 턴바이턴 안내 생성.
 * coords[i]→coords[i+1] 의 type은 segs[i].
 */
function buildSteps(coords: LatLng[], segs: SegmentInfo[]): RouteStep[] {
  const steps: RouteStep[] = [];
  if (coords.length < 2) return steps;

  // 누적 직진 거리 단위로 단계 묶기
  let pendingDist = 0;
  let pendingType: WalkwayType = segs[0]?.type ?? "path";
  let pendingHazard: string | null = hazardFor(pendingType);

  // 출발
  steps.push({
    text: "경로를 따라 직진하세요",
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
    if (hazardFor(segType)) pendingHazard = hazardFor(segType);

    // 다음 꼭짓점에서의 회전 판단
    const isLastVertex = i + 1 >= coords.length - 1;
    if (isLastVertex) {
      // 마지막 구간 → 직전 단계에 거리 반영 후 도착 단계
      const last = steps[steps.length - 1];
      last.distance += pendingDist;
      if (pendingHazard && !last.hazard) last.hazard = pendingHazard;
      steps.push({
        text: "목적지에 도착했습니다",
        distance: 0,
        at: coords[coords.length - 1],
        maneuver: "arrive",
        edgeType: segType,
        hazard: null,
      });
      pendingDist = 0;
      pendingHazard = null;
      break;
    }

    const inBearing = bearingDeg(coords[i], coords[i + 1]);
    const outBearing = bearingDeg(coords[i + 1], coords[i + 2]);
    const delta = angleDelta(inBearing, outBearing);
    const maneuver = maneuverFromDelta(delta);

    if (maneuver === "straight") {
      // 직진은 계속 누적 (다만 hazard 변화는 유지)
      continue;
    }

    // 회전 발생 → 직전까지의 거리를 이전 단계에 반영하고, 회전 단계 추가
    const last = steps[steps.length - 1];
    last.distance += pendingDist;
    if (pendingHazard && !last.hazard) last.hazard = pendingHazard;

    const turnPoint = coords[i + 1];
    const label = maneuverLabel(maneuver);
    steps.push({
      text: `${label} 후 계속 이동`,
      distance: 0,
      at: turnPoint,
      maneuver,
      edgeType: segType,
      hazard: null,
    });
    pendingDist = 0;
    pendingType = segType;
    pendingHazard = null;
  }

  // 안내 문구에 거리 부여
  for (const step of steps) {
    if (step.maneuver === "depart") {
      step.text = `경로를 따라 ${formatDistance(step.distance)} 직진하세요`;
    } else if (step.maneuver === "arrive") {
      step.text = "목적지에 도착했습니다";
    } else {
      const label = maneuverLabel(step.maneuver);
      step.text = `${formatDistance(step.distance)} 앞에서 ${label}`;
    }
    if (step.hazard) {
      step.text += ` (${step.hazard})`;
    }
  }

  return steps;
}

/**
 * 출발/도착 좌표로 보행로 그래프 기반 경로 계산.
 * 그래프 노드에 스냅한 뒤 출발/도착 실제 좌표를 양 끝에 이어 붙인다.
 */
export function computeRoute(
  graph: WalkwayGraph,
  from: LatLng,
  to: LatLng,
): ComputedRoute | null {
  if (!graph.nodes.size) return null;
  const startSnap = nearestNode(graph, from);
  const endSnap = nearestNode(graph, to);
  if (!startSnap || !endSnap) return null;

  const nodePath = dijkstra(graph, startSnap.id, endSnap.id);
  if (!nodePath || nodePath.length === 0) return null;

  // 노드 경로 → 좌표열 + 구간 type
  const nodeCoords: LatLng[] = nodePath.map((id) => {
    const n = graph.nodes.get(id)!;
    return { lat: n.lat, lng: n.lng };
  });
  const segs: SegmentInfo[] = [];
  for (let i = 0; i < nodePath.length - 1; i++) {
    segs.push({ type: edgeTypeBetween(graph, nodePath[i], nodePath[i + 1]) });
  }

  // 출발 실제좌표 → 첫 노드, 마지막 노드 → 도착 실제좌표 연결
  const coords: LatLng[] = [];
  const fullSegs: SegmentInfo[] = [];

  const startGap = haversineMeters(from, nodeCoords[0]);
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

  // 총 거리
  let distance = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    distance += haversineMeters(coords[i], coords[i + 1]);
  }

  const steps = buildSteps(coords, fullSegs);
  const segmentTypes = fullSegs.map((s) => s.type);
  const hasStairs = segs.some((s) => s.type === "stairs");
  const hasCrosswalk = segs.some((s) => s.type === "crosswalk");

  return { coords, distance, steps, hasStairs, hasCrosswalk, segmentTypes };
}
