import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { haversineMeters, projectOnSegment, type LatLng } from "../lib/routing/geo";
import { buildRoutingGraph, mainEntranceForBuilding, parseEntrances, nearestNode } from "../lib/routing/graph";
import { parseElevators } from "../lib/routing/elevators";
import { computeRoute } from "../lib/routing/route";
import { douglasPeuckerIndices } from "../lib/routing/polyline-simplify";
import type { FeatureCollection, WalkwayFeature } from "../lib/routing/types";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (n: string) => JSON.parse(fs.readFileSync(path.join(root, n), "utf8"));

function pathSum(coords: LatLng[]): number {
  let s = 0;
  for (let i = 0; i < coords.length - 1; i++) s += haversineMeters(coords[i], coords[i + 1]);
  return s;
}

function simplifiedLength(coords: LatLng[], tol: number): number {
  const kept = douglasPeuckerIndices(coords, tol);
  let s = 0;
  for (let k = 0; k < kept.length - 1; k++) {
    s += haversineMeters(coords[kept[k]], coords[kept[k + 1]]);
  }
  return s;
}

function microSegmentExcess(coords: LatLng[], maxSeg = 3): number {
  let removed = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = haversineMeters(coords[i], coords[i + 1]);
    if (d < maxSeg) removed += d;
  }
  return removed;
}

function nearestEdgeProjection(
  graph: ReturnType<typeof buildRoutingGraph>,
  point: LatLng,
): { distance: number; along: LatLng } | null {
  let best = Infinity;
  let bestPoint: LatLng | null = null;
  for (const [, edges] of graph.adjacency) {
    for (const e of edges) {
      const a = graph.nodes.get(e.to);
      if (!a) continue;
    }
  }
  // iterate all edges once via node pairs
  const seen = new Set<string>();
  for (const [fromId, edges] of graph.adjacency) {
    const a = graph.nodes.get(fromId)!;
    for (const e of edges) {
      const key = [fromId, e.to].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const b = graph.nodes.get(e.to)!;
      const { point: p, distance } = projectOnSegment(point, a, b);
      if (distance < best) {
        best = distance;
        bestPoint = p;
      }
    }
  }
  return bestPoint ? { distance: best, along: bestPoint } : null;
}

const walkways: FeatureCollection<WalkwayFeature> = {
  type: "FeatureCollection",
  features: [...readJson("bb_4326.geojson").features, ...readJson("indoor.geojson").features],
};
const graph = buildRoutingGraph(walkways, parseElevators(readJson("ev_4326.geojson")));
const entrances = parseEntrances(readJson("e_4326.geojson"));

const pairs = [
  ["b-28", "b-0", "드림하우스→인문대"],
  ["b-19", "b-1", "웅비→중앙도서관"],
];

for (const [a, b, label] of pairs) {
  const from = mainEntranceForBuilding(entrances, a)!;
  const to = mainEntranceForBuilding(entrances, b)!;
  const route = computeRoute(graph, from.point, to.point, "ko")!;
  const snapFrom = nearestNode(graph, from.point)!;
  const snapTo = nearestNode(graph, to.point)!;
  const edgeFrom = nearestEdgeProjection(graph, from.point)!;
  const edgeTo = nearestEdgeProjection(graph, to.point)!;

  const startGap = haversineMeters(from.point, route.coords[0]);
  const endGap = haversineMeters(route.coords[route.coords.length - 1], to.point);

  console.log(`\n=== ${label} ===`);
  console.log("route.distance:", Math.round(route.distance), "m");
  console.log("polyline sum:", Math.round(pathSum(route.coords)), "m");
  console.log("DP 4m:", Math.round(simplifiedLength(route.coords, 4)), "m");
  console.log("DP 6m:", Math.round(simplifiedLength(route.coords, 6)), "m");
  console.log("DP 8m:", Math.round(simplifiedLength(route.coords, 8)), "m");
  console.log("segments <3m total:", Math.round(microSegmentExcess(route.coords, 3)), "m");
  console.log("nearest NODE snap from:", Math.round(snapFrom.distance), "m | edge proj:", Math.round(edgeFrom.distance), "m");
  console.log("nearest NODE snap to:", Math.round(snapTo.distance), "m | edge proj:", Math.round(edgeTo.distance), "m");
  console.log("startGap chord:", Math.round(startGap), "m | endGap:", Math.round(endGap), "m");
  console.log("sum step distances:", Math.round(route.steps.reduce((s, st) => s + st.distance, 0)), "m");
}
