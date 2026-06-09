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
  ChevronDown,
  ChevronUp,
  Pencil,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Navigation,
  Footprints,
  TriangleAlert,
  Settings,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallGuideDialog } from "@/components/barrier-free/install-guide-dialog";
import { useAppSettings } from "@/components/app-settings-provider";
import type { BarrierBuilding } from "@/lib/building-types";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { useUi } from "@/hooks/use-ui";
import { shortBuildingName } from "@/lib/building-display-name";
import { remainingDistanceLabel } from "@/lib/i18n/navigation";
import { formatDistance } from "@/lib/routing/geo";
import { OFF_ROUTE_WARN_M } from "@/lib/routing/nav-thresholds";
import type { NavMetricsDisplayRef } from "@/hooks/use-navigation";
import { useNavMetricsDisplay } from "@/hooks/use-nav-metrics-display";
import { routesAreDistinct } from "@/lib/routing/route";
import { estimateWalkMinutes } from "@/lib/routing/route-estimate";
import { stepDisplayMeta, stepManeuverStyle } from "@/lib/routing/step-display";
import { isUnsurveyedBuilding } from "@/lib/merge-campus-buildings";
import { RouteLegend } from "@/components/barrier-free/route-legend";
import type {
  ComputedRoute,
  ManeuverKind,
  RoutePoint,
  RouteProfile,
  RouteStep,
} from "@/lib/routing/types";
import { cn } from "@/lib/utils";

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
  routeFast?: ComputedRoute | null;
  routeComfort?: ComputedRoute | null;
  routeProfile?: RouteProfile;
  onRouteProfileChange?: (profile: RouteProfile) => void;
  routeError: string | null;
  navigating: boolean;
  onStartNav: () => void;
  onStopNav: () => void;
  currentStepIndex: number;
  remaining: number | null;
  metricsDisplayRef?: NavMetricsDisplayRef;
  voiceEnabled: boolean;
  onToggleVoice: (v: boolean) => void;
  liveAnnouncement?: string;
  offRouteM?: number | null;
  rerouteNotice?: boolean;
  onSettingsClick?: () => void;
  onSheetVhChange?: (vh: number) => void;
}

function maneuverIcon(maneuver: ManeuverKind, iconClass = "h-5 w-5") {
  switch (maneuver) {
    case "left":
      return <ArrowLeft className={iconClass} strokeWidth={2.25} />;
    case "slight-left":
      return <ArrowUpLeft className={iconClass} strokeWidth={2.25} />;
    case "right":
      return <ArrowRight className={iconClass} strokeWidth={2.25} />;
    case "slight-right":
      return <ArrowUpRight className={iconClass} strokeWidth={2.25} />;
    case "uturn":
      return <RotateCcw className={iconClass} strokeWidth={2.25} />;
    case "elevator":
      return <ArrowUpDown className={iconClass} strokeWidth={2.25} />;
    case "crosswalk":
      return <Footprints className={iconClass} strokeWidth={2.25} />;
    case "ramp":
      return <ArrowUpRight className={iconClass} strokeWidth={2.25} />;
    case "stairs":
      return <TriangleAlert className={iconClass} strokeWidth={2.25} />;
    case "straight":
      return <ArrowUp className={iconClass} strokeWidth={2.25} />;
    case "arrive":
      return <Flag className={iconClass} strokeWidth={2.25} />;
    default:
      return <ArrowUp className={iconClass} strokeWidth={2.25} />;
  }
}

