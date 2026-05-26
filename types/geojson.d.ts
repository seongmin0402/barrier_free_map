declare module "*.geojson" {
  import type { FootprintFeatureCollection } from "@/lib/campus-footprints";
  const value: FootprintFeatureCollection;
  export default value;
}
