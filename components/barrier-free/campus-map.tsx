"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import Script from "next/script";
import { Plus, Minus, Locate, Maximize2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { BarrierBuilding } from "@/lib/building-types";
import type { LatLng } from "@/lib/routing/geo";
import { segmentColor } from "@/lib/routing/style";
import { useUi } from "@/hooks/use-ui";
import {
  footprintPolygonPathGroups,
  footprintStrokeOptions,
  FOOTPRINT_LEVEL_STROKE,
  FOOTPRINT_STROKE_UNKNOWN,
  type FootprintAccessibilityLevel,
  type FootprintFeature,
  type FootprintFeatureCollection,
} from "@/lib/campus-footprints";
interface CampusMapProps {
  buildings: BarrierBuilding[];
  selectedBuilding: string | null;
  onBuildingSelect: (id: string) => void;
  showFacilityPins?: boolean;
  /** true(기본): GeoJSON 전체 폴리곤 표시 · false: buildings 목록(필터 결과)에 있는 건물만 표시 */
  showAllFootprints?: boolean;
  /** 길찾기 경로 좌표열 */
  routeLine?: LatLng[] | null;
  /** 경로 각 구간 종류 (routeLine 길이 - 1), 종류별 색상 표시용 */
  routeSegments?: string[] | null;
  originPoint?: LatLng | null;
  destPoint?: LatLng | null;
  /** 실시간 GPS 위치 (네비게이션 중) */
  liveUserPosition?: LatLng | null;
  /** 지도에서 출발/도착 지점 선택 모드 */
  pickMode?: "origin" | "destination" | null;
  onMapPick?: (point: LatLng) => void;
  /** 네비게이션 중 사용자 위치로 지도 추적 */
  followUser?: boolean;
}

function deriveCenter(items: BarrierBuilding[]) {
  const valid = items.filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng));
  if (!valid.length) return { lat: 36.469, lng: 127.14 };
  return {
    lat: valid.reduce((s, b) => s + b.lat, 0) / valid.length,
    lng: valid.reduce((s, b) => s + b.lng, 0) / valid.length,
  };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type NMaps = NonNullable<Window["naver"]>["maps"];

type FootprintPolyEntry = {
  poly: { setMap: (target: unknown) => void; setOptions?: (opts: Record<string, unknown>) => void };
  buildingId: string | null;
  level: FootprintAccessibilityLevel | null;
};

function normalizeFootprintBuildingId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const id = String(raw).trim();
  return id.length > 0 ? id : null;
}

function footprintLevelForFeature(
  feature: FootprintFeature,
  buildingsById: Map<string, BarrierBuilding>,
): FootprintAccessibilityLevel | null {
  const buildingId = normalizeFootprintBuildingId(feature.properties?.id);
  if (!buildingId) return null;
  const building = buildingsById.get(buildingId);
  if (!building) return null;
  const level = building.accessibilityLevel;
  if (level === "A" || level === "B" || level === "C") return level;
  return null;
}

const MAP_TYPE_IDS = ["NORMAL", "TERRAIN", "SATELLITE", "HYBRID"] as const;

type MapTypeOptionId = (typeof MAP_TYPE_IDS)[number];

const MANUAL_BUILDING_LABELS = [
  {
    id: "manual-global-dorm",
    name: "글로벌우정연수관",
    lat: 36.4716541,
    lng: 127.1402118,
  },
  {
    id: "manual-future-history",
    name: "미래융합역사문화관",
    lat: 36.4704144,
    lng: 127.1409296,
  },
] as const;
const MANUAL_LABEL_LAT_OFFSET = -0.00003;
const MANUAL_LABEL_LNG_OFFSET = -0.00003;

function labelMarkerHtml(name: string) {
  const safeName = escapeHtml(name);
  return `<div aria-hidden="true" style="max-width:260px;padding:0;background:transparent;border:0;box-shadow:none;font-size:12px;line-height:1.25;font-weight:600;color:#2f5ea8;letter-spacing:-0.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:-1px -1px 0 rgba(255,255,255,.95),1px -1px 0 rgba(255,255,255,.95),-1px 1px 0 rgba(255,255,255,.95),1px 1px 0 rgba(255,255,255,.95),0 0 2px rgba(255,255,255,.95);">${safeName}</div>`;
}

function facilityPinHtml() {
  return `<div aria-hidden="true" style="position:relative;width:22px;height:30px;display:flex;align-items:flex-end;justify-content:center;">
    <svg width="22" height="30" viewBox="0 0 22 30" xmlns="http://www.w3.org/2000/svg">
      <path fill="#2563eb" stroke="#ffffff" stroke-width="1.8" d="M11 1.8C6.07 1.8 2.1 5.66 2.1 10.31c0 5.58 8.21 16.89 8.58 17.49.36-.6 9.22-11.91 9.22-17.49C19.9 5.66 15.93 1.8 11 1.8z"/>
      <circle cx="11" cy="10.1" r="3.2" fill="#ffffff"/>
    </svg>
  </div>`;
}

