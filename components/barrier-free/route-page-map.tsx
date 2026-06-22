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
  onFollowPausedChange?: (paused: boolean) => void;
  onRerouteRoute?: () => void;
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
  onFollowPausedChange,
  onRerouteRoute,
}: RoutePageMapProps) {
  const mapRouteDisplay = useMemo(() => {
    if (!route?.coords || route.coords.length < 2) {
      return { coords: null, segmentTypes: null };
    }
    return simplifyForMapDisplay(route.coords, route.segmentTypes ?? []);
  }, [route]);

  const mapOriginPoint = useMemo(() => {
    if (navigating) {
      if (userPos) return userPos;
      if (origin?.kind === "gps" && origin.point) return origin.point;
    }
    return routeEndpoints?.from ?? origin?.point ?? null;
  }, [navigating, userPos, origin, routeEndpoints]);

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
      onFollowPausedChange={onFollowPausedChange}
      onRerouteRoute={onRerouteRoute}
    />
  );
}

/** 안내 중 — null→첫 GPS·안내 종료만 리렌더, 이후 위치는 userPosRef */
function navUserPosNeedsRender(prev: LatLng | null, next: LatLng | null): boolean {
  if (prev === next) return false;
  if (!prev && next) return true;
  if (prev && !next) return true;
  return false;
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
    "onFollowPausedChange",
    "onRerouteRoute",
  ];

  for (const key of stableKeys) {
    if (prev[key] !== next[key]) return false;
  }

  if (skipVolatileNav) {
    if (navUserPosNeedsRender(prev.userPos, next.userPos)) return false;
  } else {
    if (prev.userPos !== next.userPos) return false;
    if (prev.userHeading !== next.userHeading) return false;
    if (prev.routeHeading !== next.routeHeading) return false;
  }

  return true;
}

export const RoutePageMap = memo(RoutePageMapInner, mapPropsAreEqual);
