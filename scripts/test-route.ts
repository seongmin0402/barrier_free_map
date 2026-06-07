import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRoutingGraph, mainEntranceForBuilding, parseEntrances } from "../lib/routing/graph";
import { parseElevators } from "../lib/routing/elevators";
import { computeRoute } from "../lib/routing/route";
import type { FeatureCollection, WalkwayFeature } from "../lib/routing/types";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (n: string) => JSON.parse(fs.readFileSync(path.join(root, n), "utf8"));

function progress(p: { lat: number; lng: number }, s: typeof p, e: typeof p) {
  const abx = e.lng - s.lng;
  const aby = e.lat - s.lat;
  const apx = p.lng - s.lng;
  const apy = p.lat - s.lat;
  const ab2 = abx * abx + aby * aby;
  return (apx * abx + apy * aby) / ab2;
}

const walkways: FeatureCollection<WalkwayFeature> = {
  type: "FeatureCollection",
  features: [...readJson("bb_4326.geojson").features, ...readJson("indoor.geojson").features],
};
const graph = buildRoutingGraph(walkways, parseElevators(readJson("ev_4326.geojson")));
const entrances = parseEntrances(readJson("e_4326.geojson"));
const from = mainEntranceForBuilding(entrances, "b-28")!;
const to = mainEntranceForBuilding(entrances, "b-0")!;

console.log("Progress along leg (0=start, 1=dest):");
for (const [, elv] of graph.elevatorByNodeId) {
  console.log(" ", elv.name, progress(elv.point, from.point, to.point).toFixed(3));
}

const route = computeRoute(graph, from.point, to.point, "ko")!;
console.log("\nPicked:", Math.round(route.distance), "m,", route.steps.length, "steps");
for (const s of route.steps) {
  console.log(" ", s.maneuver, "—", s.text);
}
