import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { haversineMeters, type LatLng } from "../lib/routing/geo";
import { buildRoutingGraph, mainEntranceForBuilding, parseEntrances } from "../lib/routing/graph";
import { parseElevators } from "../lib/routing/elevators";
import { computeRoute } from "../lib/routing/route";
import type { FeatureCollection, RouteStep, WalkwayFeature } from "../lib/routing/types";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (n: string) => JSON.parse(fs.readFileSync(path.join(root, n), "utf8"));

function arcLengthBetween(coords: LatLng[], from: LatLng, to: LatLng): number {
  let fromIdx = -1;
  let toIdx = -1;
  for (let i = 0; i < coords.length; i++) {
    if (coords[i] === from) fromIdx = i;
    if (coords[i] === to) toIdx = i;
  }
  if (fromIdx < 0 || toIdx < 0) {
    // fallback: nearest index
    const near = (p: LatLng) => {
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < coords.length; i++) {
        const d = haversineMeters(p, coords[i]);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      return bi;
    };
    fromIdx = near(from);
    toIdx = near(to);
  }
  const [a, b] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
  let sum = 0;
  for (let i = a; i < b; i++) sum += haversineMeters(coords[i], coords[i + 1]);
  return sum;
}

function sumStepDistances(steps: RouteStep[]): number {
  return steps.reduce((s, st) => s + (st.maneuver === "arrive" ? 0 : st.distance), 0);
}

const walkways: FeatureCollection<WalkwayFeature> = {
  type: "FeatureCollection",
  features: [...readJson("bb_4326.geojson").features, ...readJson("indoor.geojson").features],
};
const graph = buildRoutingGraph(walkways, parseElevators(readJson("ev_4326.geojson")));
const entrances = parseEntrances(readJson("e_4326.geojson"));
const from = mainEntranceForBuilding(entrances, "b-28")!;
const to = mainEntranceForBuilding(entrances, "b-0")!;

const route = computeRoute(graph, from.point, to.point, "ko")!;
console.log("Total route.distance:", Math.round(route.distance), "m");
console.log("Sum step.distance:", Math.round(sumStepDistances(route.steps)), "m");
console.log("Coords vertices:", route.coords.length);
console.log("");

let prevAt = route.coords[0];
for (const step of route.steps) {
  if (step.maneuver === "depart") {
    prevAt = step.at;
    continue;
  }
  const alongFull = arcLengthBetween(route.coords, prevAt, step.at);
  const diff = step.distance - alongFull;
  const flag = Math.abs(diff) > 5 ? " ⚠" : "";
  console.log(
    `${step.maneuver.padEnd(12)} step=${String(Math.round(step.distance)).padStart(3)}m  full=${String(Math.round(alongFull)).padStart(3)}m  diff=${diff.toFixed(1)}${flag}  ${step.text.slice(0, 40)}`,
  );
  prevAt = step.at;
}
