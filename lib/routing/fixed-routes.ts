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

/** 등록된 보행로 좌표만 사용 (끝점 임의 연결·출입구 직결 없음) */
function polylineFromChains(chains: WalkwayChain[], locale: AppLocale): ComputedRoute | null {
  const { coords, segmentTypes } = flattenWalkways(chains);
  if (coords.length < 2) return null;

  let distance = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    distance += haversineMeters(coords[i], coords[i + 1]);
  }

  const hasStairs = segmentTypes.some((t) => t === "stairs");
  const hasCrosswalk = segmentTypes.some((t) => t === "crosswalk");
  const hasRamp = segmentTypes.some((t) => t === "ramp");

  return {
    coords,
    distance,
    steps: [
      {
        text: locale === "en" ? "Follow the guided campus route" : "안내 경로를 따라 이동하세요",
        distance,
        at: coords[0],
        maneuver: "depart",
        edgeType: segmentTypes[0] ?? "path",
        hazard: hasRamp ? (locale === "en" ? "Ramp ahead" : "경사로 구간") : null,
      },
      {
        text: "",
        distance: 0,
        at: coords[coords.length - 1],
        maneuver: "arrive",
        edgeType: segmentTypes[segmentTypes.length - 1] ?? "path",
        hazard: null,
      },
    ],
    hasStairs,
    hasCrosswalk,
    hasElevator: false,
    segmentTypes,
  };
}

/** 중앙도서관 정문·횡단·서측 보행로 좌표 (bb_4326 walkways) */
const W_0382: LngLat[] = [
  [127.140534697696651, 36.469289549783831],
  [127.140584139961561, 36.469311155058556],
];

const W_0170: LngLat[] = [
  [127.140543533310563, 36.469182376822509],
  [127.140534697696651, 36.469289549783831],
];

const W_0166: LngLat[] = [
  [127.140229869019237, 36.46918119259005],
  [127.140543533310563, 36.469182376822509],
];

const W_0165: LngLat[] = [
  [127.140229869019237, 36.46918119259005],
  [127.13998983484322, 36.469200140306981],
];

const W_0189: LngLat[] = [
  [127.13998983484322, 36.469200140306974],
  [127.139942343418696, 36.469225009178452],
  [127.139858405087224, 36.469243956884696],
  [127.139785511273061, 36.469275931128465],
  [127.13967359349769, 36.469293102476151],
];

const W_0191: LngLat[] = [
  [127.139666598636708, 36.469277411417202],
  [127.13967359349769, 36.469293102476151],
];

const W_0190: LngLat[] = [
  [127.139660340076972, 36.469264088817496],
  [127.139666598636708, 36.469277411417202],
];

const W_0188: LngLat[] = [
  [127.139614689405462, 36.469131454811055],
  [127.139660340076972, 36.469264088817496],
];

const W_0192: LngLat[] = [
  [127.139614689405462, 36.469131454811055],
  [127.139121735783249, 36.469233890916342],
];

const W_0194: LngLat[] = [
  [127.139121735783249, 36.469233890916342],
  [127.138637985925399, 36.469328629390311],
  [127.138492198297016, 36.469407972773183],
  [127.138403842158638, 36.469489684530373],
  [127.138358191487129, 36.469597449179872],
  [127.138319903827153, 36.469669686937969],
];

const W_0531: LngLat[] = [
  [127.137646924572806, 36.46835281756271],
  [127.137709198414484, 36.468430012968518],
  [127.138073532339604, 36.469249521589347],
  [127.13805136993561, 36.46945096366295],
  [127.138048020082039, 36.469497888022268],
  [127.138182245526849, 36.469666922040567],
  [127.138319903827153, 36.469669686937969],
];

const W_0234: LngLat[] = [
  [127.137925246408713, 36.467739376169405],
  [127.137842780679591, 36.467937146415231],
  [127.137646924572749, 36.4682497881698],
  [127.137646924572806, 36.46835281756271],
];

/**
 * 중앙도서관 1층 정문 → 직진 → 횡단보도 → 서측 도로 → 캠퍼스 서쪽 동선
 * (w_0382·w_0165·w_0189 직진/횡단/서향 후 w_0194·w_0531·w_0234)
 */
function buildLibraryToCampusWestLeg(locale: AppLocale): ComputedRoute | null {
  return polylineFromChains(
    [
      { type: "path", reverse: true, coords: W_0382 },
      { type: "path", reverse: true, coords: W_0170 },
      { type: "path", reverse: true, coords: W_0166 },
      { type: "crosswalk", coords: W_0165 },
      { type: "path", coords: W_0189 },
      { type: "path", reverse: true, coords: W_0191 },
      { type: "stairs", reverse: true, coords: W_0190 },
      { type: "crosswalk", reverse: true, coords: W_0188 },
      { type: "path", coords: W_0192 },
      { type: "path", coords: W_0194 },
      { type: "path", reverse: true, coords: W_0531 },
      { type: "path", reverse: true, coords: W_0234 },
    ],
    locale,
  );
}

/**
 * 실외 구간: 비전하우스·인문관 (보행 그래프)
 */
