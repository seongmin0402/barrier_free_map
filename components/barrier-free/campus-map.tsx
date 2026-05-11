"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import Script from "next/script";
import { Plus, Minus, Locate, Maximize2 } from "lucide-react";
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

/** 등급 색의 위치 핀 + 등급 글자 (CSV 기반 건물 마커) */
function pinMarkerHtml(hex: string, level: string) {
  const L = escapeHtml(level.slice(0, 1).toUpperCase());
  const fill = escapeHtml(hex);
  return `<div aria-hidden="true" style="width:36px;height:44px;">
    <svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
      <path fill="${fill}" stroke="#fff" stroke-width="2" d="M18 2C10.8 2 5 7.6 5 14.2c0 7.8 11.5 25.5 12 26.4.4-.9 13-18.6 13-26.4C30 7.6 24.2 2 18 2z"/>
      <circle cx="18" cy="14" r="6.5" fill="#fff"/>
      <text x="18" y="16.5" text-anchor="middle" font-size="10" font-weight="700" fill="${fill}" font-family="system-ui,sans-serif">${L}</text>
    </svg>
  </div>`;
}

type NMaps = NonNullable<Window["naver"]>["maps"];

const MAP_TYPE_OPTIONS = [
  { id: "NORMAL", label: "일반" },
  { id: "TERRAIN", label: "지형" },
  { id: "SATELLITE", label: "위성" },
  { id: "HYBRID", label: "하이브리드" },
] as const;

