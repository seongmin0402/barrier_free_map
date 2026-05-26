import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const revalidate = 3600;

const CANDIDATE_PATHS = [
  path.join(process.cwd(), "public", "data", "polygon.geojson"),
  path.join(process.cwd(), "polygon.geojson"),
];

export async function GET() {
  for (const filePath of CANDIDATE_PATHS) {
    try {
      const body = await readFile(filePath, "utf8");
      return new NextResponse(body, {
        headers: {
          "Content-Type": "application/geo+json; charset=utf-8",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      });
    } catch {
      /* try next */
    }
  }
  return NextResponse.json({ error: "polygon.geojson not found" }, { status: 404 });
}
