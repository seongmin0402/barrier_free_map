import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "polygon.geojson");
const dest = path.join(root, "public", "data", "polygon.geojson");

if (!fs.existsSync(src)) {
  console.warn("[copy-polygon] polygon.geojson not found at repo root — skip");
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("[copy-polygon] copied to public/data/polygon.geojson");
