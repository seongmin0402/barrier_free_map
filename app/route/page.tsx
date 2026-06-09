"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseRouteLaunchSearch } from "@/lib/routing/route-launch";
import { useAppSettings } from "@/components/app-settings-provider";
import { RouteNavHud } from "@/components/barrier-free/route-nav-hud";
import { RoutePageMap } from "@/components/barrier-free/route-page-map";
import { RoutePanel } from "@/components/barrier-free/route-panel";
import { SettingsPanel } from "@/components/barrier-free/settings-panel";
import { useNavigation } from "@/hooks/use-navigation";
import { useCampusBuildings } from "@/hooks/use-campus-buildings";
import { useUi } from "@/hooks/use-ui";
import { NavLiveRegion } from "@/components/barrier-free/nav-live-region";
import { arriveMessage } from "@/lib/i18n/navigation";

export default function RoutePage() {
  const router = useRouter();
  const { locale, settings, updateSettings } = useAppSettings();
  const ui = useUi();
  const { buildings } = useCampusBuildings(ui.page.loadError);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sheetVh, setSheetVh] = useState(28);
  const [followPaused, setFollowPaused] = useState(false);

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

  const hudLabels = useMemo(
    () => ({
      navActive: ui.route.navActive,
      acquiringGps: ui.route.acquiringGps,
    }),
    [ui.route.navActive, ui.route.acquiringGps],
  );

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

        <RouteNavHud
          navigating={nav.navigating}
          hasUserPos={nav.userPos != null}
          isArrive={isArrive}
          bannerText={bannerText}
          locale={locale}
          metricsDisplayRef={nav.metricsDisplayRef}
          followPaused={followPaused}
          followPausedHint={ui.route.followPausedHint}
          labels={hudLabels}
        />

        <RoutePageMap
          buildings={buildings}
          route={nav.route}
          routeEndpoints={nav.routeEndpoints}
          origin={nav.origin}
          destination={nav.destination}
          navigating={nav.navigating}
          userPos={nav.userPos}
          userPosRef={nav.userPosRef}
          userHeading={nav.userHeading}
          routeHeading={nav.routeHeading}
          deviceHeadingRef={nav.deviceHeadingRef}
          navMotionRef={nav.navMotionRef}
          pickMode={nav.pickMode}
          mobileSheetVh={sheetVh}
          elevators={nav.elevators}
          routeElevatorIds={nav.routeElevatorIds}
          onBuildingSelect={nav.handleBuildingSelect}
          onMapPick={nav.handleMapPick}
          onFollowPausedChange={setFollowPaused}
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
          routeFast={nav.routeFast}
          routeComfort={nav.routeComfort}
          routeProfile={nav.routeProfile}
          onRouteProfileChange={nav.setRouteProfile}
          routeError={nav.routeError}
          navigating={nav.navigating}
          onStartNav={nav.startNav}
          onStopNav={nav.stopNav}
          currentStepIndex={nav.currentStepIndex}
          remaining={nav.remaining}
          metricsDisplayRef={nav.metricsDisplayRef}
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