function fitToBuildings(
  maps: NMaps,
  map: unknown,
  list: BarrierBuilding[],
) {
  const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;
  /** 단일-arg 생성자 또는 (sw,ne) 둘 다 시도 */
  const BoundsCtor = maps.LatLngBounds as unknown as new (a?: unknown, b?: unknown) => {
    extend(ll: unknown): void;
  };
  const pts = list.filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng));
  const m = map as {
    setCenter?: (c: unknown) => void;
    setZoom?: (z: number) => void;
    fitBounds?: (b: unknown, o?: Record<string, unknown>) => void;
    getZoom?: () => number;
  };
  if (!pts.length || !m) return;

  if (pts.length === 1) {
    const p = pts[0];
    m.setCenter?.(new LatLngCtor(p.lat, p.lng));
    m.setZoom?.(17);
    return;
  }

  try {
    const bounds = new BoundsCtor();
    for (const p of pts) bounds.extend(new LatLngCtor(p.lat, p.lng));
    m.fitBounds?.(bounds, { padding: 60, maxZoom: 18 });
  } catch {
    const first = pts[0];
    const Bounds2 = maps.LatLngBounds as unknown as new (sw: unknown, ne: unknown) => { extend(ll: unknown): void };
    const bounds = new Bounds2(new LatLngCtor(first.lat, first.lng), new LatLngCtor(first.lat, first.lng));
    for (let i = 1; i < pts.length; i++) {
      bounds.extend(new LatLngCtor(pts[i].lat, pts[i].lng));
    }
    m.fitBounds?.(bounds, { padding: 60, maxZoom: 18 });
  }
}

function markerPinHtml(color: string, label: string) {
  const safe = escapeHtml(label);
  return `<div aria-hidden="true" style="position:relative;width:26px;height:34px;display:flex;align-items:flex-end;justify-content:center;">
    <svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path fill="${color}" stroke="#ffffff" stroke-width="2" d="M13 2C7.2 2 2.5 6.6 2.5 12.2c0 6.7 9.7 19.3 10.1 19.9.4-.6 10.9-13.2 10.9-19.9C23.5 6.6 18.8 2 13 2z"/>
      <text x="13" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff" font-family="sans-serif">${safe}</text>
    </svg>
  </div>`;
}

function navArrowHtml() {
  return `<div aria-hidden="true" style="width:24px;height:24px;transform:translate(-50%,-50%);">
    <div style="width:18px;height:18px;margin:3px;border-radius:50%;background:#2563eb;border:3px solid #ffffff;box-shadow:0 0 0 2px rgba(37,99,235,.35),0 1px 3px rgba(0,0,0,.4);"></div>
  </div>`;
}

