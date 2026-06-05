"use client";

import { useMemo, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  ArrowUpLeft,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  MapPin,
  LocateFixed,
  Map as MapIcon,
  Flag,
  X,
  ArrowUpDown,
  Volume2,
  VolumeX,
  Navigation,
  Footprints,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BarrierBuilding } from "@/lib/building-types";
import { formatDistance } from "@/lib/routing/geo";
import { ROUTE_LEGEND } from "@/lib/routing/style";
import type { ComputedRoute, ManeuverKind, RoutePoint, RouteStep } from "@/lib/routing/types";

type WhichPoint = "origin" | "destination";

interface RoutePanelProps {
  open: boolean;
  onClose: () => void;
  buildings: BarrierBuilding[];
  origin: RoutePoint | null;
  destination: RoutePoint | null;
  onSelectBuilding: (which: WhichPoint, building: BarrierBuilding) => void;
  onPickOnMap: (which: WhichPoint) => void;
  pickMode: WhichPoint | null;
  onUseCurrentLocation: (which: WhichPoint) => void;
  onClearPoint: (which: WhichPoint) => void;
  onSwap: () => void;
  route: ComputedRoute | null;
  routeError: string | null;
  navigating: boolean;
  onStartNav: () => void;
  onStopNav: () => void;
  currentStepIndex: number;
  remaining: number | null;
  voiceEnabled: boolean;
  onToggleVoice: (v: boolean) => void;
}

function maneuverIcon(maneuver: ManeuverKind) {
  switch (maneuver) {
    case "left":
      return <ArrowLeft className="h-4 w-4" />;
    case "slight-left":
      return <ArrowUpLeft className="h-4 w-4" />;
    case "right":
      return <ArrowRight className="h-4 w-4" />;
    case "slight-right":
      return <ArrowUpRight className="h-4 w-4" />;
    case "uturn":
      return <RotateCcw className="h-4 w-4" />;
    case "arrive":
      return <Flag className="h-4 w-4" />;
    default:
      return <ArrowUp className="h-4 w-4" />;
  }
}

/** 접근성을 고려한 여유 보행 속도 (약 0.9 m/s) */
const WALK_SPEED_MPS = 0.9;

function estimateMinutes(route: ComputedRoute): number {
  let seconds = route.distance / WALK_SPEED_MPS;
  // 횡단보도 대기, 계단/경사로 통과에 따른 추가 시간(여유분)
  for (const t of route.segmentTypes) {
    if (t === "crosswalk") seconds += 25;
    else if (t === "stairs") seconds += 20;
    else if (t === "ramp") seconds += 8;
  }
  // 회전이 많을수록 여유 시간 추가
  const turns = route.steps.filter(
    (s) => s.maneuver !== "depart" && s.maneuver !== "arrive" && s.maneuver !== "straight",
  ).length;
  seconds += turns * 5;
  return Math.max(1, Math.ceil(seconds / 60));
}

