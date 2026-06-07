import { readFile } from "node:fs/promises";
import path from "node:path";
import { mergeWalkwayCollections } from "@/lib/routing/walkway-merge";
import type { FeatureCollection, WalkwayFeature } from "@/lib/routing/types";

export const runtime = "nodejs";

async function readGeoJson(fileName: string): Promise<FeatureCollection<WalkwayFeature> | null> {
  const filePath = path.join(process.cwd(), fileName);
  try {
    const body = await readFile(filePath, "utf8");
    return JSON.parse(body) as FeatureCollection<WalkwayFeature>;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const outdoor = await readGeoJson("bb_4326.geojson");
    const indoor = await readGeoJson("indoor.geojson");
    const merged = mergeWalkwayCollections(outdoor, indoor);

    if (!merged.features.length) {
      return new Response(JSON.stringify({ error: "walkway geojson not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(merged), {
      headers: {
        "Content-Type": "application/geo+json; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "failed to load walkways" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
