"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppSettings } from "@/components/app-settings-provider";
import type { BarrierBuilding } from "@/lib/building-types";
import { arriveMessage, navSpeechText, offRouteRerouteSpeech } from "@/lib/i18n/navigation";
import { getUi } from "@/lib/i18n/ui";
import type { LatLng } from "@/lib/routing/geo";
import { formatDistance, haversineMeters, bearingDeg } from "@/lib/routing/geo";
import {
  buildRoutingGraph,
  mainEntranceForBuilding,
  parseEntrances,
} from "@/lib/routing/graph";
import { parseElevators, type ElevatorRecord } from "@/lib/routing/elevators";
import { computeRoute } from "@/lib/routing/route";
import { computeProgress } from "@/lib/routing/progress";
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
  EntranceFeature,
  FeatureCollection,
  RoutePoint,
  RoutingGraph,
  WalkwayFeature,
} from "@/lib/routing/types";

type WhichPoint = "origin" | "destination";

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

  const [navigating, setNavigating] = useState(false);
  /** 안내 시작 시점의 경로 — locale 변경으로 steps/coords 참조가 바뀌어도 추적 유지 */
  const [navigationRoute, setNavigationRoute] = useState<ComputedRoute | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
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
  const navigationStartedAtRef = useRef<number>(0);
  const firstGpsFixRef = useRef<LatLng | null>(null);
  /** 출발 안내 직후 GPS 단계 안내 음성과 겹치지 않도록 */
  const navSpeechBlockedUntilRef = useRef(0);
  const lastRerouteAtRef = useRef(0);
  const graphRef = useRef<RoutingGraph | null>(null);
  const destinationRef = useRef<RoutePoint | null>(null);
  const userPosRef = useRef<LatLng | null>(null);
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

  const OFF_ROUTE_THRESHOLD_M = 40;
  const REROUTE_COOLDOWN_MS = 8000;

  /** 목적지까지 실제 거리 + 최소 안내 시간을 만족할 때만 도착 처리 */
  const hasArrived = useCallback(
    (activeRoute: ComputedRoute, pos: LatLng, offRoute: number) => {
      const sinceStartMs = Date.now() - navigationStartedAtRef.current;
      if (sinceStartMs < 8000) return false;

      const dest = activeRoute.coords[activeRoute.coords.length - 1];
      const distToDest = haversineMeters(pos, dest);
      if (distToDest > 22) return false;
      if (offRoute > 45) return false;

      // 첫 GPS와 거의 같으면 캐시된 좌표로 즉시 도착 처리하지 않음
      if (firstGpsFixRef.current) {
        const moved = haversineMeters(firstGpsFixRef.current, pos);
        if (moved < 8 && sinceStartMs < 15000) return false;
      }

      return true;
    },
    [],
  );

  // 데이터 로드 (패널을 처음 열 때)
  useEffect(() => {
    if (!open || walkways) return;
    let cancelled = false;
    fetch("/api/walkways")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: FeatureCollection<WalkwayFeature>) => {
        if (!cancelled) setWalkways(data);
      })
      .catch(() => {
        if (!cancelled) setWalkways(null);
      });
    fetch("/api/entrances")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: FeatureCollection<EntranceFeature>) => {
        if (!cancelled) setEntranceList(parseEntrances(data));
      })
      .catch(() => {
        if (!cancelled) setEntranceList([]);
      });
    fetch("/api/elevators")
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

  const route: ComputedRoute | null = useMemo(() => {
    if (!origin || !destination || !graph.nodes.size) return null;
    return computeRoute(graph, origin.point, destination.point, locale);
  }, [graph, origin, destination, locale]);

  const routeError = useMemo(() => {
    const t = getUi(locale).route.errors;
    if (!origin || !destination) return null;
    if (!graph.nodes.size) return t.loadingWalkways;
    if (!route) return t.noRoute;
    return null;
  }, [origin, destination, graph, route, locale]);

  // 언어 변경 시 안내 중이면 현재 위치 기준 경로 문장만 해당 언어로 갱신
  useEffect(() => {
    if (!navigating) return;
    const dest = destinationRef.current;
    const pos = userPosRef.current;
    const g = graphRef.current;
    if (!dest || !pos || !g?.nodes.size) return;
    const refreshed = computeRoute(g, pos, dest.point, locale);
    if (refreshed) setNavigationRoute(refreshed);
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

  const stopNav = useCallback(() => {
    setNavigating(false);
    setNavigationRoute(null);
    clearWatch();
    getSpeechGuide().stop();
    setUserPos(null);
    setUserHeading(null);
    setRouteHeading(null);
    prevGpsRef.current = null;
    lastGpsHeadingRef.current = null;
    setRemaining(null);
    setDistanceToNext(null);
    navigationStartedAtRef.current = 0;
    firstGpsFixRef.current = null;
    navSpeechBlockedUntilRef.current = 0;
    lastRerouteAtRef.current = 0;
    setOffRouteM(null);
    setRerouteNotice(false);
  }, [clearWatch]);

  const startNav = useCallback(() => {
    if (!route) return;
    const t = getUi(localeRef.current).route.errors;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError(t.navGeoUnsupported);
      return;
    }

    clearWatch();
    setUserPos(null);
    setUserHeading(null);
    prevGpsRef.current = null;
    lastGpsHeadingRef.current = null;
    navMotionRef.current = {
      gpsHeading: null,
      speedMps: null,
      movedMeters: 0,
      movementBearing: null,
    };
    setGeoError(null);
    setCurrentStepIndex(0);
    lastSpokenStepRef.current = -1;
    firstGpsFixRef.current = null;
    navigationStartedAtRef.current = Date.now();
    setNavigationRoute(route);
    setNavigating(true);
    setRemaining(route.distance);
    setDistanceToNext(null);

    if (route.coords.length >= 2) {
      const initialHeading = bearingDeg(route.coords[0], route.coords[1]);
      routeHeadingNavRef.current = initialHeading;
      setRouteHeading(initialHeading);
    }

    void requestCompassPermission();

    const navLocale = localeRef.current;

    // 출발 안내 (depart 단계만 — arrive 문구는 실제 도착 시에만)
    const departStep = route.steps.find((s) => s.maneuver === "depart") ?? route.steps[0];
    if (departStep) {
      navSpeechBlockedUntilRef.current = Date.now() + 5500;
      getSpeechGuide().speak(departStep.text, { force: true, locale: navLocale });
      lastSpokenStepRef.current = route.steps.indexOf(departStep);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
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
        if (heading != null) {
          lastGpsHeadingRef.current = heading;
          setUserHeading(heading);
        }
        prevGpsRef.current = here;
        setUserPos(here);
      },
      (err) => {
        const te = getUi(localeRef.current).route.errors;
        let msg = te.trackFailed;
        if (err.code === 1) msg = te.geoDenied;
        setGeoError(msg);
      },
      { enableHighAccuracy: true, maximumAge: 800, timeout: 25000 },
    );
  }, [route, clearWatch, requestCompassPermission]);

  // GPS 갱신 → 진행 상황 계산 + 음성 안내 + 경로 이탈 재탐색
  useEffect(() => {
    const activeRoute = navigationRoute;
    if (!navigating || !activeRoute || !userPos) return;

    const progress = computeProgress(activeRoute, userPos);
    if (!progress) return;

    setOffRouteM(progress.offRoute);

    const alongRoute = headingAlongRoute(activeRoute, progress);
    if (alongRoute != null) setRouteHeading(alongRoute);

    const navLocale = localeRef.current;
    const arrived = hasArrived(activeRoute, userPos, progress.offRoute);
    const sinceStartMs = Date.now() - navigationStartedAtRef.current;

    // 경로 이탈 → 현재 위치에서 목적지까지 즉시 재탐색
    if (
      !arrived &&
      sinceStartMs > 4000 &&
      progress.offRoute > OFF_ROUTE_THRESHOLD_M &&
      Date.now() - lastRerouteAtRef.current > REROUTE_COOLDOWN_MS
    ) {
      const dest = destinationRef.current;
      const g = graphRef.current;
      if (dest && g?.nodes.size) {
        const newRoute = computeRoute(g, userPos, dest.point, navLocale);
        if (newRoute) {
          lastRerouteAtRef.current = Date.now();
          setNavigationRoute(newRoute);
          setCurrentStepIndex(0);
          setRemaining(newRoute.distance);
          setDistanceToNext(null);
          setRerouteNotice(true);
          navSpeechBlockedUntilRef.current = Date.now() + 5500;

          const departStep =
            newRoute.steps.find((s) => s.maneuver === "depart") ?? newRoute.steps[0];
          if (departStep) {
            getSpeechGuide().speak(
              offRouteRerouteSpeech(navLocale, departStep.text),
              { force: true, locale: navLocale },
            );
            lastSpokenStepRef.current = newRoute.steps.indexOf(departStep);
          }
          return;
        }
        setGeoError(getUi(navLocale).route.errors.rerouteFailed);
      }
    }

    setCurrentStepIndex(progress.stepIndex);
    setRemaining(progress.remaining);
    setDistanceToNext(progress.distanceToNext);

    const step = activeRoute.steps[progress.stepIndex];
    if (!step) return;

    const speechAllowed = Date.now() >= navSpeechBlockedUntilRef.current;

    if (
      speechAllowed &&
      progress.stepIndex !== lastSpokenStepRef.current &&
      step.maneuver !== "arrive" &&
      step.maneuver !== "depart"
    ) {
      lastSpokenStepRef.current = progress.stepIndex;
      const distLabel = formatDistance(progress.distanceToNext, navLocale);
      getSpeechGuide().speak(
        navSpeechText(navLocale, progress.distanceToNext, distLabel, step.maneuver),
        { locale: navLocale },
      );
    }

    if (arrived) {
      getSpeechGuide().speak(arriveMessage(navLocale), { force: true, locale: navLocale });
      stopNav();
    }
  }, [navigating, navigationRoute, userPos, stopNav, hasArrived]);

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

  const displayRoute = navigating && navigationRoute ? navigationRoute : route;

  return {
    open,
    setOpen,
    close,
    origin,
    destination,
    pickMode,
    route: displayRoute,
    routeError: routeError ?? geoError,
    navigating,
    voiceEnabled,
    setVoiceEnabled,
    userPos,
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
    startPickOnMap,
    handleMapPick,
    useCurrentLocation,
    clearPoint,
    swap,
    startNav,
    stopNav,
  };
}
