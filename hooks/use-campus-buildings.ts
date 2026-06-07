"use client";

import { useEffect, useState } from "react";
import type { FootprintFeatureCollection } from "@/lib/campus-footprints";
import type { BarrierBuilding } from "@/lib/building-types";
import { mergeCampusBuildings } from "@/lib/merge-campus-buildings";

export function useCampusBuildings(loadErrorMessage: string) {
  const [buildings, setBuildings] = useState<BarrierBuilding[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/data/buildings.json").then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<BarrierBuilding[]>;
      }),
      fetch("/api/naver-geojson")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null) as Promise<FootprintFeatureCollection | null>,
    ])
      .then(([surveyed, footprints]) => {
        if (cancelled) return;
        const list = mergeCampusBuildings(Array.isArray(surveyed) ? surveyed : [], footprints);
        setBuildings(list);
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setBuildings([]);
          setLoadError(loadErrorMessage);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadErrorMessage]);

  return { buildings, loadError };
}
