import type { Metadata } from "next";
import { buildRouteMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildRouteMetadata();

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
