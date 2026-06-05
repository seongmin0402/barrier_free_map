"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "lucide-react";
import { useAppSettings } from "@/components/app-settings-provider";
import { CampusMap } from "@/components/barrier-free/campus-map";
import { RoutePanel } from "@/components/barrier-free/route-panel";
import { useNavigation } from "@/hooks/use-navigation";
import { useUi } from "@/hooks/use-ui";
import { arriveMessage, maneuverLabel, remainingDistanceLabel } from "@/lib/i18n/navigation";
import { formatDistance } from "@/lib/routing/geo";
import type { BarrierBuilding } from "@/lib/building-types";

export default function RoutePage() {
  const router = useRouter();
  const { locale } = useAppSettings();
  const ui = useUi();
  const [buildings, setBuildings] = useState<BarrierBuilding[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/buildings.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: BarrierBuilding[]) => {
        if (!cancelled) setBuildings(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setBuildings([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const nav = useNavigation(buildings);
  const setNavOpen = nav.setOpen;

  // 전용 페이지에서는 패널을 항상 열어 둔다 (데이터 로딩 트리거)
  useEffect(() => {
    setNavOpen(true);
  }, [setNavOpen]);

  const goHome = () => {
    nav.close();
    router.push("/");
  };

  const currentStep = nav.route?.steps[nav.currentStepIndex] ?? null;
  const isArrive = currentStep?.maneuver === "arrive";
  const stepLabel = currentStep
    ? currentStep.maneuver === "depart" || currentStep.maneuver === "arrive"
      ? currentStep.text
      : maneuverLabel(currentStep.maneuver, locale)
    : "";

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <main className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
        {/* 안내 중 좌상단 상태 배너 */}
        {nav.navigating && (
          <div className="absolute left-3 top-3 z-40 max-w-[min(78vw,22rem)] rounded-xl bg-blue-600 px-4 py-3 text-white shadow-xl sm:left-[23rem]">
            <div className="flex items-start gap-3">
              <Navigation className="mt-0.5 h-6 w-6 shrink-0" />
              <div className="min-w-0">
                {!nav.userPos ? (
                  <>
                    <p className="text-sm font-semibold leading-tight">{ui.route.navActive}</p>
                    <p className="mt-1 text-xs text-blue-100">{ui.route.acquiringGps}</p>
                  </>
                ) : isArrive && currentStep ? (
                  <p className="text-lg font-bold leading-tight">{arriveMessage(locale)}</p>
                ) : currentStep ? (
                  <>
                    <p className="text-2xl font-extrabold leading-none">
                      {formatDistance(nav.distanceToNext ?? 0, locale)}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium leading-snug">{stepLabel}</p>
                  </>
                ) : (
                  <p className="text-sm font-semibold leading-tight">{ui.route.navActive}</p>
                )}
                {nav.userPos && nav.remaining != null && !isArrive && (
                  <p className="mt-1 text-xs text-blue-100">
                    {remainingDistanceLabel(locale)} {formatDistance(nav.remaining, locale)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <CampusMap
          buildings={buildings}
          selectedBuilding={null}
          onBuildingSelect={() => {}}
          routeLine={nav.route?.coords ?? null}
          routeSegments={nav.route?.segmentTypes ?? null}
          originPoint={nav.origin?.point ?? null}
          destPoint={nav.destination?.point ?? null}
          liveUserPosition={nav.navigating ? nav.userPos : null}
          pickMode={nav.pickMode}
          onMapPick={nav.handleMapPick}
          followUser={nav.navigating}
        />

        <RoutePanel
          open
          onClose={goHome}
          buildings={buildings}
          origin={nav.origin}
          destination={nav.destination}
          onSelectBuilding={nav.selectBuilding}
          onPickOnMap={nav.startPickOnMap}
          pickMode={nav.pickMode}
          onUseCurrentLocation={nav.useCurrentLocation}
          onClearPoint={nav.clearPoint}
          onSwap={nav.swap}
          route={nav.route}
          routeError={nav.routeError}
          navigating={nav.navigating}
          onStartNav={nav.startNav}
          onStopNav={nav.stopNav}
          currentStepIndex={nav.currentStepIndex}
          remaining={nav.remaining}
          voiceEnabled={nav.voiceEnabled}
          onToggleVoice={nav.setVoiceEnabled}
        />
      </main>
    </div>
  );
}
