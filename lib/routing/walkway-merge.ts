import type { FeatureCollection, WalkwayFeature } from "./types";

/** outdoor(bb) + indoor GeoJSON FeatureCollection 병합 */
export function mergeWalkwayCollections(
  ...collections: Array<FeatureCollection<WalkwayFeature> | null | undefined>
): FeatureCollection<WalkwayFeature> {
  const features: WalkwayFeature[] = [];
  for (const col of collections) {
    if (!col?.features?.length) continue;
    for (const f of col.features) {
      if (!f?.geometry) continue;
      features.push(f);
    }
  }
  return { type: "FeatureCollection", features };
}