function RouteProfilePicker({
  fast,
  comfort,
  profile,
  onChange,
  disabled,
  compact,
}: {
  fast: ComputedRoute;
  comfort: ComputedRoute;
  profile: RouteProfile;
  onChange: (profile: RouteProfile) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { locale } = useAppSettings();
  const ui = useUi();

  const options: Array<{ key: RouteProfile; route: ComputedRoute; label: string; hint: string }> = [
    { key: "fast", route: fast, label: ui.route.profileFast, hint: ui.route.profileFastHint },
    {
      key: "comfort",
      route: comfort,
      label: ui.route.profileComfort,
      hint: ui.route.profileComfortHint,
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={ui.route.profilePickerAria}
      className={cn("grid grid-cols-2 gap-2", compact ? "mb-2" : "mb-3")}
    >
      {options.map(({ key, route: optionRoute, label, hint }) => {
        const selected = profile === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(key)}
            className={cn(
              "rounded-lg border px-2.5 py-2 text-left transition-colors disabled:opacity-60",
              selected
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border bg-muted/20 hover:bg-muted/40",
            )}
          >
            <p className="text-sm font-semibold leading-tight">{label}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{hint}</p>
            <p className="mt-1.5 text-xs font-semibold tabular-nums">
              {ui.route.aboutMinutes} {estimateWalkMinutes(optionRoute)}
              <span className="ml-0.5 font-medium text-muted-foreground">{ui.route.min}</span>
              <span className="ml-1 font-normal text-muted-foreground">
                · {formatDistance(optionRoute.distance, locale)}
              </span>
            </p>
          </button>
        );
      })}
    </div>
  );
}

