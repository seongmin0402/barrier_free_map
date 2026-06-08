"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseRouteLaunchSearch } from "@/lib/routing/route-launch";
import { Navigation } from "lucide-react";
import { useAppSettings } from "@/components/app-settings-provider";
import { CampusMap } from "@/components/barrier-free/campus-map";
import { RoutePanel } from "@/components/barrier-free/route-panel";
import { SettingsPanel } from "@/components/barrier-free/settings-panel";
import { useNavigation } from "@/hooks/use-navigation";
import { useCampusBuildings } from "@/hooks/use-campus-buildings";
import { useUi } from "@/hooks/use-ui";
import { NavLiveRegion } from "@/components/barrier-free/nav-live-region";
import { arriveMessage, remainingDistanceLabel } from "@/lib/i18n/navigation";
import { formatDistance } from "@/lib/routing/geo";
import { cn } from "@/lib/utils";

export default function RoutePage() {
  const router = useRouter();
  const { locale, settings, updateSettings } = useAppSettings();
  const ui = useUi();
  const { buildings } = useCampusBuildings(ui.page.loadError);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sheetVh, setSheetVh] = useState(28);

  const nav = useNavigation(buildings);
  const { setOpen: setNavOpen, launchToBuildingFromGps } = nav;

  const routeLaunchAppliedRef = useRef(false);

  useEffect(() => {
    setNavOpen(true);
  }, [setNavOpen]);

  useEffect(() => {
    if (routeLaunchAppliedRef.current || typeof window === "undefined") return;
    const launch = parseRouteLaunchSearch(window.location.search);
    if (!launch?.fromGps) return;
    const building = buildings.find((b) => b.id === launch.buildingId);
    if (!building) return;
    routeLaunchAppliedRef.current = true;
    launchToBuildingFromGps(building);
    window.history.replaceState(null, "", "/route");
  }, [buildings, launchToBuildingFromGps]);

  const goHome = () => {
    nav.close();
    router.push("/");
  };

  const currentStep = nav.route?.steps[nav.currentStepIndex] ?? null;
  const isArrive = currentStep?.maneuver === "arrive";
  const bannerText =
    nav.liveAnnouncement ||
    (currentStep?.text ?? "") ||
    (isArrive ? arriveMessage(locale) : "");

  return (
    <div
      className="flex h-screen flex-col bg-background text-foreground"
      style={{ fontSize: `${settings.fontSize}%` }}
      data-high-contrast={settings.highContrast ? "true" : undefined}
    >
      <main className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <NavLiveRegion
          message={nav.liveAnnouncement}
          label={ui.route.navLiveLabel}
        />

        {/* 모바일 실시간 안내 — 지도 좌상단 */}
        {nav.navigating && (
          <div
            className={cn(
              "pointer-events-none absolute z-40 max-w-[min(calc(100%-1.5rem),18rem)] sm:hidden",
              "left-3 top-[max(0.75rem,env(safe-area-inset-top))]",
            )}
          >
            <div className="rounded-xl bg-blue-600 px-3 py-2.5 text-white shadow-xl ring-1 ring-blue-500/40">
              {!nav.userPos ? (
                <>
                  <p className="text-sm font-semibold leading-tight">{ui.route.navActive}</p>
                  <p className="mt-0.5 text-xs text-blue-100">{ui.route.acquiringGps}</p>
                </>
              ) : isArrive && currentStep ? (
                <p className="text-base font-bold leading-tight">{arriveMessage(locale)}</p>
              ) : (
                <>
                  <p className="text-2xl font-extrabold tabular-nums leading-none">
                    {formatDistance(nav.distanceToNext ?? 0, locale)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">{bannerText}</p>
                  {nav.remaining != null && !isArrive ? (
                    <p className="mt-1 text-[11px] text-blue-100">
                      {remainingDistanceLabel(locale)} {formatDistance(nav.remaining, locale)}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}

        {/* 데스크톱 안내 배너 */}
        {nav.navigating && (
          <div className="absolute left-[calc(22rem+0.75rem)] top-3 z-40 hidden max-w-xs rounded-xl bg-blue-600 px-4 py-3 text-white shadow-xl sm:block">
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
                    <p className="mt-1 line-clamp-3 text-sm font-medium leading-snug">{bannerText}</p>
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
          onBuildingSelect={nav.handleBuildingSelect}
          routeLine={nav.route?.coords ?? null}
          routeSegments={nav.route?.segmentTypes ?? null}
          originPoint={nav.origin?.point ?? null}
          destPoint={nav.destination?.point ?? null}
          liveUserPosition={nav.navigating ? nav.userPos : null}
          liveUserPositionRef={nav.userPosRef}
          pickMode={nav.pickMode}
          onMapPick={nav.handleMapPick}
          followUser={nav.navigating}
          navigationMode={nav.navigating}
          userHeading={nav.userHeading}
          routeHeading={nav.routeHeading}
          deviceHeadingRef={nav.deviceHeadingRef}
          navMotionRef={nav.navMotionRef}
          mapLayout="route"
          mobileSheetVh={sheetVh}
          elevators={nav.elevators}
          routeElevatorIds={nav.routeElevatorIds}
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
          liveAnnouncement={nav.liveAnnouncement}
          offRouteM={nav.offRouteM}
          rerouteNotice={nav.rerouteNotice}
          onSettingsClick={() => setIsSettingsOpen(true)}
          onSheetVhChange={setSheetVh}
        />

        <SettingsPanel
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSettingsChange={updateSettings}
        />
      </main>
    </div>
  );
}
