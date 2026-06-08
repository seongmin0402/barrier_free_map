"use client";

import { memo, useMemo, type RefObject } from "react";
import { CampusMap } from "@/components/barrier-free/campus-map";
import type { BarrierBuilding } from "@/lib/building-types";
import type { LatLng } from "@/lib/routing/geo";
import type { ElevatorRecord } from "@/lib/routing/elevators";
import type { ComputedRoute } from "@/lib/routing/types";
import type { DeviceHeadingSnapshot, NavMotionSnapshot } from "@/lib/device-orientation";
import { simplifyForMapDisplay } from "@/lib/routing/polyline-simplify";
import type { RoutePoint } from "@/lib/routing/types";

export type RoutePageMapProps = {
  buildings: BarrierBuilding[];
  route: ComputedRoute | null;
  routeEndpoints: { from: LatLng; to: LatLng } | null;
  origin: RoutePoint | null;
  destination: RoutePoint | null;
  navigating: boolean;
  userPos: LatLng | null;
  userPosRef: RefObject<LatLng | null>;
  userHeading: number | null;
  routeHeading: number | null;
  deviceHeadingRef: RefObject<DeviceHeadingSnapshot>;
  navMotionRef: RefObject<NavMotionSnapshot>;
  pickMode: "origin" | "destination" | null;
  mobileSheetVh: number;
  elevators: ElevatorRecord[];
  routeElevatorIds: Set<string>;
  onBuildingSelect: (id: string) => void;
  onMapPick: (point: LatLng) => void;
};

function RoutePageMapInner({
  buildings,
  route,
  routeEndpoints,
  origin,
  destination,
  navigating,
  userPos,
  userPosRef,
  userHeading,
  routeHeading,
  deviceHeadingRef,
  navMotionRef,
  pickMode,
  mobileSheetVh,
  elevators,
  routeElevatorIds,
  onBuildingSelect,
  onMapPick,
}: RoutePageMapProps) {
  const mapRouteDisplay = useMemo(() => {
    if (!route?.coords || route.coords.length < 2) {
      return { coords: null, segmentTypes: null };
    }
    return simplifyForMapDisplay(route.coords, route.segmentTypes ?? []);
  }, [route]);

  const mapOriginPoint = useMemo(
    () => routeEndpoints?.from ?? origin?.point ?? null,
    [routeEndpoints, origin],
  );

  const mapDestPoint = useMemo(
    () => routeEndpoints?.to ?? destination?.point ?? null,
    [routeEndpoints, destination],
  );

  return (
    <CampusMap
      buildings={buildings}
      selectedBuilding={null}
      onBuildingSelect={onBuildingSelect}
      routeLine={mapRouteDisplay.coords}
      routeSegments={mapRouteDisplay.segmentTypes}
      originPoint={mapOriginPoint}
      destPoint={mapDestPoint}
      liveUserPosition={navigating ? userPos : null}
      liveUserPositionRef={userPosRef}
      pickMode={pickMode}
      onMapPick={onMapPick}
      followUser={navigating}
      navigationMode={navigating}
      userHeading={userHeading}
      routeHeading={routeHeading}
      deviceHeadingRef={deviceHeadingRef}
      navMotionRef={navMotionRef}
      mapLayout="route"
      mobileSheetVh={mobileSheetVh}
      elevators={elevators}
      routeElevatorIds={routeElevatorIds}
    />
  );
}

function mapPropsAreEqual(prev: RoutePageMapProps, next: RoutePageMapProps): boolean {
  const skipVolatileNav = prev.navigating && next.navigating;

  const stableKeys: (keyof RoutePageMapProps)[] = [
    "buildings",
    "route",
    "routeEndpoints",
    "origin",
    "destination",
    "navigating",
    "pickMode",
    "mobileSheetVh",
    "elevators",
    "routeElevatorIds",
    "userPosRef",
    "deviceHeadingRef",
    "navMotionRef",
    "onBuildingSelect",
    "onMapPick",
  ];

  for (const key of stableKeys) {
    if (prev[key] !== next[key]) return false;
  }

  if (!skipVolatileNav) {
    if (prev.userPos !== next.userPos) return false;
    if (prev.userHeading !== next.userHeading) return false;
    if (prev.routeHeading !== next.routeHeading) return false;
  }

  return true;
}

export const RoutePageMap = memo(RoutePageMapInner, mapPropsAreEqual);
