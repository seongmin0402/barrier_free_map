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

type LngLat = [number, number];

interface WalkwayChain {
  coords: LngLat[];
  type: WalkwayType;
  reverse?: boolean;
}

/** GeoJSON [lng,lat] → 앱 좌표 */
function toLatLng([lng, lat]: LngLat): LatLng {
  return { lat, lng };
}

function flattenWalkways(chains: WalkwayChain[]): { coords: LatLng[]; segmentTypes: WalkwayType[] } {
  const coords: LatLng[] = [];
  const segmentTypes: WalkwayType[] = [];

  for (const chain of chains) {
    const pts = chain.reverse ? [...chain.coords].reverse() : chain.coords;
    for (let i = 0; i < pts.length; i++) {
      const pt = toLatLng(pts[i]);
      if (coords.length && haversineMeters(coords[coords.length - 1], pt) <= JOIN_M) continue;
      if (coords.length > 0) segmentTypes.push(chain.type);
      coords.push(pt);
    }
  }

  return { coords, segmentTypes };
}

/** Dijkstra 없이 보행로 좌표를 그대로 경로로 사용 */
function polylineRoute(
  chains: WalkwayChain[],
  locale: AppLocale,
  start: LatLng,
  end: LatLng,
): ComputedRoute | null {
  const { coords, segmentTypes } = flattenWalkways(chains);
  if (!coords.length) return null;

  const merged: LatLng[] = [start];
  const mergedTypes: WalkwayType[] = [];

  for (let i = 0; i < coords.length; i++) {
    const pt = coords[i];
    if (haversineMeters(merged[merged.length - 1], pt) <= JOIN_M) continue;
    mergedTypes.push(i === 0 ? "path" : (segmentTypes[i - 1] ?? "path"));
    merged.push(pt);
  }

  if (haversineMeters(merged[merged.length - 1], end) > JOIN_M) {
    mergedTypes.push("path");
    merged.push(end);
  } else {
    merged[merged.length - 1] = end;
  }

  if (merged.length < 2) return null;

  let distance = 0;
  for (let i = 0; i < merged.length - 1; i++) {
    distance += haversineMeters(merged[i], merged[i + 1]);
  }

  const hasStairs = mergedTypes.some((t) => t === "stairs");
  const hasCrosswalk = mergedTypes.some((t) => t === "crosswalk");
  const hasRamp = mergedTypes.some((t) => t === "ramp");

  return {
    coords: merged,
    distance,
    steps: [
      {
        text: locale === "en" ? "Follow the guided campus route" : "안내 경로를 따라 이동하세요",
        distance,
        at: merged[0],
        maneuver: "depart",
        edgeType: mergedTypes[0] ?? "path",
        hazard: hasRamp ? (locale === "en" ? "Ramp ahead" : "경사로 구간") : null,
      },
      {
        text: "",
        distance: 0,
        at: merged[merged.length - 1],
        maneuver: "arrive",
        edgeType: mergedTypes[mergedTypes.length - 1] ?? "path",
        hazard: null,
      },
    ],
    hasStairs,
    hasCrosswalk,
    hasElevator: false,
    segmentTypes: mergedTypes,
  };
}

/**
 * 교양관 서쪽 → 열린광장 서측 → 운동장 남서 코너 → 비전하우스 → 인문관
 * (사진 검은 선 동선 — w_0198·w_0240 북측·웅비학생회관 방면 미경유)
 */
function buildOutdoorPolylineLeg(
  gyoyangWest: LatLng,
  visionA: LatLng,
  humanitiesMain: LatLng,
  locale: AppLocale,
): ComputedRoute | null {
  return polylineRoute(
    [
      // 교양 서쪽 후문 경사로 (w_0387)
      {
        type: "ramp",
        coords: [
          [127.139304338469103, 36.469560738162265],
          [127.139283637665557, 36.469523579839269],
          [127.139268447744172, 36.469530918225523],
        ],
      },
      // 교양 서측 횡단 (w_0194)
      {
        type: "path",
        coords: [
          [127.139121735783249, 36.469233890916342],
          [127.138637985925399, 36.469328629390311],
          [127.138492198297016, 36.469407972773183],
          [127.138403842158638, 36.469489684530373],
          [127.138358191487129, 36.469597449179872],
          [127.138319903827153, 36.469669686937969],
        ],
      },
      // 열린광장 서쪽 도로 남하 (w_0531 역방향)
      {
        type: "path",
        reverse: true,
        coords: [
          [127.137646924572806, 36.46835281756271],
          [127.137709198414484, 36.468430012968518],
          [127.138073532339604, 36.469249521589347],
          [127.13805136993561, 36.46945096366295],
          [127.138048020082039, 36.469497888022268],
          [127.138182245526849, 36.469666922040567],
          [127.138319903827153, 36.469669686937969],
        ],
      },
      // 서측 도로 → 운동장 서남단 (w_0531/w_0240 연결)
      {
        type: "path",
        coords: [
          [127.137646924572806, 36.46835281756271],
          [127.137449964014081, 36.468655983717589],
        ],
      },
      // 운동장 서측 남하 (w_0240 하단)
      {
        type: "path",
        coords: [
          [127.137449964014081, 36.468655983717589],
          [127.137410203751799, 36.468551770485561],
          [127.137391059921796, 36.468419135260355],
          [127.137391059921796, 36.468196497050762],
          [127.137418671215102, 36.467750034458938],
        ],
      },
      // 운동장 남서 → 비전하우스 (w_0234·w_0367)
      {
        type: "path",
        coords: [
          [127.137418671215102, 36.467750034458938],
          [127.137925246408713, 36.467739376169405],
          [visionA.lng, visionA.lat],
          [127.137914938192566, 36.467487129554833],
          [127.138052269376843, 36.467247505270919],
        ],
      },
      // 비전 → 인문관 (w_0009 + w_0355 경사로)
      {
        type: "path",
        coords: [
          [127.138052269376843, 36.467247505270919],
          [127.137880283718019, 36.466505931413238],
          [127.137951975692857, 36.466400411804379],
          [127.138084538212098, 36.46631773654655],
          [127.138369953432203, 36.46619045999045],
        ],
      },
      {
        type: "ramp",
        coords: [
          [127.138369953432203, 36.46619045999045],
          [127.138395168983749, 36.466239284488786],
          [127.138319008453891, 36.466279404767903],
          [127.138335328567422, 36.466299124905092],
          [127.138450929371729, 36.466246764540806],
          [127.138507995398811, 36.466254190708995],
        ],
      },
    ],
    locale,
    gyoyangWest,
    humanitiesMain,
  );
}

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
  const gyoyangRearWest = entrancePoint(entrances, "e_0033");
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
    // 10. 교양관 서쪽 후문까지
    pushWalk(libraryMain1F, gyoyangRearWest);
    // 11–13. 실외 구간 — 사진 검은 선과 동일한 보행로 좌표 고정
    const outdoor = buildOutdoorPolylineLeg(gyoyangRearWest, visionA, humanitiesMain, locale);
    if (!outdoor) throw new Error("fixed route outdoor leg failed");
    legs.push(outdoor);
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