function buildOutdoorLeg(
  graph: RoutingGraph,
  visionA: LatLng,
  humanitiesMain: LatLng,
  locale: AppLocale,
): ComputedRoute | null {
  const w0234Vision = toLatLng(W_0234[0]);

  const parts: ComputedRoute[] = [];

  try {

    const toVision = walkLeg(graph, w0234Vision, visionA, locale);
    if (!toVision) throw new Error("w_0234 to vision failed");
    parts.push(toVision);

    const toHumanities = walkLeg(graph, visionA, humanitiesMain, locale);
    if (!toHumanities) throw new Error("vision to humanities failed");
    parts.push(toHumanities);
  } catch {
    return null;
  }

  return mergeComputedRoutes(parts);
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

/** 승강기 직전 도보 구간 — computeRoute가 만든 승강기 단계 제거(고정 elevatorLeg와 중복 방지) */
function withoutElevatorSteps(leg: ComputedRoute): ComputedRoute {
  if (!leg.steps.some((s) => s.maneuver === "elevator")) return leg;
  const steps = leg.steps.filter((s) => s.maneuver !== "elevator");
  return { ...leg, steps, hasElevator: false };
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

/** 병합 시 출발·도착·연속 승강기 안내 중복 제거 */
function appendMergedStep(steps: RouteStep[], step: RouteStep): void {
  if (step.maneuver === "depart" && steps.some((s) => s.maneuver === "depart")) return;
  if (step.maneuver === "arrive") return;

  const last = steps[steps.length - 1];
  if (step.maneuver === "elevator" && last?.maneuver === "elevator") {
    const samePlace = haversineMeters(last.at, step.at) <= JOIN_M;
    if (samePlace || last.text === step.text) {
      // walkLeg 자동 승강기 안내 대신 고정 시나리오(elevatorLeg) 문구 유지
      steps[steps.length - 1] = step;
      return;
    }
  }

  steps.push(step);
}

/** 병합 후에도 남는 연속 승강기 안내(동일 문구·근접 위치) 제거 */
function dedupeElevatorSteps(steps: RouteStep[]): void {
  for (let i = steps.length - 1; i > 0; i--) {
    const cur = steps[i];
    const prev = steps[i - 1];
    if (cur.maneuver !== "elevator" || prev.maneuver !== "elevator") continue;
    if (prev.text === cur.text || haversineMeters(prev.at, cur.at) <= JOIN_M) {
      steps.splice(i, 1);
    }
  }
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
      for (const step of part.steps) {
        appendMergedStep(steps, step);
      }
      continue;
    }

    let fromIdx = 0;
    if (part.coords.length && haversineMeters(coords[coords.length - 1], part.coords[0]) <= JOIN_M) {
      fromIdx = 1;
    }

    for (let i = fromIdx; i < part.coords.length; i++) {
      const pt = part.coords[i];
      if (coords.length && haversineMeters(coords[coords.length - 1], pt) <= JOIN_M) continue;

      const typeIdx = i - 1;
      if (typeIdx >= 0 && typeIdx < part.segmentTypes.length) {
        segmentTypes.push(part.segmentTypes[typeIdx]);
      } else if (coords.length > 0) {
        segmentTypes.push("path");
      }
      coords.push(pt);
    }

    for (const step of part.steps) {
      appendMergedStep(steps, step);
    }
  }

  if (coords.length < 2) return null;

  while (segmentTypes.length < coords.length - 1) segmentTypes.push("path");
  if (segmentTypes.length > coords.length - 1) {
    segmentTypes.length = coords.length - 1;
  }

  dedupeElevatorSteps(steps);

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
  const visionA = entrancePoint(entrances, "e_0014");
  const humanitiesMain = entrancePoint(entrances, "e_0004");

  const evSanhak = elevatorById(elevators, "ev_004");
  const evMirae = elevatorById(elevators, "ev_003");
  const evLibrary = elevatorById(elevators, "ev_001");

  const legs: ComputedRoute[] = [];

  const pushWalk = (from: LatLng, to: LatLng, beforeElevator = false) => {
    let leg = walkLeg(graph, from, to, locale);
    if (!leg) throw new Error("fixed route walk leg failed");
    if (beforeElevator) leg = withoutElevatorSteps(leg);
    legs.push(leg);
  };

  try {
    // 1. 드림하우스 B동입구 → 산학연구관 지하1층 입구
    pushWalk(dreamEntrance, sanhakB1, true);
    // 2. 산학 승강기 B1 → 1F
    legs.push(elevatorLeg(evSanhak.point, evSanhak, "1F", locale));
    // 3. 산학 정문으로 이동
    pushWalk(evSanhak.point, sanhakMain);
    // 4. 산학 정문 → 미래융합 승강기
    pushWalk(sanhakMain, evMirae.point, true);
    // 5. 미래융합 B1 → 2F
    legs.push(elevatorLeg(evMirae.point, evMirae, "2F", locale));
    // 6. 중앙도서관 3층 후문(경사로) 방향
    pushWalk(evMirae.point, libraryRear3F);
    // 7. 도서관 3층 → 승강기
    pushWalk(libraryRear3F, evLibrary.point, true);
    // 8. 도서관 승강기 3F → 1F
    legs.push(elevatorLeg(evLibrary.point, evLibrary, "1F", locale));
    // 9. 도서관 1층 정문
    pushWalk(evLibrary.point, libraryMain1F);
    // 10. 도서관 정문 직진 → 횡단보도 → 서측 도로 → 열린광장 서쪽 (웅비 미경유)
    const libraryToCampusWest = buildLibraryToCampusWestLeg(locale);
    if (!libraryToCampusWest) throw new Error("library to campus west failed");
    legs.push(libraryToCampusWest);
    // 11–12. 비전하우스 → 인문관
    const outdoor = buildOutdoorLeg(graph, visionA, humanitiesMain, locale);
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
