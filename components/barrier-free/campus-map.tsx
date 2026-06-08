"use client";

import { useEffect, useRef, useCallback, useMemo, useState, memo, type RefObject } from "react";
import Script from "next/script";
import { Plus, Minus, Locate, Maximize2, SlidersHorizontal, Route, Navigation } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
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
import type { ElevatorRecord } from "@/lib/routing/elevators";
import { haversineMeters } from "@/lib/routing/geo";
import {
  applyNavigationCamera,
  fuseNavigationHeading,
  lerpAngleDeg,
  lerpLatLng,
  NAV_FOLLOW_ZOOM,
  NAV_HEADING_LERP,
  NAV_POS_LERP,
} from "@/lib/routing/nav-camera";
import type { DeviceHeadingSnapshot, NavMotionSnapshot } from "@/lib/device-orientation";
import { compassAgeMs } from "@/lib/device-orientation";
import { segmentColor } from "@/lib/routing/style";
import { RouteLegend } from "@/components/barrier-free/route-legend";
import { useUi } from "@/hooks/use-ui";
import {
  footprintPolygonPathGroups,
  footprintStrokeOptions,
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
  /** GPS ref — rAF 루프에서 React 리렌더 없이 위치 읽기 */
  liveUserPositionRef?: RefObject<LatLng | null>;
  /** 지도에서 출발/도착 지점 선택 모드 */
  pickMode?: "origin" | "destination" | null;
  onMapPick?: (point: LatLng) => void;
  /** 네비게이션 중 사용자 위치로 지도 추적 */
  followUser?: boolean;
  /** 길안내 중 방향 회전·부드러운 추적 */
  navigationMode?: boolean;
  /** GPS/이동 방향 (deg) */
  userHeading?: number | null;
  /** 경로 진행 방향 (deg) */
  routeHeading?: number | null;
  /** 기기 나침반 (DeviceOrientation) — rAF에서 직접 읽음 */
  deviceHeadingRef?: RefObject<DeviceHeadingSnapshot>;
  /** GPS 속도·이동 방향 스냅샷 */
  navMotionRef?: RefObject<NavMotionSnapshot>;
  /** explore: 메인 지도 · route: 길찾기 페이지 */
  mapLayout?: "explore" | "route";
  /** 모바일 길찾기 패널 높이(vh) — 컨트롤 버튼 겹침 방지 */
  mobileSheetVh?: number;
  /** 길찾기 지도에 표시할 캠퍼스 승강기 */
  elevators?: ElevatorRecord[];
  /** 현재 경로에서 이용하는 승강기 id */
  routeElevatorIds?: Set<string> | string[];
  /** 메인 지도 우측 컨트롤에 표시할 길찾기 링크 */
  directionsHref?: string;
  directionsLabel?: string;
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

function routeDrawSignature(
  line: LatLng[] | null,
  segments: string[] | null | undefined,
  origin: LatLng | null | undefined,
  dest: LatLng | null | undefined,
): string {
  if (!line || line.length < 2) return "";
  const first = line[0];
  const last = line[line.length - 1];
  const mid = line[Math.floor(line.length / 2)];
  const o = origin ? `${origin.lat},${origin.lng}` : "";
  const d = dest ? `${dest.lat},${dest.lng}` : "";
  return `${line.length}:${first.lat},${first.lng}:${mid.lat},${mid.lng}:${last.lat},${last.lng}:${segments?.length ?? 0}|${o}|${d}`;
}

function shouldHideFootprintsInNav(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches
  );
}

type NaverRoutePolyline = {
  setMap: (t: unknown) => void;
  setPath?: (path: unknown) => void;
};

interface RouteColorSpan {
  start: number;
  end: number;
  color: string;
}

function buildRouteColorSpans(
  pathLen: number,
  segments: string[] | null | undefined,
): RouteColorSpan[] {
  if (pathLen < 2) return [];
  const colorAt = (i: number) => segmentColor(segments?.[i] ?? "path");
  const spans: RouteColorSpan[] = [];
  let start = 0;
  for (let i = 0; i < pathLen - 1; i++) {
    const isLast = i === pathLen - 2;
    const colorChanges = !isLast && colorAt(i + 1) !== colorAt(i);
    if (isLast || colorChanges) {
      spans.push({ start, end: i + 1, color: colorAt(start) });
      start = i + 1;
    }
  }
  return spans;
}

function clearRoutePolylines(
  outline: NaverRoutePolyline | null,
  segments: NaverRoutePolyline[],
): void {
  try {
    outline?.setMap(null);
  } catch {
    /* ignore */
  }
  for (const seg of segments) {
    try {
      seg.setMap(null);
    } catch {
      /* ignore */
    }
  }
}

function syncRoutePolylines(
  map: unknown,
  LatLngCtor: new (lat: number, lng: number) => unknown,
  PolylineCtor: new (opts: Record<string, unknown>) => NaverRoutePolyline,
  path: unknown[],
  spans: RouteColorSpan[],
  outlineRef: { current: NaverRoutePolyline | null },
  segmentRefs: { current: NaverRoutePolyline[] },
): void {
  if (path.length < 2) {
    clearRoutePolylines(outlineRef.current, segmentRefs.current);
    outlineRef.current = null;
    segmentRefs.current = [];
    return;
  }

  if (outlineRef.current?.setPath) {
    outlineRef.current.setPath(path);
  } else {
    try {
      outlineRef.current?.setMap(null);
    } catch {
      /* ignore */
    }
    outlineRef.current = new PolylineCtor({
      map,
      path,
      strokeColor: "#ffffff",
      strokeOpacity: 0.9,
      strokeWeight: 11,
      strokeLineCap: "round",
      strokeLineJoin: "round",
      zIndex: 300,
    });
  }

  while (segmentRefs.current.length > spans.length) {
    const extra = segmentRefs.current.pop();
    try {
      extra?.setMap(null);
    } catch {
      /* ignore */
    }
  }

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const slice = path.slice(span.start, span.end + 1);
    let poly = segmentRefs.current[i];
    if (poly?.setPath) {
      poly.setPath(slice);
    } else {
      poly = new PolylineCtor({
        map,
        path: slice,
        strokeColor: span.color,
        strokeOpacity: 0.95,
        strokeWeight: 6,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        zIndex: 301,
      });
      segmentRefs.current[i] = poly;
      continue;
    }
    segmentRefs.current[i] = poly;
  }
  segmentRefs.current.length = spans.length;
}

