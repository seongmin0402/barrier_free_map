import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "data");

function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function mergeWalkwayCollections(...collections) {
  const features = [];
  for (const col of collections) {
    if (!col?.features?.length) continue;
    for (const f of col.features) {
      if (!f?.geometry) continue;
      features.push(f);
    }
  }
  return { type: "FeatureCollection", features };
}

function writeJson(name, data) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(data)}\n`, "utf8");
}

const outdoor = readJson("bb_4326.geojson");
const indoor = readJson("indoor.geojson");
const walkways = mergeWalkwayCollections(outdoor, indoor);
if (!walkways.features.length) {
  console.warn("[copy-routing-data] walkways: no features (bb_4326 / indoor missing?)");
} else {
  writeJson("walkways.json", walkways);
  console.log(`[copy-routing-data] walkways.json (${walkways.features.length} features)`);
}

const entrances = readJson("e_4326.geojson");
if (!entrances?.features?.length) {
  console.warn("[copy-routing-data] entrances: e_4326.geojson missing or empty");
} else {
  writeJson("entrances.json", entrances);
  console.log(`[copy-routing-data] entrances.json (${entrances.features.length} features)`);
}

const elevators = readJson("ev_4326.geojson");
if (!elevators?.features?.length) {
  console.warn("[copy-routing-data] elevators: ev_4326.geojson missing or empty");
} else {
  writeJson("elevators.json", elevators);
  console.log(`[copy-routing-data] elevators.json (${elevators.features.length} features)`);
}

const naver = readJson("naver.geojson");
if (!naver?.features?.length) {
  console.warn("[copy-routing-data] naver: naver.geojson missing or empty");
} else {
  writeJson("naver.geojson", naver);
  console.log(`[copy-routing-data] naver.geojson (${naver.features.length} features)`);
}
