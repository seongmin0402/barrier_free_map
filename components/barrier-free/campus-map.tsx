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
import { sortFloorTokens } from "@/lib/floor-sort";

interface CampusMapProps {
  buildings: BarrierBuilding[];
  selectedBuilding: string | null;
  onBuildingSelect: (id: string) => void;
}

/** CURSOR_PROMPT 접근성 색상 */
const levelHex: Record<string, string> = {
  A: "#22A557",
  B: "#F5A623",
  C: "#DC3545",
};

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

/** 등급 색의 위치 핀 + 등급 글자. selected 시 파란 사각형(핀 바운딩 박스)으로 감쌈 */
function pinMarkerHtml(hex: string, level: string, selected: boolean) {
  const L = escapeHtml(level.slice(0, 1).toUpperCase());
  const fill = escapeHtml(hex);
  const pinSvg = `<svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
      <path fill="${fill}" stroke="#fff" stroke-width="2" d="M18 2C10.8 2 5 7.6 5 14.2c0 7.8 11.5 25.5 12 26.4.4-.9 13-18.6 13-26.4C30 7.6 24.2 2 18 2z"/>
      <circle cx="18" cy="14" r="6.5" fill="#fff"/>
      <text x="18" y="16.5" text-anchor="middle" font-size="10" font-weight="700" fill="${fill}" font-family="system-ui,sans-serif">${L}</text>
    </svg>`;
  const pinWrapStyle = selected
    ? "position:relative;z-index:1;line-height:0;margin-bottom:0;box-sizing:border-box;border-radius:4px;background:rgba(37,99,235,0.14);box-shadow:0 0 0 4px #2563eb,0 4px 12px rgba(37,99,235,0.35);"
    : "position:relative;z-index:1;line-height:0;margin-bottom:0;";
  return `<div aria-hidden="true" style="position:relative;width:44px;height:52px;display:flex;align-items:flex-end;justify-content:center;box-sizing:border-box;overflow:visible;">
    <div style="${pinWrapStyle}">${pinSvg}</div>
  </div>`;
}

/** 마커 클릭 시 InfoWindow용 DOM (우측 상단 닫기) */
function createBuildingInfoWindowElement(
  building: BarrierBuilding,
  onClose: () => void,
): HTMLElement {
  const raw = (building.description ?? "").trim();
  const maxChars = 900;
  const clipped = raw.length > maxChars ? `${raw.slice(0, maxChars)}…` : raw;
  const detailHtml = clipped
    ? escapeHtml(clipped).replace(/\r\n|\n|\r/g, "<br/>")
    : "상세 설명이 없습니다.";

  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:relative;box-sizing:border-box;max-width:min(92vw,340px);max-height:min(50vh,260px);overflow:auto;font-size:12px;line-height:1.5;border-radius:10px;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.2);color:#111;padding:10px 12px;padding-top:36px;";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "닫기");
  closeBtn.style.cssText =
    "position:absolute;top:6px;right:6px;z-index:2;width:28px;height:28px;margin:0;border:0;border-radius:8px;background:#f3f4f6;cursor:pointer;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;color:#374151;";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  });

  const title = document.createElement("div");
  title.style.cssText = "font-weight:700;margin-bottom:4px;padding-right:32px;";
  title.textContent = building.name;

  const sub = document.createElement("div");
  sub.style.cssText = "color:#555;margin-bottom:8px;";
  sub.textContent = `${building.floorLabel?.trim() ? sortFloorTokens(building.floorLabel) : "—"} · 등급 ${building.accessibilityLevel}`;

  const detail = document.createElement("div");
  detail.style.color = "#333";
  detail.innerHTML = detailHtml;

  const foot = document.createElement("div");
  foot.style.cssText = "margin-top:8px;font-size:11px;color:#888;";
  foot.textContent = "지도 위 요약 카드에서 「자세히 보기」로 전체 정보·사진을 볼 수 있습니다.";

  wrap.appendChild(closeBtn);
  wrap.appendChild(title);
  wrap.appendChild(sub);
  wrap.appendChild(detail);
  wrap.appendChild(foot);

  return wrap;
}

type NMaps = NonNullable<Window["naver"]>["maps"];

const MAP_TYPE_OPTIONS = [
  { id: "NORMAL", label: "일반" },
  { id: "TERRAIN", label: "지형" },
  { id: "SATELLITE", label: "위성" },
  { id: "HYBRID", label: "하이브리드" },
] as const;

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

type MapTypeOptionId = (typeof MAP_TYPE_OPTIONS)[number]["id"];

