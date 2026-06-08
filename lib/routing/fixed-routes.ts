import type { AppLocale } from "@/lib/app-settings";
import { arriveMessage, elevatorTransferText } from "@/lib/i18n/navigation";
import { formatFloorLabel, type ElevatorRecord } from "./elevators";
import { haversineMeters, type LatLng } from "./geo";
import { normalizeBuildingId } from "./graph";
import { computeRoute } from "./route";
import type {
  BuildingEntrance,
  ComputedRoute,
  RoutePairResult,
  RoutePoint,
  RouteStep,
  RoutingGraph,
  WalkwayType,
} from "./types";

const DREAM_BUILDING_ID = "b-28";
const HUMANITIES_BUILDING_ID = "b-0";

const JOIN_M = 4;

function entrancePoint(entrances: BuildingEntrance[], id: string): LatLng {
  const hit = entrances.find((e) => e.id === id);
  if (!hit) throw new Error(`entrance ${id} not found`);
  return hit.point;
}

function elevatorById(elevators: ElevatorRecord[], id: string): ElevatorRecord {
  const hit = elevators.find((e) => e.id === id);
  if (!hit) throw new Error(`elevator ${id} not found`);
  return hit;
}

function walkLeg(
  graph: RoutingGraph,
  from: LatLng,
  to: LatLng,
  locale: AppLocale,
): ComputedRoute | null {
  return (
    computeRoute(graph, from, to, locale, { profile: "comfort" }) ??
    computeRoute(graph, from, to, locale, { profile: "fast" })
  );
}

function elevatorLeg(
  at: LatLng,
  elevator: ElevatorRecord,
  toFloor: string,
  locale: AppLocale,
): ComputedRoute {
  const floorLabel = formatFloorLabel(toFloor, locale);
  const step: RouteStep = {
    text: elevatorTransferText(floorLabel, locale, elevator.name),
    distance: 0,
    at,
    maneuver: "elevator",
    edgeType: "elevator",
    hazard: null,
  };
  return {
    coords: [at],
    segmentTypes: [],
    distance: 0,
    steps: [step],
    hasStairs: false,
    hasCrosswalk: false,
    hasElevator: true,
  };
}

function mergeComputedRoutes(parts: ComputedRoute[]): ComputedRoute | null {
  if (!parts.length) return null;

  const coords: LatLng[] = [];
  const segmentTypes: WalkwayType[] = [];
  const steps: RouteStep[] = [];
  let distance = 0;
  let hasStairs = false;
  let hasCrosswalk = false;
  let hasElevator = false;

  for (const part of parts) {
    distance += part.distance;
    hasStairs = hasStairs || part.hasStairs;
    hasCrosswalk = hasCrosswalk || part.hasCrosswalk;
    hasElevator = hasElevator || part.hasElevator;

    if (!coords.length) {
      coords.push(...part.coords);
      segmentTypes.push(...part.segmentTypes);
      for (const step of part.steps) steps.push(step);
      continue;
    }

    let skip = 0;
    if (part.coords.length && haversineMeters(coords[coords.length - 1], part.coords[0]) <= JOIN_M) {
      skip = 1;
    }
    const addedCoords = part.coords.slice(skip);
    if (addedCoords.length >= 1) {
      for (let i = 0; i < addedCoords.length - 1; i++) {
        const segIdx = skip + i;
        if (segIdx < part.segmentTypes.length) {
          segmentTypes.push(part.segmentTypes[segIdx]);
        } else {
          segmentTypes.push("path");
        }
      }
      coords.push(...addedCoords);
    }

    for (const step of part.steps) {
      if (step.maneuver === "depart" && steps.some((s) => s.maneuver === "depart")) continue;
      if (step.maneuver === "arrive") continue;
      steps.push(step);
    }
  }

  if (coords.length < 2) return null;

  const last = coords[coords.length - 1];
  steps.push({
    text: "",
    distance: 0,
    at: last,
    maneuver: "arrive",
    edgeType: segmentTypes[segmentTypes.length - 1] ?? "path",
    hazard: null,
  });

  return {
    coords,
    distance,
    steps,
    hasStairs,
    hasCrosswalk,
    hasElevator,
    segmentTypes,
  };
}

