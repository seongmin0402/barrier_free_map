import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** RFC4180-style CSV records (quotes, escaped "", newlines inside fields). */
function parseCsvRecords(input) {
  let s = input;
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r") {
      continue;
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

function parseCsvObjects(text) {
  const rows = parseCsvRecords(text).filter((r) => r.some((c) => String(c).trim() !== ""));
  if (!rows.length) return [];
  const header = rows[0].map((h) => String(h).trim());
  const out = [];
  for (let ri = 1; ri < rows.length; ri++) {
    const line = rows[ri];
    const o = {};
    for (let ci = 0; ci < header.length; ci++) {
      o[header[ci]] = line[ci] ?? "";
    }
    out.push(o);
  }
  return out;
}

const projectRoot = path.join(__dirname, "..");
/** Desktop 폴더의 CSV 파일명 (바탕화면 최종캡스톤과 같은 디렉터리 기준). */
const DEFAULT_DESKTOP_CSV = path.join(projectRoot, "..", "barrier_free_data_1779802242012.csv");
/** 리포 안에 두는 경우 우선 시도. */
const REPO_DATA_CSV = path.join(projectRoot, "data", "barrier_free_data.csv");
/** 프로젝트 루트에 CSV를 두었을 때 */
const REPO_ROOT_CSV = path.join(projectRoot, "barrier_free_data_1779802242012.csv");

function csvPath() {
  if (process.env.BARRIER_FREE_CSV) return path.resolve(process.env.BARRIER_FREE_CSV);
  if (fs.existsSync(REPO_DATA_CSV)) return REPO_DATA_CSV;
  if (fs.existsSync(REPO_ROOT_CSV)) return REPO_ROOT_CSV;
  return DEFAULT_DESKTOP_CSV;
}

function truthy(raw) {
  if (typeof raw !== "string") return Boolean(raw);
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function num(raw, fallback = 0) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function deriveFacilities(r) {
  const out = [];
  if (truthy(r.elevator_available)) out.push("elevator");
  if (truthy(r.ramp_available)) out.push("ramp");
  if (truthy(r.toilet_available)) out.push("toilet");
  if (truthy(r.braille_available)) out.push("braille");
  if (truthy(r.auto_door_available)) out.push("auto-door");
  return out;
}

function deriveLevel(row) {
  let score = 0;
  if (truthy(row.wheelchair_access)) score++;
  if (truthy(row.elevator_available)) score++;
  if (truthy(row.toilet_available)) score++;
  if (truthy(row.ramp_available)) score++;
  if (truthy(row.auto_door_available)) score++;
  if (truthy(row.braille_available)) score++;
  if (score >= 5) return "A";
  if (score >= 3) return "B";
  return "C";
}

function parseFloors(jsonStr) {
  if (!jsonStr || !String(jsonStr).trim()) return [];
  try {
    const arr = JSON.parse(String(jsonStr));
    if (!Array.isArray(arr)) return [];
    return arr.map((g) => {
      const imgs = Array.isArray(g.imageFiles)
        ? g.imageFiles
        : Array.isArray(g.images)
          ? g.images
          : [];
      const images = imgs
        .map((im) => {
          if (typeof im === "string") {
            const url = im.trim();
            return url ? { url } : null;
          }
          const url = String(im.url ?? "").trim();
          if (!url) return null;
          const entry = { url };
          const on = im.originalName;
          if (on != null && String(on).trim()) entry.originalName = String(on).trim();
          return entry;
        })
        .filter(Boolean);
      return { floor: String(g.floor ?? "").trim(), images };
    });
  } catch {
    return [];
  }
}

const src = csvPath();

if (!fs.existsSync(src)) {
  console.error(
    `CSV not found: ${src}\n` +
      "Set env BARRIER_FREE_CSV 또는 data/barrier_free_data.csv 를 프로젝트에 넣어 주세요.",
  );
  process.exit(1);
}

const text = fs.readFileSync(src, "utf8");
const rows = parseCsvObjects(text);

const buildings = rows.map((r, idx) => {
  const wheelchairAccess = truthy(r.wheelchair_access);
  const elevatorAvailable = truthy(r.elevator_available);
  const brailleAvailable = truthy(r.braille_available);
  const toiletAvailable = truthy(r.toilet_available);
  const autoDoorAvailable = truthy(r.auto_door_available);
  const thresholdPresent = truthy(r.threshold_present);
  const rampAvailable = truthy(r.ramp_available);
  const row = {
    ...r,
    wheelchair_access: wheelchairAccess,
    elevator_available: elevatorAvailable,
    braille_available: brailleAvailable,
    toilet_available: toiletAvailable,
    auto_door_available: autoDoorAvailable,
    threshold_present: thresholdPresent,
    ramp_available: rampAvailable,
  };
  return {
    id: `b-${idx}`,
    name: String(r.building_name ?? "").trim(),
    lat: num(r.lat, NaN),
    lng: num(r.lng, NaN),
    floorLabel: String(r.floor ?? "").trim(),
    wheelchairAccess,
    elevatorAvailable,
    brailleAvailable,
    toiletAvailable,
    autoDoorAvailable,
    thresholdPresent,
    rampAvailable,
    parkingCapacity: num(r.parking_capacity, 0),
    parkingDistanceEntranceM: num(r.parking_distance_entrance_m, 0),
    description: String(r.description ?? "").trim(),
    floorPhotoSummary: String(r.floorPhotoSummary ?? "").trim(),
    floorPhotoImageNames: String(r.floorPhotoImageNames ?? "").trim(),
    floorPhotoGroups: parseFloors(r.floorPhotoGroupsJson),
    facilities: deriveFacilities(row),
    accessibilityLevel: deriveLevel(row),
  };
});

const outDir = path.join(projectRoot, "public", "data");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "buildings.json");
fs.writeFileSync(outPath, JSON.stringify(buildings), "utf8");

console.log(`Wrote ${buildings.length} buildings from ${path.basename(src)} → public/data/buildings.json`);
