import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const filePath = path.join(process.cwd(), "naver.geojson");
  try {
    const body = await readFile(filePath, "utf8");
    return new Response(body, {
      headers: {
        "Content-Type": "application/geo+json; charset=utf-8",
        "Cache-Control": "public, max-age=30",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "naver.geojson not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}