type MapTypeOptionId = (typeof MAP_TYPE_OPTIONS)[number]["id"];

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
  const markersRef = useRef<Array<{ setMap: (map: unknown) => void }>>([]);
  const activeInfoRef = useRef<{ close: () => void } | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const myLocationMarkerRef = useRef<{ setMap: (v: unknown) => void; setPosition?: (p: unknown) => void } | null>(null);
  const geoWatchIdRef = useRef<number | null>(null);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [geoHintMessage, setGeoHintMessage] = useState<string | null>(null);
  const [locationTracking, setLocationTracking] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [mapTypeKey, setMapTypeKey] = useState<MapTypeOptionId>("NORMAL");

  selectedIdRef.current = selectedBuilding;

  const centerMemo = useMemo(() => deriveCenter(buildings), [buildings]);

  const teardown = useCallback(() => {
    if (geoWatchIdRef.current != null && typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      } catch {
        /* ignore */
      }
      geoWatchIdRef.current = null;
    }
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

    markersRef.current.forEach((marker) => {
      try {
        marker.setMap(null);
      } catch {
        /* ignore */
      }
    });
    markersRef.current = [];

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

      const marker = new MarkerCtor({
        map,
        position: new LatLngCtor(building.lat, building.lng),
        title: `${building.name} · 등급 ${building.accessibilityLevel}`,
        icon: {
          content: pinMarkerHtml(color, building.accessibilityLevel),
          anchor: new PointCtor(18, 44),
        },
      });

      markersRef.current.push(marker);

      maps.Event.addListener(marker, "click", () => {
        try {
          activeInfoRef.current?.close();
        } catch {
          /* ignore */
        }

        onBuildingSelect(building.id);

        const raw = (building.description ?? "").trim();
        const maxChars = 900;
        const clipped = raw.length > maxChars ? `${raw.slice(0, maxChars)}…` : raw;
        const detailHtml = clipped
          ? escapeHtml(clipped).replace(/\r\n|\n|\r/g, "<br/>")
          : "상세 설명이 없습니다.";

        const iw = new InfoWindowCtor({
          content: `<div style="padding:10px 12px;max-width:min(92vw,340px);max-height:min(50vh,260px);overflow:auto;font-size:12px;line-height:1.5;border-radius:10px;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.2);color:#111;">
            <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(building.name)}</div>
            <div style="color:#555;margin-bottom:8px;">${escapeHtml(building.floorLabel)} · 등급 ${escapeHtml(building.accessibilityLevel)}</div>
            <div style="color:#333;">${detailHtml}</div>
            <div style="margin-top:8px;font-size:11px;color:#888;">아래 패널에서 사진·시설 정보를 확인할 수 있습니다.</div>
          </div>`,
          borderWidth: 0,
          backgroundColor: "transparent",
        });

        iw.open(map, marker);
        activeInfoRef.current = iw;
      });
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
  }, [sdkLoaded, clientId, centerMemo.lat, centerMemo.lng, buildings, teardown, onBuildingSelect]);

  useEffect(() => {
    if (!selectedBuilding) return;

    const b = buildings.find((x) => x.id === selectedBuilding);
    if (!b || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return;

    const map = mapInstanceRef.current as undefined | {
      panTo?: (ll: unknown, opts?: unknown) => void;
      setZoom?: (z: number) => void;
    };
    if (!map?.panTo) return;

    const maps = window.naver?.maps as NMaps | undefined;
    if (!maps?.LatLng) return;
    const Ll = maps.LatLng as new (a: number, c: number) => unknown;

    map.panTo(new Ll(b.lat, b.lng), { duration: 280 });
    map.setZoom?.(17);
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
      if (geoWatchIdRef.current != null && typeof navigator !== "undefined" && navigator.geolocation) {
        try {
          navigator.geolocation.clearWatch(geoWatchIdRef.current);
        } catch {
          /* ignore */
        }
        geoWatchIdRef.current = null;
      }
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

    if (geoWatchIdRef.current != null) {
      try {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      } catch {
        /* ignore */
      }
      geoWatchIdRef.current = null;
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
      const mp = map as {
        panTo?: (ll: unknown, o?: unknown) => void;
        setZoom?: (z: number) => void;
        relayout?: () => void;
      };
      mp.panTo?.(ll, { duration: 320 });
      mp.setZoom?.(17);
      try {
        mp.relayout?.();
      } catch {
        /* ignore */
      }
      try {
        (maps.Event as { trigger?: (t: unknown, e: string) => void }).trigger?.(map, "resize");
      } catch {
        /* ignore */
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoHintMessage(null);
        setLocationTracking(true);
        applyCoords(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocationTracking(false);
        let msg = "위치를 가져올 수 없습니다.";
        if (err.code === 1) msg = "위치 권한이 거부되었습니다.";
        else if (err.code === 2) msg = "위치를 확인할 수 없습니다.";
        else if (err.code === 3) msg = "위치 확인 시간이 초과되었습니다.";
        setGeoHintMessage(msg);
        if (geoWatchIdRef.current != null) {
          try {
            navigator.geolocation.clearWatch(geoWatchIdRef.current);
          } catch {
            /* ignore */
          }
          geoWatchIdRef.current = null;
        }
        try {
          myLocationMarkerRef.current?.setMap(null);
        } catch {
          /* ignore */
        }
        myLocationMarkerRef.current = null;
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    geoWatchIdRef.current = watchId;
  }, []);

  const stopLocationTracking = useCallback(() => {
    if (geoWatchIdRef.current != null && typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      } catch {
        /* ignore */
      }
      geoWatchIdRef.current = null;
    }
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
        <div className="pointer-events-auto absolute top-4 right-4 flex max-w-[min(100%,20rem)] flex-wrap justify-end gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-lg backdrop-blur-sm">
          <span className="w-full px-2 pt-1 text-[10px] font-medium text-muted-foreground">지도 유형</span>
          <div className="flex w-full flex-wrap gap-1 px-1 pb-1">
            {mapTypeButtons.map((opt) => (
              <Button
                key={opt.id}
                type="button"
                size="sm"
                variant={mapTypeKey === opt.id ? "default" : "secondary"}
                className="h-8 flex-1 text-xs sm:flex-none"
                disabled={!sdkLoaded}
                onClick={() => applyMapType(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="pointer-events-auto absolute right-4 bottom-4 flex flex-col items-end gap-2">
          {geoHintMessage && (
            <div className="max-w-[14rem] rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive shadow-md">
              {geoHintMessage}
            </div>
          )}
          <div className="flex flex-col gap-2">
          <Button type="button" variant="secondary" size="icon" onClick={() => zoomDelta(1)} className="shadow-md" aria-label="확대">
            <Plus className="h-5 w-5" />
          </Button>
          <Button type="button" variant="secondary" size="icon" onClick={() => zoomDelta(-1)} className="shadow-md" aria-label="축소">
            <Minus className="h-5 w-5" />
          </Button>
          <Button type="button" variant="secondary" size="icon" onClick={showCampusOverview} className="shadow-md" aria-label="캠퍼스 전체 보기" title="캠퍼스 전체 보기">
            <Maximize2 className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant={locationTracking ? "default" : "secondary"}
            size="icon"
            onClick={() => {
              if (locationTracking) stopLocationTracking();
              else setLocationDialogOpen(true);
            }}
            className="shadow-md"
            disabled={!sdkLoaded}
            aria-label={locationTracking ? "내 위치 추적 중지" : "내 위치로 이동"}
            title={locationTracking ? "내 위치 추적 중지" : "내 위치로 이동"}
          >
            <Locate className="h-5 w-5" />
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
