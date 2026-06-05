"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BarrierBuilding } from "@/lib/building-types";
import type { LatLng } from "@/lib/routing/geo";
import { formatDistance } from "@/lib/routing/geo";
import {
  buildWalkwayGraph,
  mainEntranceForBuilding,
  parseEntrances,
} from "@/lib/routing/graph";
import { computeRoute } from "@/lib/routing/route";
import { computeProgress } from "@/lib/routing/progress";
import { getSpeechGuide } from "@/lib/routing/tts";
import type {
  BuildingEntrance,
  ComputedRoute,
  EntranceFeature,
  FeatureCollection,
  RoutePoint,
  WalkwayFeature,
} from "@/lib/routing/types";

type WhichPoint = "origin" | "destination";

export function useNavigation(buildings: BarrierBuilding[]) {
  const [open, setOpen] = useState(false);
  const [walkways, setWalkways] = useState<FeatureCollection<WalkwayFeature> | null>(null);
  const [entranceList, setEntranceList] = useState<BuildingEntrance[]>([]);

  const [origin, setOrigin] = useState<RoutePoint | null>(null);
  const [destination, setDestination] = useState<RoutePoint | null>(null);
  const [pickMode, setPickMode] = useState<WhichPoint | null>(null);

  const [navigating, setNavigating] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastSpokenStepRef = useRef<number>(-1);

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
    return () => {
      cancelled = true;
    };
  }, [open, walkways]);

  const graph = useMemo(() => buildWalkwayGraph(walkways), [walkways]);

  const route: ComputedRoute | null = useMemo(() => {
    if (!origin || !destination || !graph.nodes.size) return null;
    return computeRoute(graph, origin.point, destination.point);
  }, [graph, origin, destination]);

  const routeError = useMemo(() => {
    if (!origin || !destination) return null;
    if (!graph.nodes.size) return "보행로 데이터를 불러오는 중입니다…";
    if (!route) return "두 지점을 잇는 보행로 경로를 찾지 못했습니다. 다른 지점을 선택해 보세요.";
    return null;
  }, [origin, destination, graph, route]);

  // 음성 on/off 동기화
  useEffect(() => {
    getSpeechGuide().setEnabled(voiceEnabled);
  }, [voiceEnabled]);

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
      const label = `지도 선택 (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`;
      setPoint(pickMode, { kind: "map", label, point });
      setPickMode(null);
    },
    [pickMode, setPoint],
  );

  const useCurrentLocation = useCallback(
    (which: WhichPoint) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setGeoError("이 브라우저에서는 위치를 사용할 수 없습니다.");
        return;
      }
      setPickMode(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoError(null);
          setPoint(which, {
            kind: "gps",
            label: "현재 위치",
            point: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
        },
        (err) => {
          let msg = "위치를 가져올 수 없습니다.";
          if (err.code === 1) msg = "위치 권한이 거부되었습니다.";
          else if (err.code === 2) msg = "위치를 확인할 수 없습니다.";
          else if (err.code === 3) msg = "위치 확인 시간이 초과되었습니다.";
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
    if (watchIdRef.current != null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    getSpeechGuide().stop();
    setRemaining(null);
  }, []);

  const startNav = useCallback(() => {
    if (!route) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("이 브라우저에서는 위치 안내를 사용할 수 없습니다.");
      return;
    }
    setNavigating(true);
    setCurrentStepIndex(0);
    lastSpokenStepRef.current = -1;
    setGeoError(null);

    // 시작 안내
    if (route.steps[0]) {
      getSpeechGuide().speak(route.steps[0].text, { force: true });
      lastSpokenStepRef.current = 0;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const here: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(here);
      },
      (err) => {
        let msg = "위치 추적 실패";
        if (err.code === 1) msg = "위치 권한이 거부되었습니다.";
        setGeoError(msg);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
  }, [route]);

  // GPS 갱신 → 진행 상황 계산 + 음성 안내
  useEffect(() => {
    if (!navigating || !route || !userPos) return;
    const progress = computeProgress(route, userPos);
    if (!progress) return;
    setCurrentStepIndex(progress.stepIndex);
    setRemaining(progress.remaining);

    const step = route.steps[progress.stepIndex];
    if (!step) return;

    // 새 단계 진입 시 안내
    if (progress.stepIndex !== lastSpokenStepRef.current) {
      lastSpokenStepRef.current = progress.stepIndex;
      if (step.maneuver === "arrive") {
        getSpeechGuide().speak("목적지에 도착했습니다", { force: true });
      } else {
        const dist = formatDistance(progress.distanceToNext);
        getSpeechGuide().speak(`${dist} 앞 ${step.text.replace(/^.*앞에서\s*/, "")}`);
      }
    }

    // 도착 처리
    if (progress.remaining < 8) {
      getSpeechGuide().speak("목적지에 도착했습니다", { force: true });
      stopNav();
    }
  }, [navigating, route, userPos, stopNav]);

  // 패널 닫으면 정리
  const close = useCallback(() => {
    setOpen(false);
    setPickMode(null);
    stopNav();
  }, [stopNav]);

  // 언마운트 정리
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    open,
    setOpen,
    close,
    origin,
    destination,
    pickMode,
    route,
    routeError: routeError ?? geoError,
    navigating,
    voiceEnabled,
    setVoiceEnabled,
    userPos,
    currentStepIndex,
    remaining,
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
