import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const filePath = path.join(process.cwd(), "ev_4326.geojson");
  try {
    const body = await readFile(filePath, "utf8");
    return new Response(body, {
      headers: {
        "Content-Type": "application/geo+json; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "ev_4326.geojson not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}
