import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRoutingGraph, mainEntranceForBuilding, nearestNode, nodeKey, parseEntrances } from "../lib/routing/graph";
import { haversineMeters } from "../lib/routing/geo";
import { parseElevators } from "../lib/routing/elevators";
import { computeRoute, edgeWeight } from "../lib/routing/route";
import type { FeatureCollection, GraphEdge, RoutingGraph, WalkwayFeature } from "../lib/routing/types";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (n: string) => JSON.parse(fs.readFileSync(path.join(root, n), "utf8"));

function dijkstra(graph: RoutingGraph, start: string, end: string, mode: "shortest" | "elevator") {
  const elevIds = graph.elevatorNodeIds;
  const dist = new Map([[start, 0]]);
  const prev = new Map<string, string>();
  const vis = new Set<string>();
  const pq = [{ id: start, d: 0 }];
  while (pq.length) {
    pq.sort((a, b) => a.d - b.d);
    const { id } = pq.shift()!;
    if (vis.has(id)) continue;
    vis.add(id);
    if (id === end) break;
    for (const e of graph.adjacency.get(id) ?? []) {
      if (vis.has(e.to)) continue;
      let c = e.distance * edgeWeight(e.type, mode);
      if (mode === "elevator" && (elevIds.has(id) || elevIds.has(e.to))) c *= 0.75;
      const nd = (dist.get(id) ?? Infinity) + c;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, id);
        pq.push({ id: e.to, d: nd });
      }
    }
  }
  if (!prev.has(end) && start !== end) return null;
  const path: string[] = [];
  let cur: string | undefined = end;
  while (cur) {
    path.unshift(cur);
    if (cur === start) break;
    cur = prev.get(cur);
  }
  return path[0] === start ? path : null;
}

function stairM(graph: RoutingGraph, path: string[]) {
  let m = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const e = (graph.adjacency.get(path[i]) ?? []).find((x: GraphEdge) => x.to === path[i + 1]);
    if (e?.type !== "stairs") continue;
    m += haversineMeters(graph.nodes.get(path[i])!, graph.nodes.get(path[i + 1])!);
  }
  return m;
}

const walkways: FeatureCollection<WalkwayFeature> = {
  type: "FeatureCollection",
  features: [...readJson("bb_4326.geojson").features, ...readJson("indoor.geojson").features],
};
const graph = buildRoutingGraph(walkways, parseElevators(readJson("ev_4326.geojson")));
const entrances = parseEntrances(readJson("e_4326.geojson"));
const from = mainEntranceForBuilding(entrances, "b-28")!;
const to = mainEntranceForBuilding(entrances, "b-0")!;
const s = nearestNode(graph, from.point)!.id;
const t = nearestNode(graph, to.point)!.id;

const route = computeRoute(graph, from.point, to.point, "ko")!;
console.log("picked:", Math.round(route.distance), "m", route.steps.filter((x) => x.maneuver === "elevator"));

for (const [, elv] of graph.elevatorByNodeId) {
  const ev = nodeKey(elv.point.lng, elv.point.lat);
  const a = dijkstra(graph, s, ev, "elevator");
  const b = dijkstra(graph, ev, t, "elevator");
  if (!a || !b) continue;
  const path = a[a.length - 1] === b[0] ? [...a, ...b.slice(1)] : [...a, ...b];
  let dist = 0;
  for (let i = 0; i < path.length - 1; i++) {
    dist += haversineMeters(graph.nodes.get(path[i])!, graph.nodes.get(path[i + 1])!);
  }
  console.log(elv.name, Math.round(dist), "m", "stairs", Math.round(stairM(graph, path)), "m");
}