function matchBuildingsFromSpeech(buildings: BarrierBuilding[], transcript: string): BarrierBuilding[] {
  const q = transcript.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return [];
  return buildings.filter((b) => {
    const full = b.name.toLowerCase().replace(/\s+/g, "");
    const short = shortBuildingName(b.name).toLowerCase().replace(/\s+/g, "");
    return full.includes(q) || short.includes(q) || q.includes(short);
  });
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
  const { locale } = useAppSettings();
  const ui = useUi();
  const [query, setQuery] = useState("");
  const [openList, setOpenList] = useState(false);
  const { listening, errorKey, start: startVoice, stop: stopVoice } = useVoiceInput(locale);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? buildings.filter((b) => b.name.toLowerCase().includes(q))
      : buildings;
    return list.slice(0, 50);
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
          <div className="flex gap-1.5">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpenList(true);
              }}
              onFocus={() => setOpenList(true)}
              placeholder={ui.route.searchPlaceholder}
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
            />
            <Button
              type="button"
              size="icon"
              variant={listening ? "default" : "secondary"}
              className="h-10 w-10 shrink-0"
              aria-label={listening ? ui.route.voiceSearchStop : ui.route.voiceSearch}
              title={listening ? ui.route.voiceListening : ui.route.voiceSearch}
              onClick={() => {
                if (listening) {
                  stopVoice();
                  return;
                }
                startVoice((transcript) => {
                  const matches = matchBuildingsFromSpeech(buildings, transcript);
                  if (matches.length === 1) {
                    onSelectBuilding(matches[0]);
                    setQuery("");
                    setOpenList(false);
                    return;
                  }
                  setQuery(transcript);
                  setOpenList(true);
                });
              }}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>
          {errorKey === "unsupported" ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{ui.route.voiceUnsupported}</p>
          ) : null}
          {errorKey === "failed" ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{ui.route.voiceFailed}</p>
          ) : null}
          {listening ? (
            <p className="mt-1 text-xs font-medium text-primary" aria-live="polite">
              {ui.route.voiceListening}
            </p>
          ) : null}
          {openList && filtered.length > 0 && (
            <div className="mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-popover shadow-sm">
              {filtered.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onSelectBuilding(b);
                    setQuery("");
                    setOpenList(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  {isUnsurveyedBuilding(b) ? (
                    <span className="shrink-0 rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {ui.gradeUnsurveyed}
                    </span>
                  ) : null}
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
    routeFast = null,
    routeComfort = null,
    routeProfile = "fast",
    onRouteProfileChange,
    routeError,
    navigating,
    onStartNav,
    onStopNav,
    currentStepIndex,
    remaining,
    metricsDisplayRef,
    voiceEnabled,
    onToggleVoice,
    liveAnnouncement = "",
    offRouteM = null,
    rerouteNotice = false,
    onSettingsClick,
    onSheetVhChange,
  } = props;

  const { locale } = useAppSettings();
  const ui = useUi();
  const { remaining: liveRemaining } = useNavMetricsDisplay(
    metricsDisplayRef ?? { current: null },
    navigating && metricsDisplayRef != null,
  );
  const displayRemaining = navigating && metricsDisplayRef ? liveRemaining : remaining;
  const SNAP_PEEK = 28;
  const SNAP_HALF = 46;
  const SNAP_FULL = 82;
  const [isMobile, setIsMobile] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [sheetVh, setSheetVh] = useState<number>(SNAP_HALF);
  const [dragging, setDragging] = useState(false);
  const [editPoints, setEditPoints] = useState(true);
  const [showSteps, setShowSteps] = useState(false);
  const dragRef = useRef<{ startY: number; startVh: number; moved: boolean } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!route) {
      setEditPoints(true);
      setShowSteps(false);
    }
  }, [route]);

  // 상태에 따라 기본 높이 — 경로 확정 시 PEEK, 상세 안내 펼침 시 FULL
  useEffect(() => {
    if (pickMode) {
      setSheetVh(SNAP_PEEK);
      return;
    }
    if (navigating) {
      setSheetVh(showSteps ? SNAP_HALF : SNAP_PEEK);
      return;
    }
    if (route) {
      setSheetVh(showSteps ? SNAP_FULL : SNAP_PEEK);
      return;
    }
    if (!origin || !destination) setSheetVh(SNAP_HALF);
    else setSheetVh(SNAP_FULL);
  }, [route, navigating, pickMode, origin, destination, showSteps]);

  const compactSheet = isMobile && sheetVh <= SNAP_HALF + 4;
  const showFullPoints = !route || editPoints || !isMobile;
  const showStepList = !isMobile || showSteps || sheetVh > SNAP_HALF || navigating;

  useEffect(() => {
    onSheetVhChange?.(sheetVh);
  }, [sheetVh, onSheetVhChange]);

  const routeSummaryRef = useRef<HTMLDivElement>(null);
  const stepsListRef = useRef<HTMLOListElement>(null);

  const toggleShowSteps = useCallback(() => {
    setShowSteps((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!showSteps || !isMobile) return;
    const id = requestAnimationFrame(() => {
      stepsListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [showSteps, isMobile]);

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
        className="flex shrink-0 cursor-grab touch-none flex-col items-center justify-center py-2 active:cursor-grabbing sm:hidden"
        role="separator"
        aria-label={ui.route.sheetResize}
      >
        <span className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
      </div>

      <div className="flex items-center gap-2 border-b border-border px-3 py-2 sm:py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={ui.route.back}
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="hidden sm:inline">{ui.route.back}</span>
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Navigation className="h-5 w-5 shrink-0 text-blue-600" />
          <h2 className="truncate text-base font-semibold">{ui.route.title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setInstallGuideOpen(true)}
            aria-label={ui.installGuide.openAria}
          >
            <Download className="h-4 w-4" />
          </Button>
          {onSettingsClick ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={onSettingsClick}
              aria-label={ui.header.settingsAria}
            >
              <Settings className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <InstallGuideDialog open={installGuideOpen} onOpenChange={setInstallGuideOpen} />

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          compactSheet ? "space-y-2 p-2.5" : "space-y-3 p-3",
        )}
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
      >
        {showFullPoints ? (
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
        ) : (
          <div className="flex items-stretch gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-green-600" aria-hidden />
                <span className="truncate font-medium text-foreground">
                  {origin ? shortBuildingName(origin.label) : "—"}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" aria-hidden />
                <span className="truncate font-medium text-foreground">
                  {destination ? shortBuildingName(destination.label) : "—"}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={onSwap}
                aria-label={ui.route.swap}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setEditPoints(true)}
                aria-label={ui.route.editRoute}
                title={ui.route.editRoute}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {showFullPoints && route && isMobile && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 w-full text-xs"
            onClick={() => setEditPoints(false)}
          >
            {ui.route.doneEdit}
          </Button>
        )}

        {navigating && liveAnnouncement ? (
          <p
            className="rounded-lg border border-blue-500/40 bg-blue-50 px-3 py-2 text-sm font-semibold leading-snug text-blue-950 dark:bg-blue-950/50 dark:text-blue-100 sm:hidden"
            aria-hidden="true"
          >
            {liveAnnouncement}
          </p>
        ) : null}

        {routeError && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{routeError}</span>
          </div>
        )}

        {navigating && offRouteM != null && offRouteM > OFF_ROUTE_WARN_M && !rerouteNotice && (
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

        {routeFast && routeComfort && routesAreDistinct(routeFast, routeComfort) && onRouteProfileChange ? (
          <RouteProfilePicker
            fast={routeFast}
            comfort={routeComfort}
            profile={routeProfile}
            onChange={onRouteProfileChange}
            disabled={navigating}
            compact={compactSheet}
          />
        ) : null}

        {/* 경로 요약 */}
        {route && (
          <div
            ref={routeSummaryRef}
            className={cn(
              "rounded-lg border border-border bg-card",
              compactSheet ? "p-2.5" : "p-3",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className={cn("font-bold leading-none", compactSheet ? "text-xl" : "text-2xl")}>
                  {ui.route.aboutMinutes} {estimateWalkMinutes(route)}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">{ui.route.min}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDistance(route.distance, locale)} · {ui.route.walking}
                </p>
              </div>
              {!compactSheet ? (
                <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                  <Footprints className="h-4 w-4" />
                  {ui.route.walkwayBased}
                </div>
              ) : null}
            </div>

            <RouteLegend
              segmentTypes={route.segmentTypes}
              variant={compactSheet ? "inline" : "panel"}
              className={compactSheet ? "mt-1.5" : "mt-2"}
            />

            {(route.hasStairs || route.hasElevator) && (
              <div className={cn("flex flex-wrap gap-1", compactSheet ? "mt-1.5" : "mt-2")}>
                {route.hasStairs && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    <TriangleAlert className="h-3 w-3 shrink-0" />
                    {compactSheet ? ui.route.legend.stairs : ui.route.stairsWarning}
                  </span>
                )}
                {route.hasElevator && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-900 dark:bg-teal-950/40 dark:text-teal-100">
                    <ArrowUpDown className="h-3 w-3 shrink-0" />
                    {compactSheet
                      ? locale === "en"
                        ? "Elevator"
                        : "승강기"
                      : ui.route.elevatorNotice}
                  </span>
                )}
              </div>
            )}

            <div className={cn("flex gap-2", compactSheet ? "mt-2" : "mt-3")}>
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
                {displayRemaining != null
                  ? `${ui.route.navActive} · ${remainingDistanceLabel(locale)} ${formatDistance(displayRemaining, locale)}`
                  : ui.route.acquiringGps}
              </p>
            )}
          </div>
        )}

        {route && route.steps.length > 0 && isMobile && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full gap-1 text-xs text-muted-foreground"
            onClick={toggleShowSteps}
            aria-expanded={showSteps}
          >
            {showSteps ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showSteps ? ui.route.hideSteps : ui.route.showSteps}
            <span className="text-muted-foreground/80">({route.steps.length})</span>
          </Button>
        )}

        {/* 턴바이턴 단계 — 모바일 컴팩트 시 접기, 안내 중에는 현재 단계만 */}
        {route && route.steps.length > 0 && showStepList && (
          <ol
            ref={stepsListRef}
            className={cn("space-y-2", compactSheet && !showSteps && navigating && "space-y-0")}
          >
            {route.steps.map((step: RouteStep, idx: number) => {
              if (compactSheet && !showSteps && navigating && idx !== currentStepIndex) {
                return null;
              }
              const active = navigating && idx === currentStepIndex;
              const { distanceLabel, instruction } = stepDisplayMeta(step, locale);
              const visual = stepManeuverStyle(step.maneuver);
              return (
                <li
                  key={idx}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-2 sm:gap-3 sm:px-2.5 sm:py-2.5",
                    active
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20 dark:bg-blue-950/40"
                      : "border-border/60 bg-card",
                  )}
                >
                  <div className="w-11 shrink-0 text-center sm:w-[3.25rem]">
                    {distanceLabel ? (
                      <>
                        <p className="text-base font-bold tabular-nums leading-none tracking-tight text-foreground sm:text-lg">
                          {distanceLabel}
                        </p>
                        <p className="mt-0.5 text-[9px] font-medium text-muted-foreground sm:text-[10px]">
                          {ui.route.distanceAhead}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-2 sm:h-11 sm:w-11",
                      visual.bg,
                      visual.fg,
                      active ? visual.ring : "ring-transparent",
                    )}
                    aria-hidden
                  >
                    {maneuverIcon(step.maneuver, "h-5 w-5")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-snug text-foreground sm:text-sm">
                      {active && step.text ? step.text : instruction}
                    </p>
                    {step.hazard && (
                      <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
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
