"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useAppSettings } from "@/components/app-settings-provider";
import type { BarrierBuilding } from "@/lib/building-types";
import {
  arriveMessage,
  navSpeechPhase,
  navSpeechPhaseRank,
  navStepSpeechText,
  offRouteRerouteSpeech,
  routePreviewSpeechText,
  type NavSpeechPhase,
} from "@/lib/i18n/navigation";
import { getUi } from "@/lib/i18n/ui";
import type { LatLng } from "@/lib/routing/geo";
import { formatDistance, haversineMeters, bearingDeg, isNavMapLatLng } from "@/lib/routing/geo";
import {
  buildRoutingGraph,
  mainEntranceForBuilding,
  parseEntrances,
} from "@/lib/routing/graph";
import { elevatorIdsOnRoute, parseElevators, type ElevatorRecord } from "@/lib/routing/elevators";
import { computeRoute, computeRoutePair } from "@/lib/routing/route";
import { computeProgress } from "@/lib/routing/progress";
import {
  MANUAL_REROUTE_COOLDOWN_MS,
  MANUAL_REROUTE_SPEECH_BLOCK_MS,
  NAV_PROGRESS_COMPUTE_MS,
  OFF_ROUTE_ARRIVE_MAX_M,
  OFF_ROUTE_REROUTE_M,
  REROUTE_COOLDOWN_MS,
  REROUTE_HEADING_HOLD_OFF_ROUTE_M,
  REROUTE_MIN_START_MS,
  REROUTE_SPEECH_BLOCK_MS,
} from "@/lib/routing/nav-thresholds";
import { createGpsSmoother } from "@/lib/routing/gps-smooth";
import {
  headingAlongRoute,
  resolveNavigationHeading,
} from "@/lib/routing/nav-camera";
import { useDeviceHeading } from "@/hooks/use-device-heading";
import type { NavMotionSnapshot } from "@/lib/device-orientation";
import { getSpeechGuide } from "@/lib/routing/tts";
import type {
  BuildingEntrance,
  ComputedRoute,
  RouteProfile,
  EntranceFeature,
  FeatureCollection,
  RoutePoint,
  RoutingGraph,
  WalkwayFeature,
} from "@/lib/routing/types";

type WhichPoint = "origin" | "destination";

export type NavMetricsSnapshot = {
  remaining: number;
  distanceToNext: number;
};

export type NavMetricsDisplayRef = RefObject<NavMetricsSnapshot | null>;

const VOICE_STORAGE_KEY = "barrier-free-voice-enabled";

function loadVoiceEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(VOICE_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function useNavigation(buildings: BarrierBuilding[]) {
  const { locale } = useAppSettings();
  const localeRef = useRef(locale);
  localeRef.current = locale;

  const [open, setOpen] = useState(false);
  const [walkways, setWalkways] = useState<FeatureCollection<WalkwayFeature> | null>(null);
  const [elevators, setElevators] = useState<ElevatorRecord[]>([]);
  const [entranceList, setEntranceList] = useState<BuildingEntrance[]>([]);

  const [origin, setOrigin] = useState<RoutePoint | null>(null);
  const [destination, setDestination] = useState<RoutePoint | null>(null);
  const [pickMode, setPickMode] = useState<WhichPoint | null>(null);

  const [routeProfile, setRouteProfile] = useState<RouteProfile>("fast");
  const [navigating, setNavigating] = useState(false);
  /** 안내 시작 시점의 경로 — locale 변경으로 steps/coords 참조가 바뀌어도 추적 유지 */
  const [navigationRoute, setNavigationRoute] = useState<ComputedRoute | null>(null);
  const [voiceEnabled, setVoiceEnabledState] = useState(loadVoiceEnabled);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const voiceEnabledRef = useRef(voiceEnabled);
  voiceEnabledRef.current = voiceEnabled;

  const setVoiceEnabled = useCallback((enabled: boolean) => {
    setVoiceEnabledState(enabled);
    try {
      localStorage.setItem(VOICE_STORAGE_KEY, enabled ? "true" : "false");
    } catch {
      /* ignore */
    }
  }, []);

  /** 스크린리더 live region + (선택) TTS 동시 갱신 */
  const announce = useCallback(
    (text: string, options?: { speak?: boolean; force?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setLiveAnnouncement(trimmed);
      if (options?.speak === false) return;
      if (!voiceEnabledRef.current) return;
      getSpeechGuide().speak(trimmed, {
        force: options?.force,
        locale: localeRef.current,
      });
    },
    [],
  );
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [routeHeading, setRouteHeading] = useState<number | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [distanceToNext, setDistanceToNext] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [offRouteM, setOffRouteM] = useState<number | null>(null);
  const [rerouteNotice, setRerouteNotice] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastSpokenStepRef = useRef<number>(-1);
  const lastLiveStepIndexRef = useRef<number>(-1);
  const speechPhaseRef = useRef<{ stepIndex: number; phase: NavSpeechPhase }>({
    stepIndex: -1,
    phase: "far",
  });
  const metricsTargetRef = useRef<{
    remaining: number;
    distanceToNext: number;
    stepIndex: number;
  } | null>(null);
  const metricsDisplayRef = useRef<{
    remaining: number;
    distanceToNext: number;
  } | null>(null);
  const metricsAnimRef = useRef<number | null>(null);
  const lastProgressUiAtRef = useRef(0);
  const lastProgressStepRef = useRef(-1);
  const lastProgressComputeAtRef = useRef(0);
  const lastProgressSegRef = useRef(0);
  const gpsSmootherRef = useRef(createGpsSmoother());
  const navigationStartedAtRef = useRef<number>(0);
  const firstGpsFixRef = useRef<LatLng | null>(null);
  /** 출발 안내 직후 GPS 단계 안내 음성과 겹치지 않도록 */
  const navSpeechBlockedUntilRef = useRef(0);
  const lastAutoRerouteAtRef = useRef(0);
  const lastManualRerouteAtRef = useRef(0);
  const navigationRouteRef = useRef(navigationRoute);
  navigationRouteRef.current = navigationRoute;
  const navigatingRef = useRef(navigating);
  navigatingRef.current = navigating;
  const runNavProgressTickRef = useRef<(pos: LatLng) => void>(() => {});
  const graphRef = useRef<RoutingGraph | null>(null);
  const destinationRef = useRef<RoutePoint | null>(null);
  const routeProfileRef = useRef<RouteProfile>("fast");
  routeProfileRef.current = routeProfile;
  const navDestPointRef = useRef<LatLng | null>(null);
  const userPosRef = useRef<LatLng | null>(null);
  const lastUiPosUpdateRef = useRef(0);
  const lastUiHeadingUpdateRef = useRef(0);
  const prevGpsRef = useRef<LatLng | null>(null);
  const lastGpsHeadingRef = useRef<number | null>(null);
  const routeHeadingNavRef = useRef<number | null>(null);
  const navMotionRef = useRef<NavMotionSnapshot>({
    gpsHeading: null,
    speedMps: null,
    movedMeters: 0,
    movementBearing: null,
  });
  userPosRef.current = userPos;
  routeHeadingNavRef.current = routeHeading;

  const { deviceHeadingRef, requestPermission: requestCompassPermission } = useDeviceHeading(navigating);


  /** 목적지까지 실제 거리 + 경로 잔여 + 최소 이동을 만족할 때만 도착 처리 */
  const hasArrived = useCallback(
    (activeRoute: ComputedRoute, pos: LatLng, offRoute: number, remainingAlong: number) => {
      const sinceStartMs = Date.now() - navigationStartedAtRef.current;
      if (sinceStartMs < 12000) return false;
      if (remainingAlong > 18) return false;

      const dest = activeRoute.coords[activeRoute.coords.length - 1];
      const distToDest = haversineMeters(pos, dest);
      if (distToDest > 14) return false;
      if (offRoute > OFF_ROUTE_ARRIVE_MAX_M) return false;

      if (firstGpsFixRef.current) {
        const moved = haversineMeters(firstGpsFixRef.current, pos);
        const minTravel = Math.min(Math.max(activeRoute.distance * 0.15, 25), 120);
        if (activeRoute.distance > 50 && moved < minTravel) return false;
        if (moved < 12 && sinceStartMs < 20000) return false;
      }

      return true;
    },
    [],
  );

  // 데이터 로드 (패널을 처음 열 때)
  useEffect(() => {
    if (!open || walkways) return;
    let cancelled = false;
    fetch("/data/walkways.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: FeatureCollection<WalkwayFeature>) => {
        if (!cancelled) setWalkways(data);
      })
      .catch(() => {
        if (!cancelled) setWalkways(null);
      });
    fetch("/data/entrances.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: FeatureCollection<EntranceFeature>) => {
        if (!cancelled) setEntranceList(parseEntrances(data));
      })
      .catch(() => {
        if (!cancelled) setEntranceList([]);
      });
    fetch("/data/elevators.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (!cancelled) setElevators(parseElevators(data));
      })
      .catch(() => {
        if (!cancelled) setElevators([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, walkways]);

  const graph = useMemo(() => buildRoutingGraph(walkways, elevators), [walkways, elevators]);
  graphRef.current = graph;
  destinationRef.current = destination;

  const routePair = useMemo(() => {
    if (!origin || !destination || !graph.nodes.size) return null;
    return computeRoutePair(graph, entranceList, origin, destination, locale, elevators);
  }, [graph, origin, destination, locale, entranceList, elevators]);

  const routeFast = routePair?.fast ?? null;
  const routeComfort = routePair?.comfort ?? null;

  const activeRoute: ComputedRoute | null = useMemo(() => {
    if (!routePair) return null;
    if (routeProfile === "comfort" && routePair.comfort) return routePair.comfort;
    return routePair.fast;
  }, [routePair, routeProfile]);

  const routeEndpoints = useMemo(() => {
    if (!routePair) return null;
    return routeProfile === "comfort" ? routePair.endpoints.comfort : routePair.endpoints.fast;
  }, [routePair, routeProfile]);

  const routeError = useMemo(() => {
    const t = getUi(locale).route.errors;
    if (!origin || !destination) return null;
    if (!graph.nodes.size) return t.loadingWalkways;
    if (!activeRoute) return t.noRoute;
    return null;
  }, [origin, destination, graph, activeRoute, locale]);

  useEffect(() => {
    if (!routePair?.comfort) {
      setRouteProfile("fast");
    }
  }, [routePair]);

  // 언어 변경 시 안내 중이면 현재 위치 기준 경로 문장만 해당 언어로 갱신
  useEffect(() => {
    if (!navigating) return;
    const dest = destinationRef.current;
    const pos = userPosRef.current;
    const g = graphRef.current;
    if (!dest || !pos || !g?.nodes.size) return;
    const destPoint = navDestPointRef.current ?? dest.point;
    const refreshed = computeRoute(g, pos, destPoint, locale, {
      profile: routeProfileRef.current,
    });
    if (refreshed) {
      navigationRouteRef.current = refreshed;
      setNavigationRoute(refreshed);
    }
  }, [locale, navigating]);

  // 음성 on/off 동기화
  useEffect(() => {
    getSpeechGuide().setEnabled(voiceEnabled);
  }, [voiceEnabled]);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current != null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  /** 건물의 대표 출입구를 RoutePoint로 변환 */
  const buildingToPoint = useCallback(
    (building: BarrierBuilding): RoutePoint => {
      const entrance = mainEntranceForBuilding(entranceList, building.id);
      const point: LatLng = entrance
        ? entrance.point
        : { lat: building.lat, lng: building.lng };
      return { kind: "building", label: building.name, point, buildingId: building.id };
    },
    [entranceList],
  );

  const setPoint = useCallback((which: WhichPoint, value: RoutePoint | null) => {
    if (which === "origin") setOrigin(value);
    else setDestination(value);
  }, []);

  const selectBuilding = useCallback(
    (which: WhichPoint, building: BarrierBuilding) => {
      setPoint(which, buildingToPoint(building));
      setPickMode(null);
    },
    [buildingToPoint, setPoint],
  );

  /** 지도 건물 폴리곤 탭: 출발지 → 도착지 순으로 채움 */
  const handleBuildingSelect = useCallback(
    (buildingId: string) => {
      if (navigating) return;
      const building = buildings.find((b) => b.id === buildingId);
      if (!building) return;

      if (pickMode) {
        selectBuilding(pickMode, building);
        return;
      }

      if (!origin) {
        selectBuilding("origin", building);
      } else if (!destination) {
        selectBuilding("destination", building);
      } else {
        selectBuilding("destination", building);
      }
    },
    [buildings, navigating, pickMode, origin, destination, selectBuilding],
  );

  const startPickOnMap = useCallback((which: WhichPoint) => {
    setPickMode((prev) => (prev === which ? null : which));
  }, []);

  const handleMapPick = useCallback(
    (point: LatLng) => {
      if (!pickMode) return;
      const label = getUi(localeRef.current).route.mapPickLabel(point.lat, point.lng);
      setPoint(pickMode, { kind: "map", label, point });
      setPickMode(null);
    },
    [pickMode, setPoint],
  );

  const useCurrentLocation = useCallback(
    (which: WhichPoint) => {
      const t = getUi(localeRef.current).route.errors;
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setGeoError(t.geoUnsupported);
        return;
      }
      setPickMode(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoError(null);
          setPoint(which, {
            kind: "gps",
            label: getUi(localeRef.current).route.currentLocationLabel,
            point: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
        },
        (err) => {
          let msg = t.geoFailed;
          if (err.code === 1) msg = t.geoDenied;
          else if (err.code === 2) msg = t.geoUnavailable;
          else if (err.code === 3) msg = t.geoTimeout;
          setGeoError(msg);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
      );
    },
    [setPoint],
  );

  const clearPoint = useCallback(
    (which: WhichPoint) => {
      setPoint(which, null);
    },
    [setPoint],
  );

  const swap = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
  }, [origin, destination]);

  /** 출발=현재 GPS, 도착=건물 — 건물 상세 길찾기 등 */
  const launchToBuildingFromGps = useCallback(
    (building: BarrierBuilding) => {
      if (navigating) return;
      selectBuilding("destination", building);
      useCurrentLocation("origin");
    },
    [navigating, selectBuilding, useCurrentLocation],
  );

  /** 재검색 후 GPS 위치 기준 진행·방향 동기화 — step 0 리셋으로 인한 마커/카메라 튐 방지 */
  const syncProgressAfterReroute = useCallback((newRoute: ComputedRoute, pos: LatLng) => {
    const progress = computeProgress(newRoute, pos);
    if (!progress) {
      setCurrentStepIndex(0);
      setRemaining(newRoute.distance);
      setDistanceToNext(null);
      return;
    }

    lastProgressSegRef.current = progress.nearestSegmentIndex;
    lastProgressStepRef.current = progress.stepIndex;
    setCurrentStepIndex(progress.stepIndex);
    setOffRouteM(progress.offRoute);
    setRemaining(progress.remaining);
    setDistanceToNext(progress.distanceToNext);

    metricsTargetRef.current = {
      remaining: progress.remaining,
      distanceToNext: progress.distanceToNext,
      stepIndex: progress.stepIndex,
    };
    metricsDisplayRef.current = {
      remaining: progress.remaining,
      distanceToNext: progress.distanceToNext,
    };

    const along = headingAlongRoute(newRoute, progress);
    let nextHeading: number | null = along;
    if (progress.offRoute > REROUTE_HEADING_HOLD_OFF_ROUTE_M) {
      const motion = navMotionRef.current;
      nextHeading =
        motion.movementBearing ??
        lastGpsHeadingRef.current ??
        routeHeadingNavRef.current ??
        along;
    }
    if (nextHeading != null && Number.isFinite(nextHeading)) {
      routeHeadingNavRef.current = nextHeading;
      setRouteHeading(nextHeading);
    }
  }, []);

  const applyRerouteResult = useCallback(
    (
      newRoute: ComputedRoute,
      options?: { departAnnouncement?: string; source?: "auto" | "manual" },
    ) => {
      const now = Date.now();
      const source = options?.source ?? "auto";
      if (source === "manual") {
        lastManualRerouteAtRef.current = now;
      } else {
        lastAutoRerouteAtRef.current = now;
      }

      navigationRouteRef.current = newRoute;
      setNavigationRoute(newRoute);
      setRerouteNotice(true);
      lastLiveStepIndexRef.current = -1;
      speechPhaseRef.current = { stepIndex: -1, phase: "far" };
      navSpeechBlockedUntilRef.current =
        now +
        (source === "manual" ? MANUAL_REROUTE_SPEECH_BLOCK_MS : REROUTE_SPEECH_BLOCK_MS);

      const pos = userPosRef.current;
      if (pos) {
        syncProgressAfterReroute(newRoute, pos);
      } else {
        setCurrentStepIndex(0);
        setRemaining(newRoute.distance);
        setDistanceToNext(null);
        lastProgressStepRef.current = -1;
        lastProgressSegRef.current = 0;
      }

      if (options?.departAnnouncement) {
        announce(options.departAnnouncement, { force: true });
        const departStep =
          newRoute.steps.find((s) => s.maneuver === "depart") ?? newRoute.steps[0];
        if (departStep) {
          lastSpokenStepRef.current = newRoute.steps.indexOf(departStep);
        }
      }
    },
    [announce, syncProgressAfterReroute],
  );

  /** 안내 중 — 현재 GPS에서 목적지까지 수동 재탐색 */
  const rerouteFromCurrentPosition = useCallback(() => {
    if (!navigatingRef.current) return;
    const navLocale = localeRef.current;
    const t = getUi(navLocale).route;
    if (Date.now() - lastManualRerouteAtRef.current < MANUAL_REROUTE_COOLDOWN_MS) return;

    const pos = userPosRef.current;
    if (!pos || !isNavMapLatLng(pos)) {
      setGeoError(t.errors.geoUnavailable);
      return;
    }

    const dest = destinationRef.current;
    const g = graphRef.current;
    if (!dest || !g?.nodes.size) return;

    setLiveAnnouncement(t.rerouteFinding);
    announce(t.rerouteFinding, { force: true });

    const destPoint = navDestPointRef.current ?? dest.point;
    const newRoute = computeRoute(g, pos, destPoint, navLocale, {
      profile: routeProfileRef.current,
    });

    if (newRoute) {
      applyRerouteResult(newRoute, { source: "manual" });
    } else {
      setGeoError(t.errors.rerouteFailed);
    }
  }, [announce, applyRerouteResult]);

  const stopNav = useCallback(() => {
    navigatingRef.current = false;
    setNavigating(false);
    navigationRouteRef.current = null;
    setNavigationRoute(null);
    clearWatch();
    getSpeechGuide().stop();
    setUserPos(null);
    userPosRef.current = null;
    setUserHeading(null);
    setRouteHeading(null);
    prevGpsRef.current = null;
    lastGpsHeadingRef.current = null;
    gpsSmootherRef.current.reset();
    speechPhaseRef.current = { stepIndex: -1, phase: "far" };
    metricsTargetRef.current = null;
    metricsDisplayRef.current = null;
    setRemaining(null);
    setDistanceToNext(null);
    navigationStartedAtRef.current = 0;
    firstGpsFixRef.current = null;
    navSpeechBlockedUntilRef.current = 0;
    lastAutoRerouteAtRef.current = 0;
    lastManualRerouteAtRef.current = 0;
    lastProgressUiAtRef.current = 0;
    lastProgressStepRef.current = -1;
    lastProgressComputeAtRef.current = 0;
    navDestPointRef.current = null;
    setOffRouteM(null);
    setRerouteNotice(false);
    setLiveAnnouncement("");
  }, [clearWatch]);

  /** GPS ref 기준 진행·이탈·재탐색 — React userPos throttle과 분리 */
  const runNavProgressTick = useCallback(
    (pos: LatLng) => {
      const activeRoute = navigationRouteRef.current;
      if (!navigatingRef.current || !activeRoute) return;

      const computeNow = Date.now();
      if (computeNow - lastProgressComputeAtRef.current < NAV_PROGRESS_COMPUTE_MS) return;
      lastProgressComputeAtRef.current = computeNow;

      const progress = computeProgress(activeRoute, pos, {
        segmentHint: lastProgressSegRef.current,
      });
      if (!progress) return;
      lastProgressSegRef.current = progress.nearestSegmentIndex;

      const alongRoute = headingAlongRoute(activeRoute, progress);
      if (alongRoute != null) routeHeadingNavRef.current = alongRoute;

      const navLocale = localeRef.current;
      const arrived = hasArrived(activeRoute, pos, progress.offRoute, progress.remaining);
      const sinceStartMs = Date.now() - navigationStartedAtRef.current;

      if (
        !arrived &&
        sinceStartMs > REROUTE_MIN_START_MS &&
        progress.offRoute > OFF_ROUTE_REROUTE_M &&
        computeNow - lastAutoRerouteAtRef.current > REROUTE_COOLDOWN_MS
      ) {
        const dest = destinationRef.current;
        const g = graphRef.current;
        if (dest && g?.nodes.size) {
          const destPoint = navDestPointRef.current ?? dest.point;
          const newRoute = computeRoute(g, pos, destPoint, navLocale, {
            profile: routeProfileRef.current,
          });
          if (newRoute) {
            const departStep =
              newRoute.steps.find((s) => s.maneuver === "depart") ?? newRoute.steps[0];
            const rerouteText = departStep
              ? offRouteRerouteSpeech(navLocale, departStep.text)
              : undefined;
            applyRerouteResult(newRoute, {
              departAnnouncement: rerouteText,
              source: "auto",
            });
            return;
          }
          setGeoError(getUi(navLocale).route.errors.rerouteFailed);
        }
      }

      metricsTargetRef.current = {
        remaining: progress.remaining,
        distanceToNext: progress.distanceToNext,
        stepIndex: progress.stepIndex,
      };

      const progressNow = Date.now();
      const stepChanged = progress.stepIndex !== lastProgressStepRef.current;
      if (stepChanged || progressNow - lastProgressUiAtRef.current >= 400) {
        lastProgressUiAtRef.current = progressNow;
        lastProgressStepRef.current = progress.stepIndex;
        setCurrentStepIndex(progress.stepIndex);
        setOffRouteM(progress.offRoute);
        if (alongRoute != null) setRouteHeading(alongRoute);
      }

      const step = activeRoute.steps[progress.stepIndex];
      if (!step) return;

      const speechAllowed = Date.now() >= navSpeechBlockedUntilRef.current;
      const d = progress.distanceToNext;
      const phase = navSpeechPhase(d);
      const distLabel = formatDistance(d, navLocale);

      if (step.maneuver !== "arrive" && step.maneuver !== "depart") {
        const liveText = navStepSpeechText(
          navLocale,
          step.text,
          d,
          distLabel,
          step.maneuver,
          phase,
        );

        if (progress.stepIndex !== lastLiveStepIndexRef.current) {
          lastLiveStepIndexRef.current = progress.stepIndex;
          setLiveAnnouncement(liveText);
        } else if (
          speechPhaseRef.current.stepIndex === progress.stepIndex &&
          step.maneuver !== "elevator"
        ) {
          const prevRank = navSpeechPhaseRank(speechPhaseRef.current.phase);
          const nextRank = navSpeechPhaseRank(phase);
          if (nextRank > prevRank) {
            setLiveAnnouncement(liveText);
          }
        }

        if (speechAllowed) {
          const isNewStep = progress.stepIndex !== lastSpokenStepRef.current;
          const phaseAdvanced =
            step.maneuver !== "elevator" &&
            speechPhaseRef.current.stepIndex === progress.stepIndex &&
            navSpeechPhaseRank(phase) > navSpeechPhaseRank(speechPhaseRef.current.phase);

          if (isNewStep || phaseAdvanced) {
            lastSpokenStepRef.current = progress.stepIndex;
            speechPhaseRef.current = { stepIndex: progress.stepIndex, phase };
            announce(liveText);
          }
        }
      }

      if (arrived) {
        announce(arriveMessage(navLocale), { force: true });
        stopNav();
      }
    },
    [hasArrived, announce, applyRerouteResult, stopNav],
  );

  runNavProgressTickRef.current = runNavProgressTick;

  const startNav = useCallback(() => {
    if (!activeRoute) return;
    const route = activeRoute;
    const t = getUi(localeRef.current).route.errors;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError(t.navGeoUnsupported);
      return;
    }

    clearWatch();
    const originGps =
      origin?.kind === "gps" && origin.point ? { ...origin.point } : null;
    if (originGps) {
      userPosRef.current = originGps;
      firstGpsFixRef.current = originGps;
      prevGpsRef.current = originGps;
      gpsSmootherRef.current.filter(originGps, 12);
      setUserPos(originGps);
    } else {
      setUserPos(null);
      firstGpsFixRef.current = null;
      prevGpsRef.current = null;
      gpsSmootherRef.current.reset();
    }
    setUserHeading(null);
    lastGpsHeadingRef.current = null;
    speechPhaseRef.current = { stepIndex: -1, phase: "far" };
    metricsTargetRef.current = null;
    metricsDisplayRef.current = null;
    navMotionRef.current = {
      gpsHeading: null,
      speedMps: null,
      movedMeters: 0,
      movementBearing: null,
    };
    setGeoError(null);
    setCurrentStepIndex(0);
    lastSpokenStepRef.current = -1;
    lastLiveStepIndexRef.current = -1;
    navigationStartedAtRef.current = Date.now();
    navDestPointRef.current = route.coords[route.coords.length - 1] ?? destination?.point ?? null;
    navigationRouteRef.current = route;
    setNavigationRoute(route);
    navigatingRef.current = true;
    setNavigating(true);
    const firstStepDist = route.steps[0]?.distance ?? route.distance;
    metricsDisplayRef.current = { remaining: route.distance, distanceToNext: firstStepDist };
    metricsTargetRef.current = {
      remaining: route.distance,
      distanceToNext: firstStepDist,
      stepIndex: 0,
    };
    lastProgressSegRef.current = 0;
    setRemaining(route.distance);
    setDistanceToNext(null);

    if (route.coords.length >= 2) {
      const initialHeading = bearingDeg(route.coords[0], route.coords[1]);
      routeHeadingNavRef.current = initialHeading;
      setRouteHeading(initialHeading);
    }

    void requestCompassPermission();

    const navLocale = localeRef.current;
    const destLabel = destination?.label ?? getUi(navLocale).route.destination;
    const previewText = routePreviewSpeechText(navLocale, route, destLabel);
    const departStep = route.steps.find((s) => s.maneuver === "depart") ?? route.steps[0];
    const departText = departStep?.text ?? "";

    navSpeechBlockedUntilRef.current = Date.now() + 12000;
    setLiveAnnouncement(previewText);

    void (async () => {
      const guide = getSpeechGuide();
      if (voiceEnabledRef.current) {
        await guide.speakAndWait(previewText, { force: true, locale: navLocale });
      }
      if (departText) {
        setLiveAnnouncement(departText);
        if (voiceEnabledRef.current) {
          await guide.speakAndWait(departText, { force: true, locale: navLocale });
        }
      }
      navSpeechBlockedUntilRef.current = Date.now() + 5500;
      if (departStep) {
        lastSpokenStepRef.current = route.steps.indexOf(departStep);
      }
    })();

    const applyGpsReading = (pos: GeolocationPosition) => {
      const raw = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const here = gpsSmootherRef.current.filter(raw, pos.coords.accuracy);
      if (!isNavMapLatLng(here)) return;
      const isFirstFix = !firstGpsFixRef.current;
      if (!firstGpsFixRef.current) firstGpsFixRef.current = here;

      const prev = prevGpsRef.current;
      const movedM = prev ? haversineMeters(prev, here) : 0;
      const movementBearing =
        prev && movedM > 0.4 ? bearingDeg(prev, here) : null;

      navMotionRef.current = {
        gpsHeading:
          pos.coords.heading != null && Number.isFinite(pos.coords.heading) && pos.coords.heading >= 0
            ? pos.coords.heading
            : null,
        speedMps:
          pos.coords.speed != null && Number.isFinite(pos.coords.speed) && pos.coords.speed >= 0
            ? pos.coords.speed
            : null,
        movedMeters: movedM,
        movementBearing,
      };

      const heading = resolveNavigationHeading(
        prev,
        here,
        pos.coords.heading,
        routeHeadingNavRef.current,
      );
      userPosRef.current = here;
      prevGpsRef.current = here;
      runNavProgressTickRef.current(here);

      const now = Date.now();
      if (isFirstFix || now - lastUiPosUpdateRef.current >= 420) {
        lastUiPosUpdateRef.current = now;
        setUserPos(here);
      }

      if (heading != null) {
        lastGpsHeadingRef.current = heading;
        routeHeadingNavRef.current = heading;
        if (isFirstFix || now - lastUiHeadingUpdateRef.current >= 500) {
          lastUiHeadingUpdateRef.current = now;
          setUserHeading(heading);
        }
      }
    };

    const onGpsError = (err: GeolocationPositionError) => {
      const te = getUi(localeRef.current).route.errors;
      let msg = te.trackFailed;
      if (err.code === 1) msg = te.geoDenied;
      setGeoError(msg);
    };

    if (!originGps) {
      navigator.geolocation.getCurrentPosition(
        applyGpsReading,
        () => {
          /* 캐시 없음 — watchPosition 첫 fix까지 대기 */
        },
        { enableHighAccuracy: true, maximumAge: 4000, timeout: 8000 },
      );
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      applyGpsReading,
      onGpsError,
      { enableHighAccuracy: true, maximumAge: 500, timeout: 25000 },
    );
  }, [activeRoute, destination, origin, clearWatch, requestCompassPermission]);

  // userPos 상태 갱신 시 백업 tick (GPS 콜백 throttle과 이중 실행 방지는 NAV_PROGRESS_COMPUTE_MS)
  useEffect(() => {
    if (!navigating || !navigationRoute || !userPos) return;
    const pos = userPosRef.current ?? userPos;
    runNavProgressTickRef.current(pos);
  }, [navigating, navigationRoute, userPos]);

  /** 남은 거리·다음 안내 거리 부드럽게 보간 */
  useEffect(() => {
    if (!navigating) {
      if (metricsAnimRef.current != null) {
        cancelAnimationFrame(metricsAnimRef.current);
        metricsAnimRef.current = null;
      }
      metricsTargetRef.current = null;
      metricsDisplayRef.current = null;
      return;
    }

    const METRIC_LERP = 0.16;
    const tick = () => {
      const target = metricsTargetRef.current;
      if (target) {
        const prev = metricsDisplayRef.current;
        const nextRemaining =
          prev == null ? target.remaining : prev.remaining + (target.remaining - prev.remaining) * METRIC_LERP;
        const nextDist =
          prev == null
            ? target.distanceToNext
            : prev.distanceToNext + (target.distanceToNext - prev.distanceToNext) * METRIC_LERP;

        metricsDisplayRef.current = {
          remaining: nextRemaining,
          distanceToNext: Math.max(0, nextDist),
        };
      }
      metricsAnimRef.current = requestAnimationFrame(tick);
    };

    metricsAnimRef.current = requestAnimationFrame(tick);
    return () => {
      if (metricsAnimRef.current != null) {
        cancelAnimationFrame(metricsAnimRef.current);
        metricsAnimRef.current = null;
      }
    };
  }, [navigating]);

  useEffect(() => {
    if (!rerouteNotice) return;
    const t = window.setTimeout(() => setRerouteNotice(false), 4000);
    return () => window.clearTimeout(t);
  }, [rerouteNotice]);

  // 패널 닫으면 정리
  const close = useCallback(() => {
    setOpen(false);
    setPickMode(null);
    stopNav();
  }, [stopNav]);

  // 언마운트 정리
  useEffect(() => {
    return () => {
      clearWatch();
    };
  }, [clearWatch]);

  const displayRoute = navigating && navigationRoute ? navigationRoute : activeRoute;

  const routeElevatorIds = useMemo(
    () => elevatorIdsOnRoute(displayRoute, elevators),
    [displayRoute, elevators],
  );

  return {
    open,
    setOpen,
    close,
    origin,
    destination,
    pickMode,
    elevators,
    routeElevatorIds,
    route: displayRoute,
    routeFast,
    routeComfort,
    routeProfile,
    setRouteProfile,
    routeEndpoints,
    routeError: routeError ?? geoError,
    navigating,
    voiceEnabled,
    setVoiceEnabled,
    liveAnnouncement,
    userPos,
    userPosRef,
    metricsDisplayRef,
    userHeading,
    routeHeading,
    deviceHeadingRef,
    navMotionRef,
    currentStepIndex,
    remaining,
    distanceToNext,
    offRouteM,
    rerouteNotice,
    // handlers
    selectBuilding,
    handleBuildingSelect,
    startPickOnMap,
    handleMapPick,
    useCurrentLocation,
    clearPoint,
    swap,
    launchToBuildingFromGps,
    startNav,
    stopNav,
    rerouteFromCurrentPosition,
  };
}