/** 드림하우스 → 인문사회과학대학관 현장 동선 (승강기·경사로 시나리오) */
export function buildDreamToHumanitiesRoute(
  graph: RoutingGraph,
  entrances: BuildingEntrance[],
  elevators: ElevatorRecord[],
  locale: AppLocale,
): ComputedRoute | null {
  if (!graph.nodes.size) return null;

  const dreamEntrance = entrancePoint(entrances, "e_0077");
  const sanhakB1 = entrancePoint(entrances, "e_0075");
  const sanhakMain = entrancePoint(entrances, "e_0074");
  const libraryRear3F = entrancePoint(entrances, "e_0029");
  const libraryMain1F = entrancePoint(entrances, "e_0028");
  const gyoyangWest = entrancePoint(entrances, "e_0030");
  const plazaSouth = entrancePoint(entrances, "e_0042");
  const visionA = entrancePoint(entrances, "e_0014");
  const humanitiesMain = entrancePoint(entrances, "e_0004");

  const evSanhak = elevatorById(elevators, "ev_004");
  const evMirae = elevatorById(elevators, "ev_003");
  const evLibrary = elevatorById(elevators, "ev_001");

  const legs: ComputedRoute[] = [];

  const pushWalk = (from: LatLng, to: LatLng) => {
    const leg = walkLeg(graph, from, to, locale);
    if (!leg) throw new Error("fixed route walk leg failed");
    legs.push(leg);
  };

  try {
    // 1. 드림하우스 B동입구 → 산학연구관 지하1층 입구
    pushWalk(dreamEntrance, sanhakB1);
    // 2. 산학 승강기 B1 → 1F
    legs.push(elevatorLeg(evSanhak.point, evSanhak, "1F", locale));
    // 3. 산학 정문으로 이동
    pushWalk(evSanhak.point, sanhakMain);
    // 4. 산학 정문 → 미래융합 승강기
    pushWalk(sanhakMain, evMirae.point);
    // 5. 미래융합 B1 → 2F
    legs.push(elevatorLeg(evMirae.point, evMirae, "2F", locale));
    // 6. 중앙도서관 3층 후문(경사로) 방향
    pushWalk(evMirae.point, libraryRear3F);
    // 7. 도서관 3층 → 승강기
    pushWalk(libraryRear3F, evLibrary.point);
    // 8. 도서관 승강기 3F → 1F
    legs.push(elevatorLeg(evLibrary.point, evLibrary, "1F", locale));
    // 9. 도서관 1층 정문
    pushWalk(evLibrary.point, libraryMain1F);
    // 10. 교양관 방향 (경사로 인도)
    pushWalk(libraryMain1F, gyoyangWest);
    // 11. 열린광장·운동장 쪽
    pushWalk(gyoyangWest, plazaSouth);
    // 12. 비전하우스
    pushWalk(plazaSouth, visionA);
    // 13. 인문사회과학대학관
    pushWalk(visionA, humanitiesMain);
  } catch {
    return null;
  }

  const merged = mergeComputedRoutes(legs);
  if (!merged) return null;

  // 출발·도착 문구는 merge 후 상위에서 보완되므로 depart/arrive 텍스트만 정리
  if (merged.steps[0]?.maneuver === "depart") {
    merged.steps[0].text = locale === "en" ? "Follow the guided campus route" : "안내 경로를 따라 이동하세요";
  }
  const arrive = merged.steps[merged.steps.length - 1];
  if (arrive?.maneuver === "arrive") {
    arrive.text = arriveMessage(locale);
  }

  return merged;
}

export function isDreamToHumanitiesPair(origin: RoutePoint, destination: RoutePoint): boolean {
  return (
    origin.kind === "building" &&
    destination.kind === "building" &&
    normalizeBuildingId(origin.buildingId) === DREAM_BUILDING_ID &&
    normalizeBuildingId(destination.buildingId) === HUMANITIES_BUILDING_ID
  );
}

export function tryFixedRoutePair(
  graph: RoutingGraph,
  entrances: BuildingEntrance[],
  elevators: ElevatorRecord[],
  origin: RoutePoint,
  destination: RoutePoint,
  locale: AppLocale,
): RoutePairResult | null {
  if (!isDreamToHumanitiesPair(origin, destination)) return null;

  const route = buildDreamToHumanitiesRoute(graph, entrances, elevators, locale);
  if (!route) return null;

  const dreamEntrance = entrancePoint(entrances, "e_0077");
  const humanitiesMain = entrancePoint(entrances, "e_0004");
  const endpoints = { from: dreamEntrance, to: humanitiesMain };

  return {
    fast: route,
    comfort: route,
    endpoints: { fast: endpoints, comfort: endpoints },
  };
}