export function CampusMap({
  buildings,
  selectedBuilding,
  onBuildingSelect,
  showFacilityPins = false,
  showAllFootprints = true,
  routeLine = null,
  routeSegments = null,
  originPoint = null,
  destPoint = null,
  liveUserPosition = null,
  pickMode = null,
  onMapPick,
  followUser = false,
}: CampusMapProps) {
  const ui = useUi();
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const routePolylineRef = useRef<Array<{ setMap: (t: unknown) => void }>>([]);
  const routeMarkersRef = useRef<Array<{ setMap: (t: unknown) => void }>>([]);
  const navUserMarkerRef = useRef<{ setMap: (t: unknown) => void; setPosition?: (p: unknown) => void } | null>(null);
  const pickListenerRef = useRef<unknown>(null);
  const onMapPickRef = useRef(onMapPick);
  onMapPickRef.current = onMapPick;
  const manualLabelMarkersRef = useRef<Array<{ setMap: (target: unknown) => void }>>([]);
  const facilityPinMarkersRef = useRef<Array<{ setMap: (target: unknown) => void }>>([]);
  const footprintPolygonsRef = useRef<FootprintPolyEntry[]>([]);
  const [footprintCollection, setFootprintCollection] = useState<FootprintFeatureCollection | null>(null);
  const [mapReadyEpoch, setMapReadyEpoch] = useState(0);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const onBuildingSelectRef = useRef(onBuildingSelect);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const myLocationMarkerRef = useRef<{ setMap: (v: unknown) => void; setPosition?: (p: unknown) => void } | null>(null);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [gradeGuideOpen, setGradeGuideOpen] = useState(false);
  const [geoHintMessage, setGeoHintMessage] = useState<string | null>(null);
  const [locationTracking, setLocationTracking] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [mapTypeKey, setMapTypeKey] = useState<MapTypeOptionId>("NORMAL");
  const [controlsOpen, setControlsOpen] = useState(false);

  selectedIdRef.current = selectedBuilding;
  onBuildingSelectRef.current = onBuildingSelect;

  const centerMemo = useMemo(() => deriveCenter(buildings), [buildings]);

  /**
   * 클라이언트 라우팅(예: / → /route)으로 진입하면 네이버 SDK가 이미 로드돼 있어
   * <Script>의 onLoad가 다시 호출되지 않는다. 마운트 시 직접 확인하고,
   * 로딩 중이면 잠깐 폴링해 바로 지도가 뜨도록 한다.
   */
  useEffect(() => {
    if (sdkLoaded) return;
    const ready = () =>
      Boolean((window.naver?.maps as NMaps | undefined)?.Map && window.naver?.maps?.LatLng);
    if (ready()) {
      setSdkLoaded(true);
      return;
    }
    const timer = window.setInterval(() => {
      if (ready()) {
        setScriptError(false);
        setSdkLoaded(true);
        window.clearInterval(timer);
      }
    }, 150);
    const stop = window.setTimeout(() => window.clearInterval(timer), 10000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [sdkLoaded]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/naver-geojson")
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<FootprintFeatureCollection>;
      })
      .then((data) => {
        if (!cancelled && data?.type === "FeatureCollection" && Array.isArray(data.features)) {
          setFootprintCollection(data);
        }
      })
      .catch(() => {
        if (!cancelled) setFootprintCollection(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const teardown = useCallback(() => {
    setLocationTracking(false);

    try {
      myLocationMarkerRef.current?.setMap(null);
    } catch {
      /* ignore */
    }
    myLocationMarkerRef.current = null;

    try {
      resizeObsRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    resizeObsRef.current = null;

    manualLabelMarkersRef.current.forEach((marker) => {
      try {
        marker.setMap(null);
      } catch {
        /* ignore */
      }
    });
    manualLabelMarkersRef.current = [];
    facilityPinMarkersRef.current.forEach((marker) => {
      try {
        marker.setMap(null);
      } catch {
        /* ignore */
      }
    });
    facilityPinMarkersRef.current = [];

    footprintPolygonsRef.current.forEach(({ poly }) => {
      try {
        poly.setMap(null);
      } catch {
        /* ignore */
      }
    });
    footprintPolygonsRef.current = [];

    routePolylineRef.current.forEach((p) => {
      try {
        p.setMap(null);
      } catch {
        /* ignore */
      }
    });
    routePolylineRef.current = [];
    routeMarkersRef.current.forEach((m) => {
      try {
        m.setMap(null);
      } catch {
        /* ignore */
      }
    });
    routeMarkersRef.current = [];
    try {
      navUserMarkerRef.current?.setMap(null);
    } catch {
      /* ignore */
    }
    navUserMarkerRef.current = null;

    try {
      (mapInstanceRef.current as null | { destroy?: () => void })?.destroy?.();
    } catch {
      /* ignore */
    }
    mapInstanceRef.current = null;

    const el = containerRef.current;
    if (el) el.innerHTML = "";
  }, []);

  useEffect(() => {
    if (!sdkLoaded || !clientId || !containerRef.current) return;

    const maps = window.naver?.maps as NMaps | undefined;
    if (!maps?.Map || !maps.LatLng || !maps.Marker || !maps.Event?.addListener || !maps.Point) return;

    teardown();

    const el = containerRef.current;
    const MapCtor = maps.Map as unknown as new (node: HTMLElement, opts?: Record<string, unknown>) => {
      destroy: () => void;
      setZoom: (z: number) => void;
      getZoom: () => number;
      panTo: (ll: unknown, opts?: unknown) => void;
      fitBounds: (bounds: unknown, opts?: unknown) => void;
    };

    const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;

    const map = new MapCtor(el, {
      center: new LatLngCtor(centerMemo.lat, centerMemo.lng),
      zoom: 16,
      zoomControl: false,
      mapDataControl: false,
      scaleControl: false,
    });

    mapInstanceRef.current = map;
    setMapReadyEpoch((n) => n + 1);
    setMapTypeKey("NORMAL");

    const EventTrigger = maps.Event as unknown as { trigger?: (target: unknown, evt: string) => void };

    const relayoutMap = () => {
      try {
        (map as { relayout?: () => void }).relayout?.();
      } catch {
        /* ignore */
      }
      try {
        EventTrigger.trigger?.(map, "resize");
      } catch {
        /* ignore */
      }
    };

    const scheduleRelayout = () => {
      relayoutMap();
      requestAnimationFrame(() => {
        relayoutMap();
        requestAnimationFrame(relayoutMap);
      });
    };
    scheduleRelayout();

    maps.Event.addListener(map, "idle", () => {
      relayoutMap();
    });

    const MarkerCtor = maps.Marker as unknown as new (opts: Record<string, unknown>) => {
      setMap: (target: typeof map | null) => void;
    };

    const PointCtor = maps.Point as new (x: number, y: number) => unknown;
    const MANUAL_LABEL_MIN_ZOOM = 17;

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        relayoutMap();
      });
      ro.observe(el);
      resizeObsRef.current = ro;
    }

    const syncManualLabelVisibility = () => {
      const zoom = (map as { getZoom?: () => number }).getZoom?.() ?? 16;
      const shouldShow = zoom >= MANUAL_LABEL_MIN_ZOOM;
      for (const marker of manualLabelMarkersRef.current) {
        try {
          marker.setMap(shouldShow ? map : null);
        } catch {
          /* ignore */
        }
      }
    };

    for (const label of MANUAL_BUILDING_LABELS) {
      const marker = new MarkerCtor({
        map: null,
        position: new LatLngCtor(
          label.lat + MANUAL_LABEL_LAT_OFFSET,
          label.lng + MANUAL_LABEL_LNG_OFFSET,
        ),
        title: label.name,
        zIndex: 1200,
        icon: {
          content: labelMarkerHtml(label.name),
          anchor: new PointCtor(14, -2),
        },
      });
      manualLabelMarkersRef.current.push(marker);
    }
    syncManualLabelVisibility();
    maps.Event.addListener(map, "zoom_changed", syncManualLabelVisibility);

    if (showFacilityPins) {
      for (const building of buildings) {
        if (!Number.isFinite(building.lat) || !Number.isFinite(building.lng)) continue;
        const marker = new MarkerCtor({
          map,
          position: new LatLngCtor(building.lat, building.lng),
          title: ui.map.facilityFilterMatch(building.name),
          zIndex: 1600,
          icon: {
            content: facilityPinHtml(),
            anchor: new PointCtor(11, 30),
          },
        });
        facilityPinMarkersRef.current.push(marker);
        maps.Event.addListener(marker, "click", () => {
          onBuildingSelectRef.current(building.id);
        });
      }
    }

    fitToBuildings(maps as NMaps, map, buildings);

    requestAnimationFrame(() => {
      relayoutMap();
    });

    const initiallySelected = selectedIdRef.current;
    if (initiallySelected) {
      const target = buildings.find((x) => x.id === initiallySelected);
      if (target && Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
        const LlCtor = maps.LatLng as new (a: number, b: number) => unknown;
        const m = map as { panTo?: (ll: unknown, opts?: unknown) => void; setZoom?: (z: number) => void };
        m.panTo?.(new LlCtor(target.lat, target.lng), { duration: 0 });
        m.setZoom?.(17);
      }
    }

    return () => {
      teardown();
    };
    // onBuildingSelect 은 ref(onBuildingSelectRef)로 읽으므로 의존성에서 제외한다.
    // (의존성에 넣으면 매 렌더마다 지도가 재초기화되어 살짝 확대/재맞춤되는 현상 발생)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkLoaded, clientId, centerMemo.lat, centerMemo.lng, buildings, teardown, showFacilityPins]);

  useEffect(() => {
    if (!sdkLoaded || !footprintCollection?.features.length) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    const maps = window.naver?.maps as NMaps | undefined;
    const PolygonCtor = maps?.Polygon as
      | (new (opts: Record<string, unknown>) => {
          setMap: (target: unknown) => void;
          setOptions?: (opts: Record<string, unknown>) => void;
        })
      | undefined;
    const LatLngCtor = maps?.LatLng as new (lat: number, lng: number) => unknown | undefined;
    if (!PolygonCtor || !LatLngCtor || !maps?.Event?.addListener) return;

    footprintPolygonsRef.current.forEach(({ poly }) => {
      try {
        poly.setMap(null);
      } catch {
        /* ignore */
      }
    });
    footprintPolygonsRef.current = [];

    const buildingMap = new Map(buildings.map((b) => [b.id, b]));

    for (const feature of footprintCollection.features) {
      const buildingId = normalizeFootprintBuildingId(feature.properties?.id);
      const building = buildingId ? buildingMap.get(buildingId) : undefined;

      if (!showAllFootprints && !building) continue;

      const level = footprintLevelForFeature(feature, buildingMap);
      const isSelected = buildingId != null && buildingId === selectedIdRef.current;
      const stroke = footprintStrokeOptions(level, isSelected);
      const groups = footprintPolygonPathGroups(feature.geometry, LatLngCtor);

      for (const paths of groups) {
        const poly = new PolygonCtor({
          map,
          paths,
          ...stroke,
        });

        footprintPolygonsRef.current.push({ poly, buildingId, level });

        maps.Event.addListener(poly, "click", () => {
          if (building) {
            onBuildingSelectRef.current(building.id);
            return;
          }
          const label = feature.properties?.building_n?.trim() || ui.map.buildingFallback;
          setGeoHintMessage(ui.map.noBarrierInfo(label));
        });
      }
    }

    return () => {
      footprintPolygonsRef.current.forEach(({ poly }) => {
        try {
          poly.setMap(null);
        } catch {
          /* ignore */
        }
      });
      footprintPolygonsRef.current = [];
    };
  }, [sdkLoaded, footprintCollection, mapReadyEpoch, buildings, showAllFootprints, ui]);

  /** 선택 변경 시 폴리곤 테두리만 갱신 */
  useEffect(() => {
    if (!sdkLoaded || footprintPolygonsRef.current.length === 0) return;
    for (const entry of footprintPolygonsRef.current) {
      const isSelected = entry.buildingId != null && entry.buildingId === selectedBuilding;
      try {
        entry.poly.setOptions?.(footprintStrokeOptions(entry.level, isSelected));
      } catch {
        /* ignore */
      }
    }
  }, [selectedBuilding, sdkLoaded]);

  useEffect(() => {
    if (!selectedBuilding) return;

    const b = buildings.find((x) => x.id === selectedBuilding);
    if (!b || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return;

    const map = mapInstanceRef.current as undefined | {
      panTo?: (ll: unknown, opts?: unknown) => void;
      setCenter?: (ll: unknown) => void;
      setZoom?: (z: number) => void;
      relayout?: () => void;
    };
    if (!map?.panTo && !map?.setCenter) return;

    const maps = window.naver?.maps as NMaps | undefined;
    if (!maps?.LatLng) return;
    const Ll = maps.LatLng as new (a: number, c: number) => unknown;

    const target = new Ll(b.lat, b.lng);
    map.setCenter?.(target);
    map.panTo?.(target, { duration: 280 });
    map.setZoom?.(17);
    requestAnimationFrame(() => {
      try {
        map.relayout?.();
      } catch {
        /* ignore */
      }
    });
  }, [selectedBuilding, buildings]);

  /** 길찾기 경로 폴리라인 + 출발/도착 마커 */
  useEffect(() => {
    if (!sdkLoaded) return;
    const map = mapInstanceRef.current;
    const maps = window.naver?.maps as NMaps | undefined;
    if (!map || !maps?.LatLng) return;

    const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;
    const PolylineCtor = maps.Polyline as
      | (new (opts: Record<string, unknown>) => { setMap: (t: unknown) => void })
      | undefined;
    const MarkerCtor = maps.Marker as
      | (new (opts: Record<string, unknown>) => { setMap: (t: unknown) => void })
      | undefined;
    const PointCtor = maps.Point as (new (x: number, y: number) => unknown) | undefined;

    // 기존 경로/마커 제거
    routePolylineRef.current.forEach((p) => {
      try {
        p.setMap(null);
      } catch {
        /* ignore */
      }
    });
    routePolylineRef.current = [];
    routeMarkersRef.current.forEach((m) => {
      try {
        m.setMap(null);
      } catch {
        /* ignore */
      }
    });
    routeMarkersRef.current = [];

    if (routeLine && routeLine.length >= 2 && PolylineCtor) {
      const path = routeLine.map((p) => new LatLngCtor(p.lat, p.lng));
      // 흰색 외곽선 (가독성)
      const outline = new PolylineCtor({
        map,
        path,
        strokeColor: "#ffffff",
        strokeOpacity: 0.9,
        strokeWeight: 11,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        zIndex: 300,
      });
      routePolylineRef.current.push(outline);

      // 구간 종류별 색상으로 본선을 나눠 그림 (횡단보도/계단/경사로 구분)
      const colorAt = (i: number) => segmentColor(routeSegments?.[i] ?? "path");
      let start = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const isLast = i === path.length - 2;
        const colorChanges = !isLast && colorAt(i + 1) !== colorAt(i);
        if (isLast || colorChanges) {
          const groupPath = path.slice(start, i + 2);
          const seg = new PolylineCtor({
            map,
            path: groupPath,
            strokeColor: colorAt(start),
            strokeOpacity: 0.95,
            strokeWeight: 6,
            strokeLineCap: "round",
            strokeLineJoin: "round",
            zIndex: 301,
          });
          routePolylineRef.current.push(seg);
          start = i + 1;
        }
      }
    }

    if (MarkerCtor && PointCtor) {
      if (originPoint) {
        const m = new MarkerCtor({
          map,
          position: new LatLngCtor(originPoint.lat, originPoint.lng),
          zIndex: 400,
          icon: { content: markerPinHtml("#16a34a", ui.map.originMarker), anchor: new PointCtor(13, 33) },
        });
        routeMarkersRef.current.push(m);
      }
      if (destPoint) {
        const m = new MarkerCtor({
          map,
          position: new LatLngCtor(destPoint.lat, destPoint.lng),
          zIndex: 400,
          icon: { content: markerPinHtml("#dc2626", ui.map.destMarker), anchor: new PointCtor(13, 33) },
        });
        routeMarkersRef.current.push(m);
      }
    }

    return () => {
      routePolylineRef.current.forEach((p) => {
        try {
          p.setMap(null);
        } catch {
          /* ignore */
        }
      });
      routePolylineRef.current = [];
      routeMarkersRef.current.forEach((m) => {
        try {
          m.setMap(null);
        } catch {
          /* ignore */
        }
      });
      routeMarkersRef.current = [];
    };
  }, [sdkLoaded, mapReadyEpoch, routeLine, routeSegments, originPoint, destPoint, ui]);

  /** 경로가 생기면 줌은 그대로 두고 경로 중심으로만 이동 (확대하지 않음) */
  useEffect(() => {
    if (!sdkLoaded || followUser) return;
    if (!routeLine || routeLine.length < 2) return;
    const maps = window.naver?.maps as NMaps | undefined;
    const map = mapInstanceRef.current as undefined | {
      panTo?: (ll: unknown, o?: unknown) => void;
      setCenter?: (ll: unknown) => void;
    };
    if (!maps?.LatLng || !map) return;
    const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;
    try {
      // 경로 좌표의 중심점을 계산 (줌 변경 없이 이 지점으로만 살짝 이동)
      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;
      for (const p of routeLine) {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      }
      const center = new LatLngCtor((minLat + maxLat) / 2, (minLng + maxLng) / 2);
      if (map.panTo) map.panTo(center, { duration: 300 });
      else map.setCenter?.(center);
    } catch {
      /* ignore */
    }
  }, [sdkLoaded, mapReadyEpoch, routeLine, followUser]);

  /** 실시간 GPS 위치 마커 + 추적 이동 */
  useEffect(() => {
    if (!sdkLoaded) return;
    const map = mapInstanceRef.current;
    const maps = window.naver?.maps as NMaps | undefined;
    if (!map || !maps?.LatLng) return;
    const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;
    const MarkerCtor = maps.Marker as
      | (new (opts: Record<string, unknown>) => {
          setMap: (t: unknown) => void;
          setPosition?: (p: unknown) => void;
        })
      | undefined;
    const PointCtor = maps.Point as (new (x: number, y: number) => unknown) | undefined;

    if (!liveUserPosition) {
      try {
        navUserMarkerRef.current?.setMap(null);
      } catch {
        /* ignore */
      }
      navUserMarkerRef.current = null;
      return;
    }

    const pos = new LatLngCtor(liveUserPosition.lat, liveUserPosition.lng);
    if (navUserMarkerRef.current?.setPosition) {
      navUserMarkerRef.current.setPosition(pos);
    } else if (MarkerCtor && PointCtor) {
      navUserMarkerRef.current = new MarkerCtor({
        map,
        position: pos,
        zIndex: 500,
        icon: { content: navArrowHtml(), anchor: new PointCtor(12, 12) },
      }) as { setMap: (t: unknown) => void; setPosition?: (p: unknown) => void };
    }

    if (followUser) {
      const m = map as { panTo?: (ll: unknown, o?: unknown) => void; setCenter?: (ll: unknown) => void };
      m.panTo?.(pos, { duration: 500 });
    }
  }, [sdkLoaded, mapReadyEpoch, liveUserPosition, followUser]);

  /** 지도에서 출발/도착 지점 선택 */
  useEffect(() => {
    if (!sdkLoaded) return;
    const map = mapInstanceRef.current;
    const maps = window.naver?.maps as NMaps | undefined;
    if (!map || !maps?.Event?.addListener) return;

    if (pickListenerRef.current && (maps.Event as { removeListener?: (l: unknown) => void }).removeListener) {
      (maps.Event as { removeListener?: (l: unknown) => void }).removeListener?.(pickListenerRef.current);
      pickListenerRef.current = null;
    }

    if (!pickMode) return;

    const listener = maps.Event.addListener(map, "click", (e: unknown) => {
      const coord = (e as { coord?: { lat: () => number; lng: () => number } })?.coord;
      if (!coord) return;
      onMapPickRef.current?.({ lat: coord.lat(), lng: coord.lng() });
    });
    pickListenerRef.current = listener;

    return () => {
      if (pickListenerRef.current && (maps.Event as { removeListener?: (l: unknown) => void }).removeListener) {
        (maps.Event as { removeListener?: (l: unknown) => void }).removeListener?.(pickListenerRef.current);
        pickListenerRef.current = null;
      }
    };
  }, [sdkLoaded, mapReadyEpoch, pickMode]);

  const zoomDelta = useCallback((delta: number) => {
    const map = mapInstanceRef.current as undefined | { getZoom: () => number; setZoom: (z: number) => void };
    if (!map?.getZoom || !map?.setZoom) return;
    const next = Math.min(19, Math.max(13, map.getZoom() + delta));
    map.setZoom(next);
  }, []);

  const showCampusOverview = useCallback(() => {
    const maps = window.naver?.maps as NMaps | undefined;
    if (!maps || !mapInstanceRef.current) return;
    fitToBuildings(maps as NMaps, mapInstanceRef.current, buildings);
  }, [buildings]);

  const applyMapType = useCallback((key: MapTypeOptionId) => {
    const mapsApi = window.naver?.maps as (NMaps & { MapTypeId?: Record<string, unknown> }) | undefined;
    const map = mapInstanceRef.current as {
      getMapTypeId?: () => unknown;
      setMapTypeId?: (mapTypeId: unknown) => void;
    } | null;
    if (!mapsApi?.MapTypeId || !map?.setMapTypeId) return;
    const nextType = mapsApi.MapTypeId[key];
    if (nextType === undefined) return;
    try {
      if (map.getMapTypeId?.() === nextType) return;
      map.setMapTypeId(nextType);
      setMapTypeKey(key);
      requestAnimationFrame(() => {
        try {
          (map as { relayout?: () => void }).relayout?.();
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
    }
  }, []);

  const mapTypeButtons = useMemo(() => {
    const all = MAP_TYPE_IDS.map((id) => ({ id, label: ui.map.mapTypes[id] }));
    if (typeof window === "undefined") return all;
    const m = window.naver?.maps as { MapTypeId?: Record<string, unknown> } | undefined;
    if (!m?.MapTypeId) return all;
    return all.filter((opt) => m.MapTypeId![opt.id] !== undefined);
  }, [sdkLoaded, ui]);

  useEffect(() => {
    if (!geoHintMessage) return;
    const t = window.setTimeout(() => setGeoHintMessage(null), 8000);
    return () => window.clearTimeout(t);
  }, [geoHintMessage]);

  useEffect(() => {
    return () => {
      try {
        myLocationMarkerRef.current?.setMap(null);
      } catch {
        /* ignore */
      }
      myLocationMarkerRef.current = null;
    };
  }, []);

  const beginLocationTracking = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoHintMessage(ui.map.geoUnsupported);
      return;
    }
    const maps = window.naver?.maps as NMaps | undefined;
    const map = mapInstanceRef.current;
    if (!maps?.LatLng || !maps?.Marker || !maps?.Point || !map) {
      setGeoHintMessage(ui.map.mapNotReady);
      return;
    }

    const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;
    const PointCtor = maps.Point as new (x: number, y: number) => unknown;
    const MarkerCtor = maps.Marker as unknown as new (opts: Record<string, unknown>) => {
      setMap: (t: unknown) => void;
      setPosition?: (p: unknown) => void;
    };

    const myIconHtml =
      '<div aria-hidden="true" style="width:22px;height:22px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.35);"></div>';

    const applyCoords = (lat: number, lng: number) => {
      const ll = new LatLngCtor(lat, lng);
      const existing = myLocationMarkerRef.current;
      if (existing?.setPosition) {
        try {
          existing.setPosition(ll);
        } catch {
          try {
            existing.setMap(null);
          } catch {
            /* ignore */
          }
          myLocationMarkerRef.current = null;
        }
      }
      if (!myLocationMarkerRef.current) {
        const m = new MarkerCtor({
          map,
          position: ll,
          title: ui.map.myLocationTitle,
          zIndex: 5000,
          icon: {
            content: myIconHtml,
            anchor: new PointCtor(11, 11),
          },
        });
        myLocationMarkerRef.current = m;
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoHintMessage(null);
        setLocationTracking(true);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        applyCoords(lat, lng);

        const ll = new LatLngCtor(lat, lng);
        const mp = map as {
          setCenter?: (target: unknown) => void;
          panTo?: (target: unknown, options?: unknown) => void;
          setZoom?: (z: number) => void;
          relayout?: () => void;
        };
        mp.setCenter?.(ll);
        mp.panTo?.(ll, { duration: 320 });
        mp.setZoom?.(17);
        requestAnimationFrame(() => {
          try {
            mp.relayout?.();
          } catch {
            /* ignore */
          }
        });
      },
      (err) => {
        setLocationTracking(false);
        let msg = ui.map.geoFailed;
        if (err.code === 1) msg = ui.map.geoDenied;
        else if (err.code === 2) msg = ui.map.geoUnavailable;
        else if (err.code === 3) msg = ui.map.geoTimeout;
        setGeoHintMessage(msg);
        try {
          myLocationMarkerRef.current?.setMap(null);
        } catch {
          /* ignore */
        }
        myLocationMarkerRef.current = null;
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }, [ui]);

  const stopLocationTracking = useCallback(() => {
    setLocationTracking(false);
    try {
      myLocationMarkerRef.current?.setMap(null);
    } catch {
      /* ignore */
    }
    myLocationMarkerRef.current = null;
  }, []);

  if (!clientId) {
    return (
      <div className="relative flex flex-1 items-center justify-center bg-muted/40 p-8 text-center">
        <div className="max-w-md space-y-2 rounded-lg border border-border bg-card p-6 shadow-sm">
          <p className="font-semibold text-foreground">{ui.map.clientIdRequired}</p>
          <p className="text-sm text-muted-foreground">{ui.map.clientIdHint}</p>
        </div>
      </div>
    );
  }

  const scriptSrc = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
      <Script
        id="naver-maps-sdk"
        strategy="afterInteractive"
        src={scriptSrc}
        onLoad={() => {
          setScriptError(false);
          setSdkLoaded(true);
        }}
        onError={() => setScriptError(true)}
      />

      {!sdkLoaded && !scriptError && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-muted/50 text-sm text-muted-foreground">
          {ui.map.loading}
        </div>
      )}

      {scriptError && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-muted/60 p-6 text-center">
          <div className="max-w-md rounded-lg border border-border bg-card p-4 text-sm text-foreground shadow-sm">
            <p className="font-medium">{ui.map.scriptError}</p>
            <p className="mt-2 text-muted-foreground">{ui.map.scriptErrorHint}</p>
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {/* 네이버 지도: 부모 높이가 잡힌 뒤 relayout으로 타일 표시 */}
        <div
          ref={containerRef}
          id="map"
          className="absolute inset-0 z-0 h-full w-full min-h-[1px]"
          role="presentation"
          style={pickMode ? { cursor: "crosshair" } : undefined}
        />
        {pickMode && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-blue-600/95 px-4 py-1.5 text-xs font-medium text-white shadow-lg">
            {pickMode === "origin" ? ui.map.pickOrigin : ui.map.pickDestination}
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto absolute right-4 bottom-4 flex flex-col items-end gap-2">
          {geoHintMessage && (
            <div className="max-w-[14rem] rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive shadow-md">
              {geoHintMessage}
            </div>
          )}
          {controlsOpen && (
            <div className="w-[min(86vw,18rem)] rounded-lg border border-border bg-card/95 p-2 shadow-lg backdrop-blur-sm">
              <p className="mb-1 px-1 text-[10px] font-medium text-muted-foreground">{ui.map.mapOptions}</p>
              <div className="mb-2 flex flex-wrap gap-1">
                {mapTypeButtons.map((opt) => (
                  <Button
                    key={opt.id}
                    type="button"
                    size="sm"
                    variant={mapTypeKey === opt.id ? "default" : "secondary"}
                    className="h-7 flex-1 text-xs"
                    disabled={!sdkLoaded}
                    onClick={() => applyMapType(opt.id)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={showCampusOverview}
                  aria-label={ui.map.campusOverview}
                >
                  <Maximize2 className="h-4 w-4" />
                  {ui.map.campusOverview}
                </Button>
                <Button
                  type="button"
                  variant={locationTracking ? "default" : "secondary"}
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => {
                    if (locationTracking) stopLocationTracking();
                    else setLocationDialogOpen(true);
                  }}
                  disabled={!sdkLoaded}
                  aria-label={ui.map.myLocation}
                >
                  <Locate className="h-4 w-4" />
                  {ui.map.myLocation}
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button type="button" variant="secondary" size="icon" onClick={() => zoomDelta(1)} className="shadow-md" aria-label={ui.map.zoomIn}>
              <Plus className="h-5 w-5" />
            </Button>
            <Button type="button" variant="secondary" size="icon" onClick={() => zoomDelta(-1)} className="shadow-md" aria-label={ui.map.zoomOut}>
              <Minus className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant={controlsOpen ? "default" : "secondary"}
              size="icon"
              onClick={() => setControlsOpen((prev) => !prev)}
              className="shadow-md"
              aria-label={controlsOpen ? ui.map.mapOptionsClose : ui.map.mapOptionsOpen}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="pointer-events-auto absolute left-3 bottom-3 rounded-md border border-border bg-card/95 p-2 shadow-md backdrop-blur-sm">
          <div className="mb-1 flex items-center gap-1.5">
            <h4 className="text-[11px] font-semibold text-foreground">{ui.map.footprintLegend}</h4>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-4 w-4 rounded-full p-0 text-[10px] font-bold"
              onClick={() => setGradeGuideOpen(true)}
              aria-label={ui.map.gradeGuideOpen}
            >
              ?
            </Button>
          </div>
          <p className="mb-1.5 text-[9px] text-muted-foreground">{ui.map.footprintHint}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="h-0 w-4 shrink-0 border-t-2" style={{ borderColor: FOOTPRINT_LEVEL_STROKE.A }} />
              <span className="text-[11px] text-muted-foreground">{ui.sidebar.gradeA}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-0 w-4 shrink-0 border-t-2" style={{ borderColor: FOOTPRINT_LEVEL_STROKE.B }} />
              <span className="text-[11px] text-muted-foreground">{ui.sidebar.gradeB}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-0 w-4 shrink-0 border-t-2" style={{ borderColor: FOOTPRINT_LEVEL_STROKE.C }} />
              <span className="text-[11px] text-muted-foreground">{ui.sidebar.gradeC}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-0 w-4 shrink-0 border-t-2" style={{ borderColor: FOOTPRINT_STROKE_UNKNOWN }} />
              <span className="text-[11px] text-muted-foreground">{ui.gradeUnsurveyed}</span>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <AlertDialogContent className="z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>{ui.map.locationDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-left">{ui.map.locationDialogBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setLocationDialogOpen(false)}>
              {ui.map.locationDialogCancel}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setLocationDialogOpen(false);
                beginLocationTracking();
              }}
            >
              {ui.map.locationDialogConfirm}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={gradeGuideOpen} onOpenChange={setGradeGuideOpen}>
        <AlertDialogContent className="z-[100] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{ui.map.gradeGuideTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-left">{ui.map.gradeGuideIntro}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 text-sm text-foreground">
            <p>{ui.map.gradeGuideA}</p>
            <p>{ui.map.gradeGuideB}</p>
            <p>{ui.map.gradeGuideC}</p>
            <p>{ui.map.gradeGuideUnsurveyed}</p>
          </div>
          <AlertDialogFooter>
            <Button type="button" onClick={() => setGradeGuideOpen(false)}>
              {ui.map.gradeGuideClose}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
