/**
 * Creates .vercel/project.json from env vars (avoids typos / BOM / wrong keys).
 *
 * PowerShell:
 *   $env:VERCEL_ORG_ID="team_xxxx"; $env:VERCEL_PROJECT_ID="prj_xxxx"; node scripts/write-vercel-project-json.mjs
 *
 * cmd.exe:
 *   set VERCEL_ORG_ID=team_xxxx&& set VERCEL_PROJECT_ID=prj_xxxx&& node scripts/write-vercel-project-json.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const orgId = String(process.env.VERCEL_ORG_ID ?? "").trim();
const projectId = String(process.env.VERCEL_PROJECT_ID ?? "").trim();

if (!orgId || !projectId) {
  console.error(
    "Set VERCEL_ORG_ID and VERCEL_PROJECT_ID (from Vercel → Project → Settings → General).\n" +
      "  orgId: Team ID (team_... or user_...)\n" +
      "  projectId: Project ID (prj_...), not the project display name.",
  );
  process.exit(1);
}

if (!/^team_|^user_/.test(orgId)) {
  console.warn("Warning: orgId usually starts with team_ or user_ — check you copied Team ID, not the team name.");
}
if (!/^prj_/.test(projectId)) {
  console.warn("Warning: projectId usually starts with prj_ — check you copied Project ID, not the project name.");
}

const dir = path.join(root, ".vercel");
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, "project.json");
const body = JSON.stringify({ orgId, projectId }, null, 2) + "\n";
fs.writeFileSync(out, body, "utf8");
console.log(`Wrote ${out}`);