function PointField({
  which,
  label,
  value,
  buildings,
  pickActive,
  onSelectBuilding,
  onPickOnMap,
  onUseCurrentLocation,
  onClear,
}: {
  which: WhichPoint;
  label: string;
  value: RoutePoint | null;
  buildings: BarrierBuilding[];
  pickActive: boolean;
  onSelectBuilding: (b: BarrierBuilding) => void;
  onPickOnMap: () => void;
  onUseCurrentLocation: () => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openList, setOpenList] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? buildings.filter((b) => b.name.toLowerCase().includes(q))
      : buildings;
    return list.slice(0, 30);
  }, [buildings, query]);

  const dotColor = which === "origin" ? "bg-green-600" : "bg-red-600";

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor}`} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label={`${label} 지우기`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {value ? (
        <div className="flex items-center gap-2 rounded-md bg-secondary px-2.5 py-2 text-sm font-medium">
          {value.kind === "gps" ? (
            <LocateFixed className="h-4 w-4 text-blue-600" />
          ) : value.kind === "map" ? (
            <MapPin className="h-4 w-4 text-blue-600" />
          ) : (
            <MapPin className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="truncate">{value.label}</span>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpenList(true);
            }}
            onFocus={() => setOpenList(true)}
            placeholder="건물 이름 검색 또는 아래 버튼 사용"
            className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {openList && filtered.length > 0 && (
            <div className="mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-popover shadow-sm">
              {filtered.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="block w-full truncate px-2.5 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onSelectBuilding(b);
                    setQuery("");
                    setOpenList(false);
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={pickActive ? "default" : "secondary"}
              className="h-8 flex-1 gap-1 text-xs"
              onClick={onPickOnMap}
            >
              <MapIcon className="h-3.5 w-3.5" />
              지도에서 선택
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 flex-1 gap-1 text-xs"
              onClick={onUseCurrentLocation}
            >
              <LocateFixed className="h-3.5 w-3.5" />
              현재 위치
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function RoutePanel(props: RoutePanelProps) {
  const {
    open,
    onClose,
    buildings,
    origin,
    destination,
    onSelectBuilding,
    onPickOnMap,
    pickMode,
    onUseCurrentLocation,
    onClearPoint,
    onSwap,
    route,
    routeError,
    navigating,
    onStartNav,
    onStopNav,
    currentStepIndex,
    remaining,
    voiceEnabled,
    onToggleVoice,
  } = props;

  if (!open) return null;

  // 모바일: 하단 시트 / 데스크톱: 좌측 컬럼. 지도 선택 중에는 시트를 줄여 지도를 탭할 수 있게.
  const mobileHeight = pickMode ? "max-h-[32vh]" : "max-h-[80vh]";

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-30 flex ${mobileHeight} flex-col rounded-t-2xl border-t border-border bg-background shadow-xl transition-[max-height] duration-200 sm:inset-y-0 sm:left-0 sm:right-auto sm:max-h-none sm:w-[22rem] sm:rounded-none sm:border-r sm:border-t-0`}
    >
      {/* 모바일 드래그 핸들 */}
      <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted sm:hidden" />

      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="지도로 돌아가기"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>뒤로</span>
        </button>
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold">길찾기</h2>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {/* 출발/도착 입력 */}
        <div className="space-y-2">
          <PointField
            which="origin"
            label="출발지"
            value={origin}
            buildings={buildings}
            pickActive={pickMode === "origin"}
            onSelectBuilding={(b) => onSelectBuilding("origin", b)}
            onPickOnMap={() => onPickOnMap("origin")}
            onUseCurrentLocation={() => onUseCurrentLocation("origin")}
            onClear={() => onClearPoint("origin")}
          />

          <div className="flex justify-center">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-7 w-7 rounded-full"
              onClick={onSwap}
              aria-label="출발지와 도착지 교환"
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>

          <PointField
            which="destination"
            label="도착지"
            value={destination}
            buildings={buildings}
            pickActive={pickMode === "destination"}
            onSelectBuilding={(b) => onSelectBuilding("destination", b)}
            onPickOnMap={() => onPickOnMap("destination")}
            onUseCurrentLocation={() => onUseCurrentLocation("destination")}
            onClear={() => onClearPoint("destination")}
          />
        </div>

        {routeError && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{routeError}</span>
          </div>
        )}

        {/* 경로 요약 */}
        {route && (
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold leading-none">
                  약 {estimateMinutes(route)}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">분</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  총 {formatDistance(route.distance)} · 도보
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Footprints className="h-4 w-4" />
                보행로 기반
              </div>
            </div>
            {/* 색상 범례 — 경로에 실제 등장하는 종류만 표시 */}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {ROUTE_LEGEND.filter(
                (l) => l.type === "path" || route.segmentTypes.includes(l.type),
              ).map((l) => (
                <span key={l.type} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span
                    className="inline-block h-1 w-4 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  {l.label}
                </span>
              ))}
            </div>

            {route.hasStairs && (
              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                <TriangleAlert className="h-3.5 w-3.5" />
                경로에 계단이 포함되어 있습니다
              </div>
            )}

            <div className="mt-3 flex gap-2">
              {!navigating ? (
                <Button type="button" className="h-9 flex-1 gap-1.5" onClick={onStartNav}>
                  <Navigation className="h-4 w-4" />
                  안내 시작
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  className="h-9 flex-1 gap-1.5"
                  onClick={onStopNav}
                >
                  안내 중지
                </Button>
              )}
              <Button
                type="button"
                variant={voiceEnabled ? "secondary" : "outline"}
                size="icon"
                className="h-9 w-9"
                onClick={() => onToggleVoice(!voiceEnabled)}
                aria-label={voiceEnabled ? "음성 안내 끄기" : "음성 안내 켜기"}
                title={voiceEnabled ? "음성 안내 켜짐" : "음성 안내 꺼짐"}
              >
                {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </div>

            {navigating && remaining != null && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                남은 거리 {formatDistance(remaining)}
              </p>
            )}
          </div>
        )}

        {/* 턴바이턴 단계 */}
        {route && route.steps.length > 0 && (
          <ol className="space-y-1">
            {route.steps.map((step: RouteStep, idx: number) => {
              const active = navigating && idx === currentStepIndex;
              return (
                <li
                  key={idx}
                  className={`flex items-start gap-2.5 rounded-md border px-2.5 py-2 text-sm ${
                    active
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                      : "border-transparent"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      step.maneuver === "arrive"
                        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    }`}
                  >
                    {maneuverIcon(step.maneuver)}
                  </span>
                  <div className="min-w-0">
                    <p className="leading-snug">{step.text}</p>
                    {step.hazard && (
                      <p className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                        ⚠ {step.hazard}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {!route && !routeError && (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
            출발지와 도착지를 선택하면
            <br />
            보행로 기반 경로를 안내합니다.
          </p>
        )}
      </div>
    </div>
  );
}