function labelMarkerHtml(name: string) {
  const safeName = escapeHtml(name);
  return `<div aria-hidden="true" style="max-width:260px;padding:0;background:transparent;border:0;box-shadow:none;font-size:12px;line-height:1.25;font-weight:600;color:#2f5ea8;letter-spacing:-0.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:-1px -1px 0 rgba(255,255,255,.95),1px -1px 0 rgba(255,255,255,.95),-1px 1px 0 rgba(255,255,255,.95),1px 1px 0 rgba(255,255,255,.95),0 0 2px rgba(255,255,255,.95);">${safeName}</div>`;
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

export function CampusMap({ buildings, selectedBuilding, onBuildingSelect }: CampusMapProps) {
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markersRef = useRef<
    Array<{
      buildingId: string;
      marker: {
        setMap: (map: unknown) => void;
        setIcon?: (opts: Record<string, unknown>) => void;
        setZIndex?: (z: number) => void;
      };
    }>
  >([]);
  const manualLabelMarkersRef = useRef<Array<{ setMap: (target: unknown) => void }>>([]);
  const activeInfoRef = useRef<{ close: () => void } | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const myLocationMarkerRef = useRef<{ setMap: (v: unknown) => void; setPosition?: (p: unknown) => void } | null>(null);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [geoHintMessage, setGeoHintMessage] = useState<string | null>(null);
  const [locationTracking, setLocationTracking] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [mapTypeKey, setMapTypeKey] = useState<MapTypeOptionId>("NORMAL");
  const [controlsOpen, setControlsOpen] = useState(false);

  selectedIdRef.current = selectedBuilding;

  const centerMemo = useMemo(() => deriveCenter(buildings), [buildings]);

  const teardown = useCallback(() => {
    setLocationTracking(false);

    try {
      myLocationMarkerRef.current?.setMap(null);
    } catch {
      /* ignore */
    }
    myLocationMarkerRef.current = null;

    try {
      activeInfoRef.current?.close();
    } catch {
      /* ignore */
    }
    activeInfoRef.current = null;

    try {
      resizeObsRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    resizeObsRef.current = null;

    markersRef.current.forEach(({ marker }) => {
      try {
        marker.setMap(null);
      } catch {
        /* ignore */
      }
    });
    markersRef.current = [];
    manualLabelMarkersRef.current.forEach((marker) => {
      try {
        marker.setMap(null);
      } catch {
        /* ignore */
      }
    });
    manualLabelMarkersRef.current = [];

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
    if (!maps?.Map || !maps.LatLng || !maps.Marker || !maps.Event?.addListener || !maps.InfoWindow || !maps.Point) return;

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

    const InfoWindowCtor = maps.InfoWindow as unknown as new (opts: Record<string, unknown>) => {
      open: (m: typeof map, marker: unknown) => void;
      close: () => void;
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

    for (const building of buildings) {
      if (!Number.isFinite(building.lat) || !Number.isFinite(building.lng)) continue;

      const color = levelHex[building.accessibilityLevel] ?? levelHex.B;
      const isSelected = building.id === selectedIdRef.current;

      const marker = new MarkerCtor({
        map,
        position: new LatLngCtor(building.lat, building.lng),
        title: `${building.name} · 등급 ${building.accessibilityLevel}`,
        zIndex: isSelected ? 800 : 1,
        icon: {
          content: pinMarkerHtml(color, building.accessibilityLevel, isSelected),
          anchor: new PointCtor(22, 52),
        },
      });

      markersRef.current.push({ buildingId: building.id, marker });

      maps.Event.addListener(marker, "click", () => {
        try {
          activeInfoRef.current?.close();
        } catch {
          /* ignore */
        }

        onBuildingSelect(building.id);

        let iwRef: { close: () => void } | undefined;
        const el = createBuildingInfoWindowElement(building, () => {
          try {
            iwRef?.close();
          } catch {
            /* ignore */
          }
          activeInfoRef.current = null;
        });

        const iw = new InfoWindowCtor({
          content: el,
          borderWidth: 0,
          backgroundColor: "transparent",
        });
        iwRef = iw;
        iw.open(map, marker);
        activeInfoRef.current = iw;
      });
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
  }, [sdkLoaded, clientId, centerMemo.lat, centerMemo.lng, buildings, teardown, onBuildingSelect]);

  /** 선택 변경 시 마커 아이콘·z-index만 갱신 (지도 재생성 없이) */
  useEffect(() => {
    if (!sdkLoaded) return;
    const maps = window.naver?.maps as NMaps | undefined;
    if (!maps?.Point || markersRef.current.length === 0) return;
    const PointCtor = maps.Point as new (x: number, y: number) => unknown;
    for (const { buildingId, marker } of markersRef.current) {
      const b = buildings.find((x) => x.id === buildingId);
      if (!b) continue;
      const color = levelHex[b.accessibilityLevel] ?? levelHex.B;
      const isSel = buildingId === selectedBuilding;
      try {
        marker.setIcon?.({
          content: pinMarkerHtml(color, b.accessibilityLevel, isSel),
          anchor: new PointCtor(22, 52),
        });
        marker.setZIndex?.(isSel ? 800 : 1);
      } catch {
        /* ignore */
      }
    }
  }, [selectedBuilding, buildings, sdkLoaded]);

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
    if (typeof window === "undefined") return [...MAP_TYPE_OPTIONS];
    const m = window.naver?.maps as { MapTypeId?: Record<string, unknown> } | undefined;
    if (!m?.MapTypeId) return [...MAP_TYPE_OPTIONS];
    return MAP_TYPE_OPTIONS.filter((opt) => m.MapTypeId![opt.id] !== undefined);
  }, [sdkLoaded]);

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
      setGeoHintMessage("이 브라우저는 위치 정보를 지원하지 않습니다.");
      return;
    }
    const maps = window.naver?.maps as NMaps | undefined;
    const map = mapInstanceRef.current;
    if (!maps?.LatLng || !maps?.Marker || !maps?.Point || !map) {
      setGeoHintMessage("지도가 준비된 뒤 다시 시도해 주세요.");
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
          title: "내 위치",
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
        let msg = "위치를 가져올 수 없습니다.";
        if (err.code === 1) msg = "위치 권한이 거부되었습니다.";
        else if (err.code === 2) msg = "위치를 확인할 수 없습니다.";
        else if (err.code === 3) msg = "위치 확인 시간이 초과되었습니다.";
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
  }, []);

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
          <p className="font-semibold text-foreground">네이버 지도 클라이언트 ID 필요</p>
          <p className="text-sm text-muted-foreground">
            네이버 클라우드 플랫폼에서 Dynamic Map을 활성화한 애플리케이션 클라이언트 ID를{" "}
            <code className="rounded bg-muted px-1">NEXT_PUBLIC_NAVER_MAP_CLIENT_ID</code> 에 넣어 주세요. Vercel 프로젝트
            설정에도 같은 환경 변수를 추가해야 배포 환경에서 지도가 열립니다.
          </p>
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
          네이버 지도를 불러오는 중…
        </div>
      )}

      {scriptError && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-muted/60 p-6 text-center">
          <div className="max-w-md rounded-lg border border-border bg-card p-4 text-sm text-foreground shadow-sm">
            <p className="font-medium">지도 스크립트를 불러오지 못했습니다.</p>
            <p className="mt-2 text-muted-foreground">
              네이버 클라우드에서 이 도메인을 허용했는지, <code className="rounded bg-muted px-1">NEXT_PUBLIC_NAVER_MAP_CLIENT_ID</code>가
              빌드에 포함됐는지 확인한 뒤 새로고침 해 주세요.
            </p>
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {/* 네이버 지도: 부모 높이가 잡힌 뒤 relayout으로 타일 표시 */}
        <div ref={containerRef} id="map" className="absolute inset-0 z-0 h-full w-full min-h-[1px]" role="presentation" />
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
              <p className="mb-1 px-1 text-[10px] font-medium text-muted-foreground">지도 옵션</p>
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
                  aria-label="캠퍼스 전체 보기"
                >
                  <Maximize2 className="h-4 w-4" />
                  전체 보기
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
                  aria-label="내 위치 표시"
                >
                  <Locate className="h-4 w-4" />
                  내 위치
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button type="button" variant="secondary" size="icon" onClick={() => zoomDelta(1)} className="shadow-md" aria-label="확대">
              <Plus className="h-5 w-5" />
            </Button>
            <Button type="button" variant="secondary" size="icon" onClick={() => zoomDelta(-1)} className="shadow-md" aria-label="축소">
              <Minus className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant={controlsOpen ? "default" : "secondary"}
              size="icon"
              onClick={() => setControlsOpen((prev) => !prev)}
              className="shadow-md"
              aria-label={controlsOpen ? "지도 옵션 닫기" : "지도 옵션 열기"}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="pointer-events-auto absolute left-4 bottom-4 rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
          <h4 className="mb-2 text-xs font-semibold text-foreground">마커 등급</h4>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: levelHex.A }} />
              <span className="text-xs text-muted-foreground">A 우수</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: levelHex.B }} />
              <span className="text-xs text-muted-foreground">B 양호</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: levelHex.C }} />
              <span className="text-xs text-muted-foreground">C 개선필요</span>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <AlertDialogContent className="z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>현재 위치를 사용할까요?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              지도에서 내 위치를 표시하려면 기기의 위치 정보가 필요합니다. 아래에서 동의하면 브라우저에서 위치 접근 허용 여부를
              추가로 묻습니다. 허용하지 않으면 내 위치를 표시할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setLocationDialogOpen(false)}>
              취소
            </Button>
            <Button
              type="button"
              onClick={() => {
                setLocationDialogOpen(false);
                beginLocationTracking();
              }}
            >
              위치 사용에 동의합니다
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
