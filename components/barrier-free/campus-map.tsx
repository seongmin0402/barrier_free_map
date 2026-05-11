"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import Script from "next/script";
import { Plus, Minus, Locate } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  selectedIdRef.current = selectedBuilding;

  const centerMemo = useMemo(() => deriveCenter(buildings), [buildings]);

  const teardown = useCallback(() => {
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

    const MarkerCtor = maps.Marker as unknown as new (opts: Record<string, unknown>) => {
      setMap: (target: typeof map | null) => void;
    };

    const InfoWindowCtor = maps.InfoWindow as unknown as new (opts: Record<string, unknown>) => {
      open: (m: typeof map, marker: unknown) => void;
      close: () => void;
    };

    const PointCtor = maps.Point as new (x: number, y: number) => unknown;

    const EventTrigger = maps.Event as unknown as { trigger?: (target: unknown, evt: string) => void };

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        try {
          EventTrigger.trigger?.(map, "resize");
        } catch {
          /* ignore */
        }
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

        const firstLine = building.description.split(/\r?\n/).find((line) => line.trim()) ?? "";
        const snippet = firstLine.length > 140 ? `${firstLine.slice(0, 140)}…` : firstLine;

        const iw = new InfoWindowCtor({
          content: `<div style="padding:10px 12px;max-width:280px;font-size:12px;line-height:1.5;border-radius:10px;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.2);color:#111;">
            <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(building.name)}</div>
            <div style="color:#555;margin-bottom:6px;">${escapeHtml(building.floorLabel)} · 등급 ${escapeHtml(building.accessibilityLevel)}</div>
            <div style="color:#333;">${escapeHtml(snippet || "상세 설명이 없습니다.")}</div>
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
      try {
        EventTrigger.trigger?.(map, "resize");
      } catch {
        /* ignore */
      }
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
    <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/30">
      <Script id="naver-maps-sdk" strategy="afterInteractive" src={scriptSrc} onLoad={() => setSdkLoaded(true)} />

      <div ref={containerRef} className="absolute inset-0" role="presentation" />

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute right-4 bottom-4 flex flex-col gap-2">
          <Button type="button" variant="secondary" size="icon" onClick={() => zoomDelta(1)} className="shadow-md" aria-label="확대">
            <Plus className="h-5 w-5" />
          </Button>
          <Button type="button" variant="secondary" size="icon" onClick={() => zoomDelta(-1)} className="shadow-md" aria-label="축소">
            <Minus className="h-5 w-5" />
          </Button>
          <Button type="button" variant="secondary" size="icon" onClick={showCampusOverview} className="shadow-md" aria-label="캠퍼스 전체 보기">
            <Locate className="h-5 w-5" />
          </Button>
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
    </div>
  );
}