function campusMapPropsAreEqual(prev: CampusMapProps, next: CampusMapProps): boolean {
  const skipVolatileNav =
    prev.followUser &&
    prev.navigationMode &&
    next.followUser &&
    next.navigationMode;

  const stableKeys: (keyof CampusMapProps)[] = [
    "buildings",
    "selectedBuilding",
    "showFacilityPins",
    "showAllFootprints",
    "routeLine",
    "routeSegments",
    "originPoint",
    "destPoint",
    "pickMode",
    "followUser",
    "navigationMode",
    "mapLayout",
    "mobileSheetVh",
    "elevators",
    "routeElevatorIds",
    "directionsHref",
    "directionsLabel",
    "onBuildingSelect",
    "onMapPick",
    "liveUserPositionRef",
    "deviceHeadingRef",
    "navMotionRef",
  ];

  for (const key of stableKeys) {
    if (prev[key] !== next[key]) return false;
  }

  if (!skipVolatileNav) {
    if (prev.liveUserPosition !== next.liveUserPosition) return false;
    if (prev.userHeading !== next.userHeading) return false;
    if (prev.routeHeading !== next.routeHeading) return false;
  }

  return true;
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

function isMobileMapViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
}

type MapFitOptions = {
  padding?: number;
  maxZoom?: number;
  /** fitBounds 후에도 이보다 작게 줌아웃하지 않음 */
  minZoom?: number;
};

function campusOverviewFitOptions(mapLayout: "explore" | "route"): MapFitOptions {
  const mobile = isMobileMapViewport();
  if (mapLayout === "explore" && mobile) {
    return { padding: 16, maxZoom: 18, minZoom: 17 };
  }
  if (mobile) {
    return { padding: 36, maxZoom: 17, minZoom: 15 };
  }
  return { padding: 60, maxZoom: 18, minZoom: 15 };
}

function footprintBoundsPoints(collection: FootprintFeatureCollection | null): LatLng[] {
  if (!collection?.features?.length) return [];
  const pts: LatLng[] = [];
  for (const feature of collection.features) {
    const g = feature.geometry;
    const polygonSets = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const rings of polygonSets) {
      for (const ring of rings) {
        for (const coord of ring) {
          const lng = coord[0];
          const lat = coord[1];
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            pts.push({ lat, lng });
          }
        }
      }
    }
  }
  return pts;
}

function fitToPoints(
  maps: NMaps,
  map: unknown,
  list: LatLng[],
  options?: MapFitOptions,
) {
  const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;
  const BoundsCtor = maps.LatLngBounds as unknown as new (a?: unknown, b?: unknown) => {
    extend(ll: unknown): void;
  };
  const pts = list.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const m = map as {
    setCenter?: (c: unknown) => void;
    setZoom?: (z: number) => void;
    fitBounds?: (b: unknown, o?: Record<string, unknown>) => void;
  };
  if (!pts.length || !m?.fitBounds) return;

  if (pts.length === 1) {
    m.setCenter?.(new LatLngCtor(pts[0].lat, pts[0].lng));
    m.setZoom?.(options?.maxZoom ?? NAV_FOLLOW_ZOOM);
    return;
  }

  try {
    const bounds = new BoundsCtor();
    for (const p of pts) bounds.extend(new LatLngCtor(p.lat, p.lng));
    m.fitBounds?.(bounds, {
      padding: options?.padding ?? 70,
      maxZoom: options?.maxZoom ?? 17,
    });
    if (options?.minZoom != null && m.getZoom) {
      const z = m.getZoom();
      if (z < options.minZoom) m.setZoom?.(options.minZoom);
    }
  } catch {
    /* ignore */
  }
}

function fitCampusOverview(
  maps: NMaps,
  map: unknown,
  buildings: BarrierBuilding[],
  footprintCollection: FootprintFeatureCollection | null,
  mapLayout: "explore" | "route",
) {
  const opts = campusOverviewFitOptions(mapLayout);
  const footprintPts = footprintBoundsPoints(footprintCollection);
  if (footprintPts.length >= 2) {
    fitToPoints(maps, map, footprintPts, opts);
    return;
  }
  fitToBuildings(maps, map, buildings, opts);
}

function fitToBuildings(
  maps: NMaps,
  map: unknown,
  list: BarrierBuilding[],
  options?: MapFitOptions,
) {
  const pts = list
    .filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng))
    .map((b) => ({ lat: b.lat, lng: b.lng }));
  fitToPoints(maps, map, pts, options ?? { padding: 60, maxZoom: 18 });
}

const ELEVATOR_ICON_SRC = "/icons/facilities/elevator.png";

function shortElevatorLabel(name: string): string {
  return name.replace(/^공주대학교\s*/, "").replace(/\s*승강기$/, "").trim() || name;
}

