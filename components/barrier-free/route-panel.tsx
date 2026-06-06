"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/components/app-settings-provider";
import type { BarrierBuilding } from "@/lib/building-types";
import { useUi } from "@/hooks/use-ui";
import { remainingDistanceLabel } from "@/lib/i18n/navigation";
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
  onStartNav: () => void | Promise<void>;
  onStopNav: () => void;
  currentStepIndex: number;
  remaining: number | null;
  voiceEnabled: boolean;
  onToggleVoice: (v: boolean) => void;
  offRouteM?: number | null;
  rerouteNotice?: boolean;
  onSettingsClick?: () => void;
  onSheetVhChange?: (vh: number) => void;
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

/** 접근성을 고려한 여유 보행 속도 (약 0.7 m/s) */
const WALK_SPEED_MPS = 0.7;

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
  showDot = true,
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
  showDot?: boolean;
}) {
  const ui = useUi();
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
        {showDot ? (
          <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
        ) : null}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label={ui.route.clearPoint(label)}
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
            placeholder={ui.route.searchPlaceholder}
            className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
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
              {ui.route.pickOnMap}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 flex-1 gap-1 text-xs"
              onClick={onUseCurrentLocation}
            >
              <LocateFixed className="h-3.5 w-3.5" />
              {ui.route.currentLocation}
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
    offRouteM = null,
    rerouteNotice = false,
    onSettingsClick,
    onSheetVhChange,
  } = props;

  const { locale } = useAppSettings();
  const ui = useUi();
  const SNAP_PEEK = 32;
  const SNAP_HALF = 54;
  const SNAP_FULL = 86;
  const [isMobile, setIsMobile] = useState(false);
  const [sheetVh, setSheetVh] = useState<number>(SNAP_FULL);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startVh: number; moved: boolean } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // 상태에 따라 기본 높이 자동 조정 (지도가 보이게 낮춤). 이후 드래그로 자유 조절 가능.
  useEffect(() => {
    if (pickMode) setSheetVh(SNAP_PEEK);
    else if (navigating) setSheetVh(SNAP_HALF);
    else if (route) setSheetVh(SNAP_HALF);
    else setSheetVh(SNAP_FULL);
  }, [route, navigating, pickMode]);

  useEffect(() => {
    onSheetVhChange?.(sheetVh);
  }, [sheetVh, onSheetVhChange]);

  const routeSummaryRef = useRef<HTMLDivElement>(null);

  const handleStartNav = useCallback(() => {
    onStartNav();
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) {
      requestAnimationFrame(() => {
        routeSummaryRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
  }, [onStartNav]);

  const onHandleDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isMobile) return;
      dragRef.current = { startY: e.clientY, startVh: sheetVh, moved: false };
      setDragging(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [isMobile, sheetVh],
  );

  const onHandleMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dyPx = d.startY - e.clientY; // 위로 끌면 +
    if (Math.abs(dyPx) > 4) d.moved = true;
    const dyVh = (dyPx / window.innerHeight) * 100;
    setSheetVh(Math.min(92, Math.max(12, d.startVh + dyVh)));
  }, []);

  const onHandleUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!d) return;
    if (!d.moved) {
      // 단순 탭: 미리보기 ↔ 전체 토글
      setSheetVh((v) => (v > SNAP_HALF ? SNAP_PEEK : SNAP_FULL));
      return;
    }
    // 가장 가까운 스냅 지점으로 정렬
    const points = [SNAP_PEEK, SNAP_HALF, SNAP_FULL];
    setSheetVh((v) => points.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)));
  }, []);

  if (!open) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 flex max-h-[92vh] flex-col rounded-t-2xl border-t border-border bg-background shadow-xl sm:inset-y-0 sm:left-0 sm:right-auto sm:h-auto sm:max-h-none sm:w-[22rem] sm:rounded-none sm:border-r sm:border-t-0"
      style={
        isMobile
          ? {
              height: `${sheetVh}vh`,
              transition: dragging ? "none" : "height 320ms cubic-bezier(0.32, 0.72, 0, 1)",
            }
          : undefined
      }
    >
      {/* 모바일 드래그 핸들 — 손으로 끌어 높이 조절, 탭하면 토글 */}
      <div
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
        className="flex shrink-0 cursor-grab touch-none flex-col items-center justify-center py-3 active:cursor-grabbing sm:hidden"
        role="separator"
        aria-label={ui.route.sheetResize}
      >
        <span className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
      </div>

      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={ui.route.back}
        >
          <ArrowLeft className="h-5 w-5" />
          <span>{ui.route.back}</span>
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Navigation className="h-5 w-5 shrink-0 text-blue-600" />
          <h2 className="truncate text-base font-semibold">{ui.route.title}</h2>
        </div>
        {onSettingsClick ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onSettingsClick}
            aria-label={ui.header.settingsAria}
          >
            <Settings className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain scroll-smooth p-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
      >
        {/* 출발/도착 입력 — 좌측 점·점선으로 구간 연결 */}
        <div className="flex gap-3">
          <div className="relative flex w-4 shrink-0 flex-col items-center pt-5 pb-5">
            <span
              className="h-3 w-3 shrink-0 rounded-full bg-green-600 ring-2 ring-green-600/25"
              aria-hidden
            />
            <div
              className="my-1 min-h-6 w-0 flex-1 border-l-2 border-dashed border-muted-foreground/40"
              aria-hidden
            />
            <span
              className="h-3 w-3 shrink-0 rounded-full bg-red-600 ring-2 ring-red-600/25"
              aria-hidden
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background shadow-sm"
              onClick={onSwap}
              aria-label={ui.route.swap}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <PointField
              which="origin"
              label={ui.route.origin}
              value={origin}
              buildings={buildings}
              pickActive={pickMode === "origin"}
              onSelectBuilding={(b) => onSelectBuilding("origin", b)}
              onPickOnMap={() => onPickOnMap("origin")}
              onUseCurrentLocation={() => onUseCurrentLocation("origin")}
              onClear={() => onClearPoint("origin")}
              showDot={false}
            />

            <PointField
              which="destination"
              label={ui.route.destination}
              value={destination}
              buildings={buildings}
              pickActive={pickMode === "destination"}
              onSelectBuilding={(b) => onSelectBuilding("destination", b)}
              onPickOnMap={() => onPickOnMap("destination")}
              onUseCurrentLocation={() => onUseCurrentLocation("destination")}
              onClear={() => onClearPoint("destination")}
              showDot={false}
            />
          </div>
        </div>

        {routeError && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{routeError}</span>
          </div>
        )}

        {navigating && offRouteM != null && offRouteM > 40 && !rerouteNotice && (
          <div className="flex items-start gap-2 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{ui.route.offRouteWarning}</span>
          </div>
        )}

        {rerouteNotice && (
          <div className="flex items-start gap-2 rounded-md border border-green-500 bg-green-50 px-3 py-2 text-xs text-green-900 dark:border-green-800 dark:bg-green-950/50 dark:text-green-100">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{ui.route.reroutedNotice}</span>
          </div>
        )}

        {/* 경로 요약 */}
        {route && (
          <div ref={routeSummaryRef} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold leading-none">
                  {ui.route.aboutMinutes} {estimateMinutes(route)}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">{ui.route.min}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ui.route.total} {formatDistance(route.distance, locale)} · {ui.route.walking}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Footprints className="h-4 w-4" />
                {ui.route.walkwayBased}
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
                  {ui.route.legend[l.type]}
                </span>
              ))}
            </div>

            {route.hasStairs && (
              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                <TriangleAlert className="h-3.5 w-3.5" />
                {ui.route.stairsWarning}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              {!navigating ? (
                <Button type="button" className="h-9 flex-1 gap-1.5" onClick={handleStartNav}>
                  <Navigation className="h-4 w-4" />
                  {ui.route.startNav}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  className="h-9 flex-1 gap-1.5"
                  onClick={onStopNav}
                >
                  {ui.route.stopNav}
                </Button>
              )}
              <Button
                type="button"
                variant={voiceEnabled ? "secondary" : "outline"}
                size="icon"
                className="h-9 w-9"
                onClick={() => onToggleVoice(!voiceEnabled)}
                aria-label={voiceEnabled ? ui.route.voiceOn : ui.route.voiceOff}
                title={voiceEnabled ? ui.route.voiceOnTitle : ui.route.voiceOffTitle}
              >
                {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </div>

            {navigating && (
              <p className="mt-2 text-center text-xs font-medium text-blue-700 dark:text-blue-300">
                {remaining != null
                  ? `${ui.route.navActive} · ${remainingDistanceLabel(locale)} ${formatDistance(remaining, locale)}`
                  : ui.route.acquiringGps}
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
            {ui.route.emptyHint1}
            <br />
            {ui.route.emptyHint2}
          </p>
        )}
      </div>
    </div>
  );
}