function elevatorMarkerHtml(label: string) {
  const safe = escapeHtml(label);
  return `<div aria-hidden="true" style="display:flex;flex-direction:column;align-items:center;max-width:88px;">
    <div style="width:38px;height:38px;border-radius:10px;background:#fff;border:2px solid #fff;box-shadow:0 0 0 3px rgba(13,148,136,.45),0 2px 10px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;overflow:hidden;">
      <img src="${ELEVATOR_ICON_SRC}" alt="" width="34" height="34" decoding="async" draggable="false" style="display:block;width:34px;height:34px;object-fit:contain;" />
    </div>
    <span style="margin-top:3px;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,.92);font-size:10px;font-weight:600;line-height:1.2;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:88px;box-shadow:0 1px 3px rgba(0,0,0,.12);">${safe}</span>
  </div>`;
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

function navArrowHtml(headingDeg = 0) {
  const deg = Number.isFinite(headingDeg) ? headingDeg : 0;
  return `<div aria-hidden="true" style="width:28px;height:28px;transform:translate(-50%,-50%) rotate(${deg}deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,.35));">
    <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="11" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
      <path fill="#ffffff" d="M14 6.5 L19.5 20 H14 V15.5 H9 L14 6.5 Z"/>
    </svg>
  </div>`;
}

function CampusMapInner({
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
  liveUserPositionRef,
  pickMode = null,
  onMapPick,
  followUser = false,
  navigationMode = false,
  userHeading = null,
  routeHeading = null,
  deviceHeadingRef,
  navMotionRef,
  mapLayout = "explore",
  mobileSheetVh = 54,
  elevators = [],
  routeElevatorIds,
  directionsHref,
  directionsLabel,
}: CampusMapProps) {
  const ui = useUi();
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const routeOutlineRef = useRef<NaverRoutePolyline | null>(null);
  const routeSegmentPolylinesRef = useRef<NaverRoutePolyline[]>([]);
  const routeMarkersRef = useRef<Array<{ setMap: (t: unknown) => void }>>([]);
  const elevatorMarkersRef = useRef<Array<{ setMap: (t: unknown) => void }>>([]);
  const navUserMarkerRef = useRef<{
    setMap: (t: unknown) => void;
    setPosition?: (p: unknown) => void;
    setIcon?: (icon: unknown) => void;
  } | null>(null);
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
  const [followPaused, setFollowPaused] = useState(false);
  const displayPosRef = useRef<LatLng | null>(null);
  const displayHeadingRef = useRef(0);
  const targetPosRef = useRef<LatLng | null>(null);
  const targetHeadingRef = useRef<number | null>(null);
  const navAnimFrameRef = useRef<number | null>(null);
  const navZoomSetRef = useRef(false);
  const navSnapPendingRef = useRef(false);
  const hasNavCenteredRef = useRef(false);
  const viewportAdjustedRef = useRef(false);
  const lastMarkerHeadingRef = useRef<number | null>(null);
  const lastSheetVhForViewportRef = useRef(mobileSheetVh);
  const mobileSheetVhRef = useRef(mobileSheetVh);
  const programmaticCameraRef = useRef(false);
  const liveUserPosRefProp = useRef(liveUserPositionRef);
  liveUserPosRefProp.current = liveUserPositionRef;
  const lastCameraFrameRef = useRef(0);
  const lastAppliedCamRef = useRef<{ lat: number; lng: number; heading: number } | null>(null);
  const navFollowSessionRef = useRef(false);
  const lastRouteDrawSigRef = useRef("");
  const lastCameraApplyAtRef = useRef(0);
  mobileSheetVhRef.current = mobileSheetVh;
  const userHeadingRef = useRef(userHeading);
  const routeHeadingRef = useRef(routeHeading);
  userHeadingRef.current = userHeading;
  routeHeadingRef.current = routeHeading;

  const resolveFusedHeading = useCallback((): number => {
    const now = Date.now();
    const compass = deviceHeadingRef?.current;
    const motion = navMotionRef?.current;
    const fused = fuseNavigationHeading({
      compassHeading: compass?.heading ?? null,
      compassAgeMs: compass ? compassAgeMs(compass, now) : Infinity,
      gpsHeading: motion?.gpsHeading ?? userHeadingRef.current,
      movementBearing: motion?.movementBearing ?? null,
      routeHeading: routeHeadingRef.current,
      speedMps: motion?.speedMps ?? null,
      movedMeters: motion?.movedMeters ?? 0,
    });
    if (fused != null) return fused;
    return routeHeadingRef.current ?? userHeadingRef.current ?? displayHeadingRef.current;
  }, [deviceHeadingRef, navMotionRef]);
  const [geoHintMessage, setGeoHintMessage] = useState<string | null>(null);
  const [locationTracking, setLocationTracking] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [mapTypeKey, setMapTypeKey] = useState<MapTypeOptionId>("NORMAL");
  const [controlsOpen, setControlsOpen] = useState(false);
  const exploreFitAfterFootprintRef = useRef(false);

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
    fetch("/data/naver.geojson")
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

    clearRoutePolylines(routeOutlineRef.current, routeSegmentPolylinesRef.current);
    routeOutlineRef.current = null;
    routeSegmentPolylinesRef.current = [];
    routeMarkersRef.current.forEach((m) => {
      try {
        m.setMap(null);
      } catch {
        /* ignore */
      }
    });
    routeMarkersRef.current = [];
    elevatorMarkersRef.current.forEach((m) => {
      try {
        m.setMap(null);
      } catch {
        /* ignore */
      }
    });
    elevatorMarkersRef.current = [];
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
    exploreFitAfterFootprintRef.current = false;

    const el = containerRef.current;
    const MapCtor = maps.Map as unknown as new (node: HTMLElement, opts?: Record<string, unknown>) => {
      destroy: () => void;
      setZoom: (z: number) => void;
      getZoom: () => number;
      panTo: (ll: unknown, opts?: unknown) => void;
      fitBounds: (bounds: unknown, opts?: unknown) => void;
    };

    const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;

    const initialZoom = isMobileMapViewport() && mapLayout === "explore" ? 17 : 16;

    const map = new MapCtor(el, {
      center: new LatLngCtor(centerMemo.lat, centerMemo.lng),
      zoom: initialZoom,
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

    const applyCampusFit = () => {
      fitCampusOverview(maps as NMaps, map, buildings, footprintCollection, mapLayout);
    };

    applyCampusFit();

    requestAnimationFrame(() => {
      relayoutMap();
      applyCampusFit();
      requestAnimationFrame(applyCampusFit);
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
  }, [sdkLoaded, clientId, centerMemo.lat, centerMemo.lng, buildings, teardown, showFacilityPins, mapLayout, footprintCollection]);

  /** 폴리곤 로드 후 모바일 탐색 화면 — 한 번 더 캠퍼스에 맞춤 (초기 fitBounds 시 영역이 넓게 잡히는 경우 보정) */
  useEffect(() => {
    if (!sdkLoaded || mapLayout !== "explore" || !footprintCollection?.features.length) return;
    if (!isMobileMapViewport()) return;
    const map = mapInstanceRef.current;
    const maps = window.naver?.maps as NMaps | undefined;
    if (!map || !maps) return;

    exploreFitAfterFootprintRef.current = true;
    fitCampusOverview(maps, map, buildings, footprintCollection, mapLayout);
    requestAnimationFrame(() => {
      fitCampusOverview(maps, map, buildings, footprintCollection, mapLayout);
    });
  }, [sdkLoaded, mapLayout, footprintCollection, buildings, mapReadyEpoch]);

  useEffect(() => {
    if (!sdkLoaded || !footprintCollection?.features.length) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    footprintPolygonsRef.current.forEach(({ poly }) => {
      try {
        poly.setMap(null);
      } catch {
        /* ignore */
      }
    });
    footprintPolygonsRef.current = [];

    const maps = window.naver?.maps as NMaps | undefined;
    const PolygonCtor = maps?.Polygon as
      | (new (opts: Record<string, unknown>) => {
          setMap: (target: unknown) => void;
          setOptions?: (opts: Record<string, unknown>) => void;
        })
      | undefined;
    const LatLngCtor = maps?.LatLng as new (lat: number, lng: number) => unknown | undefined;
    if (!PolygonCtor || !LatLngCtor || !maps?.Event?.addListener) return;

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

  /** 모바일 길안내 중 건물 폴리곤만 숨김 (재생성 없이 setMap 토글) */
  useEffect(() => {
    if (!sdkLoaded || footprintPolygonsRef.current.length === 0) return;
    const map = mapInstanceRef.current;
    const targetMap = navigationMode && shouldHideFootprintsInNav() ? null : map;
    for (const { poly } of footprintPolygonsRef.current) {
      try {
        poly.setMap(targetMap);
      } catch {
        /* ignore */
      }
    }
  }, [sdkLoaded, navigationMode, mapReadyEpoch]);

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
    map.panTo?.(target, { duration: 400 });
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

    const drawSig = routeDrawSignature(routeLine, routeSegments, originPoint, destPoint);
    const routeUnchanged =
      drawSig.length > 0 &&
      drawSig === lastRouteDrawSigRef.current &&
      routeOutlineRef.current != null;

    const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;
    const PolylineCtor = maps.Polyline as
      | (new (opts: Record<string, unknown>) => NaverRoutePolyline)
      | undefined;
    const MarkerCtor = maps.Marker as
      | (new (opts: Record<string, unknown>) => { setMap: (t: unknown) => void })
      | undefined;
    const PointCtor = maps.Point as (new (x: number, y: number) => unknown) | undefined;

    if (routeUnchanged) {
      return;
    }
    lastRouteDrawSigRef.current = drawSig;

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
      const spans = buildRouteColorSpans(path.length, routeSegments);
      syncRoutePolylines(
        map,
        LatLngCtor,
        PolylineCtor,
        path,
        spans,
        routeOutlineRef,
        routeSegmentPolylinesRef,
      );
    } else {
      clearRoutePolylines(routeOutlineRef.current, routeSegmentPolylinesRef.current);
      routeOutlineRef.current = null;
      routeSegmentPolylinesRef.current = [];
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
      clearRoutePolylines(routeOutlineRef.current, routeSegmentPolylinesRef.current);
      routeOutlineRef.current = null;
      routeSegmentPolylinesRef.current = [];
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

  const routeElevatorIdSet = useMemo(() => {
    if (!routeElevatorIds) return new Set<string>();
    return routeElevatorIds instanceof Set ? routeElevatorIds : new Set(routeElevatorIds);
  }, [routeElevatorIds]);

  const routeElevators = useMemo(
    () => elevators.filter((ev) => routeElevatorIdSet.has(ev.id)),
    [elevators, routeElevatorIdSet],
  );

  /** 길찾기 지도 — 경로가 잡힌 뒤 캠퍼스 승강기 위치 */
  useEffect(() => {
    const clearElevatorMarkers = () => {
      elevatorMarkersRef.current.forEach((m) => {
        try {
          m.setMap(null);
        } catch {
          /* ignore */
        }
      });
      elevatorMarkersRef.current = [];
    };

    if (
      !sdkLoaded ||
      mapLayout !== "route" ||
      !routeLine ||
      routeLine.length < 2 ||
      routeElevators.length === 0
    ) {
      clearElevatorMarkers();
      return;
    }

    const map = mapInstanceRef.current;
    const maps = window.naver?.maps as NMaps | undefined;
    if (!map || !maps?.LatLng || !maps?.Marker || !maps?.Point) {
      clearElevatorMarkers();
      return;
    }

    const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;
    const PointCtor = maps.Point as new (x: number, y: number) => unknown;
    const MarkerCtor = maps.Marker as unknown as new (opts: Record<string, unknown>) => {
      setMap: (t: unknown) => void;
    };

    clearElevatorMarkers();

    for (const ev of routeElevators) {
      if (!Number.isFinite(ev.point.lat) || !Number.isFinite(ev.point.lng)) continue;
      const floorsLabel = ev.floors.join(", ");
      const marker = new MarkerCtor({
        map,
        position: new LatLngCtor(ev.point.lat, ev.point.lng),
        title: ui.map.elevatorMarkerTitle(ev.name, floorsLabel),
        zIndex: 390,
        icon: {
          content: elevatorMarkerHtml(shortElevatorLabel(ev.name)),
          anchor: new PointCtor(44, 19),
        },
      });
      elevatorMarkersRef.current.push(marker);
    }

    return clearElevatorMarkers;
  }, [sdkLoaded, mapReadyEpoch, mapLayout, routeLine, routeElevators, ui]);

  /** 경로가 생기면 경로 전체가 보이도록 맞춤 (안내 중에는 카메라 루프가 담당) */
  useEffect(() => {
    if (!sdkLoaded || followUser) return;
    if (!routeLine || routeLine.length < 2) return;
    const maps = window.naver?.maps as NMaps | undefined;
    const map = mapInstanceRef.current;
    if (!maps || !map) return;
    fitToPoints(maps as NMaps, map, routeLine, { padding: 70, maxZoom: 17 });
  }, [sdkLoaded, mapReadyEpoch, routeLine, followUser]);

  /** GPS 목표 위치·방향 갱신 */
  useEffect(() => {
    const fromRef = liveUserPosRefProp.current?.current;
    if (fromRef) {
      targetPosRef.current = fromRef;
      return;
    }
    if (liveUserPosition) {
      targetPosRef.current = liveUserPosition;
    }
  }, [liveUserPosition]);

  /** 하단 시트 높이 변경 시 뷰포트 보정 1회 재적용 */
  useEffect(() => {
    if (lastSheetVhForViewportRef.current !== mobileSheetVh) {
      lastSheetVhForViewportRef.current = mobileSheetVh;
      if (followUser && navigationMode) {
        viewportAdjustedRef.current = false;
        hasNavCenteredRef.current = false;
      }
    }
  }, [mobileSheetVh, followUser, navigationMode]);

  useEffect(() => {
    const h = resolveFusedHeading();
    if (Number.isFinite(h)) targetHeadingRef.current = h;
  }, [userHeading, routeHeading, resolveFusedHeading]);

  /** 안내 시작/종료 시 추적 상태 초기화 (방향 갱신마다 리셋하지 않음) */
  useEffect(() => {
    const active = followUser && navigationMode;
    if (!active) {
      navFollowSessionRef.current = false;
      return;
    }
    if (navFollowSessionRef.current) return;
    navFollowSessionRef.current = true;

    setFollowPaused(false);
    navZoomSetRef.current = false;
    navSnapPendingRef.current = true;
    hasNavCenteredRef.current = false;
    viewportAdjustedRef.current = false;
    displayPosRef.current = null;
    targetPosRef.current = null;
    lastMarkerHeadingRef.current = null;
    lastAppliedCamRef.current = null;
    const seedHeading = routeHeadingRef.current ?? userHeadingRef.current ?? 0;
    displayHeadingRef.current = seedHeading;
    targetHeadingRef.current = seedHeading;
  }, [followUser, navigationMode]);

  /** GPS 수신 전 출발점·경로 시작점으로 미리 맞춤 */
  useEffect(() => {
    if (!sdkLoaded || !followUser || !navigationMode || liveUserPosition || followPaused) return;
    const map = mapInstanceRef.current;
    const maps = window.naver?.maps as NMaps | undefined;
    if (!map || !maps?.LatLng) return;

    const seed = originPoint ?? (routeLine && routeLine.length > 0 ? routeLine[0] : null);
    const m = map as { setCenter?: (ll: unknown) => void; setZoom?: (z: number) => void; relayout?: () => void };

    if (routeLine && routeLine.length >= 2) {
      fitToPoints(maps as NMaps, map, routeLine, { padding: 70, maxZoom: 17 });
    } else if (seed) {
      const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;
      m.setCenter?.(new LatLngCtor(seed.lat, seed.lng));
      m.setZoom?.(NAV_FOLLOW_ZOOM);
    } else {
      return;
    }

    requestAnimationFrame(() => {
      try {
        m.relayout?.();
      } catch {
        /* ignore */
      }
    });
  }, [sdkLoaded, followUser, navigationMode, liveUserPosition, followPaused, originPoint, routeLine, mapReadyEpoch]);

  /** 첫 GPS 수신 시 즉시 사용자 위치로 맞춤 */
  useEffect(() => {
    if (!sdkLoaded || !followUser || !navigationMode || followPaused || !liveUserPosition) return;
    if (hasNavCenteredRef.current) return;

    const map = mapInstanceRef.current;
    const maps = window.naver?.maps as NMaps | undefined;
    if (!map || !maps?.LatLng || !maps?.Point) return;

    const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;
    const PointCtor = maps.Point as new (x: number, y: number) => unknown;
    const heading = resolveFusedHeading();
    const bottomObstructionVh =
      mapLayout === "route" &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 639px)").matches
        ? mobileSheetVhRef.current
        : 0;

    displayPosRef.current = { ...liveUserPosition };
    targetPosRef.current = liveUserPosition;

    try {
      programmaticCameraRef.current = true;
      applyNavigationCamera(
        map as Parameters<typeof applyNavigationCamera>[0],
        (lat, lng) => new LatLngCtor(lat, lng),
        (x, y) => new PointCtor(x, y),
        liveUserPosition,
        heading,
        { snap: true, bottomObstructionVh, adjustViewport: true },
      );
      viewportAdjustedRef.current = true;
      try {
        (map as { relayout?: () => void }).relayout?.();
      } catch {
        /* ignore */
      }
      navZoomSetRef.current = true;
      navSnapPendingRef.current = false;
      hasNavCenteredRef.current = true;
    } catch {
      /* ignore */
    } finally {
      programmaticCameraRef.current = false;
    }
  }, [
    sdkLoaded,
    followUser,
    navigationMode,
    followPaused,
    liveUserPosition,
    userHeading,
    routeHeading,
    mapLayout,
    mapReadyEpoch,
    resolveFusedHeading,
  ]);

  /** 안내 중 지도 드래그·핀치 줌 → 추적 일시 중지 */
  useEffect(() => {
    if (!sdkLoaded || !navigationMode) return;
    const map = mapInstanceRef.current;
    const maps = window.naver?.maps as NMaps | undefined;
    if (!map || !maps?.Event?.addListener) return;

    const pauseFollow = () => {
      if (programmaticCameraRef.current) return;
      setFollowPaused(true);
    };

    const dragListener = maps.Event.addListener(map, "dragstart", pauseFollow);
    const zoomListener = maps.Event.addListener(map, "zoom_changed", pauseFollow);

    return () => {
      try {
        const remove = (maps.Event as { removeListener?: (l: unknown) => void }).removeListener;
        remove?.(dragListener);
        remove?.(zoomListener);
      } catch {
        /* ignore */
      }
    };
  }, [sdkLoaded, navigationMode, mapReadyEpoch]);

  /** 실시간 GPS 마커 생성 */
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

    if (followUser && navigationMode && !followPaused && navUserMarkerRef.current?.setPosition) {
      return;
    }

    const pos = displayPosRef.current ?? liveUserPosition;
    const ll = new LatLngCtor(pos.lat, pos.lng);
    const h = displayHeadingRef.current;
    if (navUserMarkerRef.current?.setPosition) {
      navUserMarkerRef.current.setPosition(ll);
    } else if (MarkerCtor && PointCtor) {
      navUserMarkerRef.current = new MarkerCtor({
        map,
        position: ll,
        zIndex: 500,
        icon: { content: navArrowHtml(h), anchor: new PointCtor(14, 14) },
      }) as typeof navUserMarkerRef.current;
    }
  }, [sdkLoaded, mapReadyEpoch, liveUserPosition, followUser, navigationMode, followPaused]);

  /** 부드러운 추적 + 방향 회전 (requestAnimationFrame) */
  useEffect(() => {
    if (!sdkLoaded || !followUser || !navigationMode || followPaused) {
      if (navAnimFrameRef.current != null) {
        cancelAnimationFrame(navAnimFrameRef.current);
        navAnimFrameRef.current = null;
      }
      return;
    }

    let lastFrameTime = performance.now();
    const isMobileNav =
      typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
    const minFrameMs = isMobileNav ? 50 : 32;
    const markerHeadingThreshold = isMobileNav ? 8 : 4;
    const camMoveSkipM = isMobileNav ? 1.8 : 1.0;
    const camHeadingSkipDeg = isMobileNav ? 10 : 6;
    const camApplyMinMs = isMobileNav ? 140 : 90;

    const tick = (now: number) => {
      if (minFrameMs > 0 && now - lastCameraFrameRef.current < minFrameMs) {
        navAnimFrameRef.current = requestAnimationFrame(tick);
        return;
      }
      lastCameraFrameRef.current = now;

      const freshPos = liveUserPosRefProp.current?.current;
      if (freshPos) {
        targetPosRef.current = freshPos;
      }

      const dt = Math.min(48, now - lastFrameTime) / 16.67;
      lastFrameTime = now;

      const map = mapInstanceRef.current;
      const maps = window.naver?.maps as NMaps | undefined;
      if (!map || !maps?.LatLng) {
        navAnimFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const target = targetPosRef.current;
      if (!target) {
        navAnimFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      let display = displayPosRef.current;
      const shouldSnap = navSnapPendingRef.current || !display;
      if (shouldSnap) {
        display = { ...target };
        navSnapPendingRef.current = false;
      } else {
        const posT = 1 - (1 - NAV_POS_LERP) ** dt;
        display = lerpLatLng(display, target, posT);
      }
      displayPosRef.current = display;

      const tHeading = resolveFusedHeading();
      if (Number.isFinite(tHeading)) {
        const headT = 1 - (1 - NAV_HEADING_LERP) ** dt;
        displayHeadingRef.current = lerpAngleDeg(displayHeadingRef.current, tHeading, headT);
      }

      const headingForCam = displayHeadingRef.current;
      const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;
      const PointCtor = maps.Point as (new (x: number, y: number) => unknown) | undefined;
      const ll = new LatLngCtor(display.lat, display.lng);
      if (navUserMarkerRef.current?.setPosition) {
        navUserMarkerRef.current.setPosition(ll);
      }

      if (PointCtor != null && navUserMarkerRef.current?.setIcon) {
        const prevH = lastMarkerHeadingRef.current;
        if (
          prevH == null ||
          Math.abs(((headingForCam - prevH + 540) % 360) - 180) > markerHeadingThreshold
        ) {
          lastMarkerHeadingRef.current = headingForCam;
          navUserMarkerRef.current.setIcon({
            content: navArrowHtml(headingForCam),
            anchor: new PointCtor(14, 14),
          });
        }
      }

      const bottomObstructionVh =
        mapLayout === "route" &&
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 639px)").matches
          ? mobileSheetVhRef.current
          : 0;

      const needsViewportAdjust = !viewportAdjustedRef.current;
      const lastCam = lastAppliedCamRef.current;
      const skipCamera =
        !shouldSnap &&
        !needsViewportAdjust &&
        lastCam != null &&
        haversineMeters(lastCam, display) < camMoveSkipM &&
        Math.abs(((headingForCam - lastCam.heading + 540) % 360) - 180) < camHeadingSkipDeg;

      const camDue =
        shouldSnap ||
        needsViewportAdjust ||
        now - lastCameraApplyAtRef.current >= camApplyMinMs;

      if (skipCamera || !camDue) {
        navAnimFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const m = map as Parameters<typeof applyNavigationCamera>[0] & { relayout?: () => void };

      try {
        programmaticCameraRef.current = true;
        const origin =
          PointCtor != null
            ? applyNavigationCamera(
                m,
                (lat, lng) => new LatLngCtor(lat, lng),
                (x, y) => new PointCtor(x, y),
                display,
                headingForCam,
                {
                  snap: shouldSnap,
                  bottomObstructionVh,
                  adjustViewport: needsViewportAdjust,
                },
              )
            : null;

        if (needsViewportAdjust && origin) {
          viewportAdjustedRef.current = true;
        }

        if (origin && !hasNavCenteredRef.current) {
          hasNavCenteredRef.current = true;
        }

        if (shouldSnap || needsViewportAdjust) {
          try {
            m.relayout?.();
          } catch {
            /* ignore */
          }
        }
        navZoomSetRef.current = true;
        lastCameraApplyAtRef.current = now;
        lastAppliedCamRef.current = {
          lat: display.lat,
          lng: display.lng,
          heading: headingForCam,
        };
      } catch {
        /* ignore */
      } finally {
        programmaticCameraRef.current = false;
      }

      navAnimFrameRef.current = requestAnimationFrame(tick);
    };

    navAnimFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (navAnimFrameRef.current != null) cancelAnimationFrame(navAnimFrameRef.current);
      navAnimFrameRef.current = null;
      lastCameraApplyAtRef.current = 0;
    };
  }, [sdkLoaded, followUser, navigationMode, followPaused, mapReadyEpoch, mapLayout]);

  /** 추적 일시 중지 중에도 GPS 마커만 부드럽게 갱신 */
  useEffect(() => {
    if (!sdkLoaded || !followUser || !navigationMode || !followPaused) return;

    let frame: number | null = null;
    let lastTick = 0;
    const isMobile =
      typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
    const minMs = isMobile ? 50 : 32;

    const tick = (now: number) => {
      if (now - lastTick >= minMs) {
        lastTick = now;
        const freshPos = liveUserPosRefProp.current?.current;
        if (freshPos) targetPosRef.current = freshPos;

        const map = mapInstanceRef.current;
        const maps = window.naver?.maps as NMaps | undefined;
        const pos = targetPosRef.current;
        if (map && maps?.LatLng && pos && navUserMarkerRef.current?.setPosition) {
          const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;
          navUserMarkerRef.current.setPosition(new LatLngCtor(pos.lat, pos.lng));
        }
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [sdkLoaded, followUser, navigationMode, followPaused, mapReadyEpoch]);

  /** 추적 중이 아닐 때 GPS 위치만 표시 */
  useEffect(() => {
    if (!sdkLoaded || !liveUserPosition || (followUser && navigationMode && !followPaused)) return;
    const map = mapInstanceRef.current as undefined | {
      panTo?: (ll: unknown, o?: unknown) => void;
      setCenter?: (ll: unknown) => void;
    };
    const maps = window.naver?.maps as NMaps | undefined;
    if (!map || !maps?.LatLng) return;
    const LatLngCtor = maps.LatLng as new (lat: number, lng: number) => unknown;
    const pos = new LatLngCtor(liveUserPosition.lat, liveUserPosition.lng);
    if (followUser && !navigationMode) {
      map.panTo?.(pos, { duration: 400 });
    }
  }, [sdkLoaded, mapReadyEpoch, liveUserPosition, followUser, navigationMode, followPaused]);

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

  const zoomDelta = useCallback(
    (delta: number) => {
      const map = mapInstanceRef.current as undefined | { getZoom: () => number; setZoom: (z: number) => void };
      if (!map?.getZoom || !map?.setZoom) return;
      if (navigationMode) setFollowPaused(true);
      const next = Math.min(19, Math.max(13, map.getZoom() + delta));
      map.setZoom(next);
    },
    [navigationMode],
  );

  const fitRouteOnMap = useCallback(() => {
    if (!routeLine || routeLine.length < 2) return;
    setFollowPaused(true);
    const maps = window.naver?.maps as NMaps | undefined;
    if (!maps || !mapInstanceRef.current) return;
    fitToPoints(maps as NMaps, mapInstanceRef.current, routeLine, { padding: 70, maxZoom: 17 });
  }, [routeLine]);

  const resumeNavigationFollow = useCallback(() => {
    const latest = liveUserPosRefProp.current?.current ?? targetPosRef.current;
    if (latest) {
      targetPosRef.current = latest;
      displayPosRef.current = { ...latest };
    }
    lastAppliedCamRef.current = null;
    navZoomSetRef.current = false;
    navSnapPendingRef.current = true;
    hasNavCenteredRef.current = false;
    viewportAdjustedRef.current = false;
    setFollowPaused(false);
  }, []);

  const handleNavigationLocatePress = useCallback(() => {
    if (!navigationMode) return;
    resumeNavigationFollow();
  }, [navigationMode, resumeNavigationFollow]);

  const showCampusOverview = useCallback(() => {
    const maps = window.naver?.maps as NMaps | undefined;
    if (!maps || !mapInstanceRef.current) return;
    fitCampusOverview(maps, mapInstanceRef.current, buildings, footprintCollection, mapLayout);
  }, [buildings, footprintCollection, mapLayout]);

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
      <div className="relative flex h-full min-h-0 flex-1 items-center justify-center bg-muted/40 p-8 text-center">
        <div className="max-w-md space-y-2 rounded-lg border border-border bg-card p-6 shadow-sm">
          <p className="font-semibold text-foreground">{ui.map.clientIdRequired}</p>
          <p className="text-sm text-muted-foreground">{ui.map.clientIdHint}</p>
        </div>
      </div>
    );
  }

  const scriptSrc = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;

  const overlayTransitionClass =
    "transition-[bottom] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

  const exploreOverlayBottomClass = cn(
    overlayTransitionClass,
    "bottom-[calc(env(safe-area-inset-bottom,0px)+1.75rem)]",
    "sm:bottom-[calc(env(safe-area-inset-bottom,0px)+1.125rem)]",
  );

  const routeOverlayBottomClass = cn(
    overlayTransitionClass,
    "max-sm:bottom-[calc(var(--route-sheet-vh)*1vh+0.625rem)]",
    "sm:bottom-[calc(env(safe-area-inset-bottom,0px)+1.125rem)]",
  );

  const leftOverlayBottomClass =
    mapLayout === "route" ? routeOverlayBottomClass : exploreOverlayBottomClass;

  const zoomControlButtons = (
    <div className="flex overflow-hidden rounded-lg border border-border bg-card/95 shadow-md backdrop-blur-sm sm:flex-col">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => zoomDelta(1)}
        className="h-9 w-9 rounded-none border-r border-border hover:bg-secondary sm:border-r-0 sm:border-b"
        aria-label={ui.map.zoomIn}
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => zoomDelta(-1)}
        className="h-9 w-9 rounded-none hover:bg-secondary"
        aria-label={ui.map.zoomOut}
      >
        <Minus className="h-4 w-4" />
      </Button>
    </div>
  );

  const mapBannerClass = cn(
    "pointer-events-none absolute z-20 text-center text-xs shadow-md backdrop-blur-sm",
    mapLayout === "route"
      ? "top-[max(0.75rem,env(safe-area-inset-top))] left-3 right-14 sm:left-[calc(22rem+0.75rem)] sm:right-4 sm:max-w-md sm:text-left"
      : "left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] max-w-[min(calc(100%-1.5rem),24rem)] -translate-x-1/2",
  );

  return (
    <div
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-muted/30"
      style={
        mapLayout === "route"
          ? ({ "--route-sheet-vh": mobileSheetVh } as React.CSSProperties)
          : undefined
      }
    >
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

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={containerRef}
          id="map"
          className="absolute inset-0 z-0 h-full w-full min-h-[1px]"
          role="presentation"
          style={pickMode ? { cursor: "crosshair" } : undefined}
        />
        {pickMode && (
          <div
            className={cn(
              mapBannerClass,
              "rounded-full bg-blue-600/95 px-4 py-1.5 font-medium text-white shadow-lg",
            )}
          >
            {pickMode === "origin" ? ui.map.pickOrigin : ui.map.pickDestination}
          </div>
        )}

        {navigationMode && followPaused && (
          <div
            className={cn(
              mapBannerClass,
              "rounded-lg border border-border bg-card/95 px-3 py-2 text-muted-foreground",
            )}
          >
            {ui.route.followPausedHint}
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        {/* 좌측: 경로 범례 — 모바일 길찾기에서는 패널에만 표시 */}
        <div
          className={cn(
            "pointer-events-auto absolute left-3 hidden flex-col gap-2 sm:left-4 sm:flex",
            mapLayout === "route" && "max-sm:hidden",
            leftOverlayBottomClass,
          )}
        >
          {routeLine && routeLine.length >= 2 && routeSegments && (
            <RouteLegend segmentTypes={routeSegments} variant="map" className="max-w-[11rem]" />
          )}
          {mapLayout === "route" && routeLine && routeLine.length >= 2 && routeElevators.length > 0 && (
            <div
              className="max-w-[11rem] rounded-lg border border-border/80 bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur-sm"
              role="note"
              aria-label={ui.map.elevatorOnRouteLegend}
            >
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white bg-white shadow-sm ring-2 ring-teal-600/35"
                  aria-hidden
                >
                  <img src={ELEVATOR_ICON_SRC} alt="" width={20} height={20} className="h-5 w-5 object-contain" />
                </span>
                <span className="font-semibold text-foreground">{ui.map.elevatorOnRouteLegend}</span>
              </div>
            </div>
          )}
        </div>

        {/* 우측: 줌 · 지도설정 · 경로 · 안내 */}
        {mapLayout === "explore" ? (
          <div
            className={cn(
              "pointer-events-auto absolute right-2 flex flex-col items-end gap-2 sm:right-3",
              exploreOverlayBottomClass,
            )}
          >
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
            <Button
              type="button"
              variant={controlsOpen ? "default" : "secondary"}
              size="icon"
              onClick={() => setControlsOpen((prev) => !prev)}
              className="h-9 w-9 shadow-md"
              aria-label={controlsOpen ? ui.map.mapOptionsClose : ui.map.mapOptionsOpen}
            >
              <SlidersHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            {zoomControlButtons}
          </div>
        ) : (
          <div
            className={cn(
              "pointer-events-auto absolute right-3 flex items-end gap-1.5 sm:right-4 sm:flex-col sm:items-end sm:gap-2",
              routeOverlayBottomClass,
            )}
          >
            {zoomControlButtons}
            {geoHintMessage && (
              <div className="max-w-[14rem] rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive shadow-md">
                {geoHintMessage}
              </div>
            )}
            <div className="flex flex-row items-center gap-1.5 sm:flex-col sm:items-end sm:gap-2">
              {navigationMode && (
                <Button
                  type="button"
                  variant={followPaused ? "default" : "secondary"}
                  size="icon"
                  onClick={handleNavigationLocatePress}
                  className={cn("h-9 w-9 shadow-md", followPaused && "ring-2 ring-primary/40")}
                  aria-label={followPaused ? ui.route.resumeFollow : ui.map.myLocationTitle}
                  title={followPaused ? ui.route.resumeFollow : ui.map.myLocationTitle}
                >
                  <Locate className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              )}
              {routeLine && routeLine.length >= 2 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={fitRouteOnMap}
                  className="h-9 w-9 shadow-md"
                  aria-label={ui.route.fitRoute}
                  title={ui.route.fitRoute}
                >
                  <Route className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              )}
              {directionsHref && directionsLabel ? (
                <Button
                  asChild
                  size="lg"
                  className="h-11 gap-2 rounded-full px-4 shadow-lg ring-2 ring-primary/25"
                >
                  <Link href={directionsHref}>
                    <Navigation className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-semibold">{directionsLabel}</span>
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {mapLayout === "explore" && directionsHref && directionsLabel ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 z-20 flex justify-center px-3 sm:px-4",
              "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
            )}
          >
            <Button
              asChild
              size="lg"
              className="pointer-events-auto h-12 max-w-[calc(100%-0.5rem)] gap-2 rounded-2xl px-6 text-sm font-bold shadow-2xl ring-2 ring-primary/30 hover:shadow-primary/25 sm:h-14 sm:max-w-none sm:gap-2.5 sm:px-8 sm:text-base"
            >
              <Link href={directionsHref}>
                <Navigation className="h-5 w-5 shrink-0" aria-hidden />
                {directionsLabel}
              </Link>
            </Button>
          </div>
        ) : null}
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
    </div>
  );
}

export const CampusMap = memo(CampusMapInner, campusMapPropsAreEqual);
