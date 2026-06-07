import type { AppLocale } from "@/lib/app-settings";

export type UiText = {
  header: {
    university: string;
    subtitleShort: string;
    subtitleFull: string;
    searchPlaceholder: string;
    searchPlaceholderShort: string;
    settingsAria: string;
  };
  sidebar: {
    filtersAndList: string;
    facilityFilter: string;
    buildingList: string;
    count: (n: number) => string;
    countOf: (filtered: number, total: number) => string;
    empty: string;
    facilities: (n: number) => string;
    selected: string;
    close: string;
    open: string;
    accessibilityGrade: string;
    gradeA: string;
    gradeB: string;
    gradeC: string;
  };
  facilities: Record<"elevator" | "ramp" | "toilet" | "braille" | "auto-door", string>;
  facilitiesShort: Record<"elevator" | "ramp" | "toilet" | "braille" | "auto-door", string>;
  grade: Record<
    "A" | "B" | "C",
    { label: string; description: string }
  >;
  gradeUnsurveyed: string;
  map: {
    loading: string;
    scriptError: string;
    scriptErrorHint: string;
    clientIdRequired: string;
    clientIdHint: string;
    mapOptions: string;
    mapTypes: Record<"NORMAL" | "TERRAIN" | "SATELLITE" | "HYBRID", string>;
    campusOverview: string;
    myLocation: string;
    zoomIn: string;
    zoomOut: string;
    mapOptionsOpen: string;
    mapOptionsClose: string;
    footprintLegend: string;
    footprintHint: string;
    gradeGuideOpen: string;
    pickOrigin: string;
    pickDestination: string;
    originMarker: string;
    destMarker: string;
    myLocationTitle: string;
    noBarrierInfo: (name: string) => string;
    geoUnsupported: string;
    mapNotReady: string;
    geoFailed: string;
    geoDenied: string;
    geoUnavailable: string;
    geoTimeout: string;
    locationDialogTitle: string;
    locationDialogBody: string;
    locationDialogCancel: string;
    locationDialogConfirm: string;
    gradeGuideTitle: string;
    gradeGuideIntro: string;
    gradeGuideClose: string;
    gradeGuideA: string;
    gradeGuideB: string;
    gradeGuideC: string;
    gradeGuideUnsurveyed: string;
    buildingFallback: string;
    facilityFilterMatch: (name: string) => string;
  };
  building: {
    selected: string;
    viewDetails: string;
    close: string;
    yes: string;
    no: string;
    wheelchairAccess: string;
    statusAvailable: string;
    statusExists: string;
    statusNone: string;
    moreDetails: string;
    elevator: string;
    toilet: string;
    braille: string;
    autoDoor: string;
    threshold: string;
    ramp: string;
    parking: string;
    parkingAvailable: (n: number, m: number) => string;
    parkingNone: string;
    facilitiesSection: string;
    photoSummary: string;
    floorPhotos: string;
    floorPhotosHint: string;
    photosCount: (n: number) => string;
    naverMap: string;
    unsurveyedNotice: string;
    gradeLine: (floor: string, level: string, label: string, desc: string) => string;
    enlargedImage: string;
  };
  route: {
    title: string;
    back: string;
    origin: string;
    destination: string;
    searchPlaceholder: string;
    pickOnMap: string;
    currentLocation: string;
    clearPoint: (label: string) => string;
    swap: string;
    sheetResize: string;
    aboutMinutes: string;
    min: string;
    walking: string;
    walkwayBased: string;
    stairsWarning: string;
    elevatorNotice: string;
    startNav: string;
    stopNav: string;
    acquiringGps: string;
    navActive: string;
    offRouteWarning: string;
    reroutedNotice: string;
    voiceOn: string;
    voiceOff: string;
    voiceOnTitle: string;
    voiceOffTitle: string;
    emptyHint1: string;
    emptyHint2: string;
    total: string;
    fitRoute: string;
    resumeFollow: string;
    followPausedHint: string;
    errors: {
      loadingWalkways: string;
      noRoute: string;
      geoUnsupported: string;
      navGeoUnsupported: string;
      geoDenied: string;
      geoUnavailable: string;
      geoTimeout: string;
      geoFailed: string;
      trackFailed: string;
      rerouteFailed: string;
    };
    currentLocationLabel: string;
    mapPickLabel: (lat: number, lng: number) => string;
    legendTitle: string;
    distanceAhead: string;
    legend: Record<"path" | "crosswalk" | "stairs" | "ramp", string>;
  };
  page: {
    directions: string;
    loadError: string;
  };
  filterBar: {
    ariaLabel: string;
    all: string;
    report: string;
    mapHintAll: string;
    mapHintFiltered: (labels: string) => string;
    mapHintAllShort: string;
    mapHintFilteredShort: (labels: string) => string;
    reportShort: string;
  };
  settings: {
    title: string;
    close: string;
    language: string;
    languageHint: string;
    highContrast: string;
    highContrastHint: string;
    fontSize: string;
    fontSizeHint: (pct: number) => string;
    fontSm: string;
    fontLg: string;
    preview: string;
    savedHint: string;
    localeKo: string;
    localeEn: string;
  };
};

const ko: UiText = {
  header: {
    university: "공주대학교",
    subtitleShort: "베리어프리맵",
    subtitleFull: "신관캠퍼스 베리어프리맵",
    searchPlaceholder: "예: 중앙도서관, 엘리베이터, 경사로",
    searchPlaceholderShort: "건물·시설 검색 (예: 중앙도서관)",
    settingsAria: "접근성 설정",
  },
  sidebar: {
    filtersAndList: "필터와 목록",
    facilityFilter: "시설 필터",
    buildingList: "건물 목록",
    count: (n) => `${n}개`,
    countOf: (f, t) => `${f} / ${t}개`,
    empty: "조건에 맞는 건물이 없습니다.",
    facilities: (n) => `${n}개 시설`,
    selected: " (선택됨)",
    close: "사이드바 닫기",
    open: "사이드바 열기",
    accessibilityGrade: "접근성 등급",
    gradeA: "A 우수",
    gradeB: "B 양호",
    gradeC: "C 개선필요",
  },
  facilities: {
    elevator: "엘리베이터",
    ramp: "경사로",
    toilet: "장애인 화장실",
    braille: "점자블록",
    "auto-door": "자동문",
  },
  facilitiesShort: {
    elevator: "엘리베이터",
    ramp: "경사로",
    toilet: "화장실",
    braille: "점자",
    "auto-door": "자동문",
  },
  grade: {
    A: { label: "우수", description: "접근성 시설 충실" },
    B: { label: "양호", description: "주요 일부만 구비" },
    C: { label: "개선필요", description: "이동약자에게 어려울 수 있음" },
  },
  gradeUnsurveyed: "미조사",
  map: {
    loading: "베리어프리맵을 불러오는 중…",
    scriptError: "지도 스크립트를 불러오지 못했습니다.",
    scriptErrorHint:
      "네이버 클라우드에서 이 도메인을 허용했는지, NEXT_PUBLIC_NAVER_MAP_CLIENT_ID가 빌드에 포함됐는지 확인한 뒤 새로고침 해 주세요.",
    clientIdRequired: "네이버 지도 클라이언트 ID 필요",
    clientIdHint:
      "네이버 클라우드 플랫폼에서 Dynamic Map을 활성화한 애플리케이션 클라이언트 ID를 NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 에 넣어 주세요. Vercel 프로젝트 설정에도 같은 환경 변수를 추가해야 배포 환경에서 지도가 열립니다.",
    mapOptions: "지도 옵션",
    mapTypes: { NORMAL: "일반", TERRAIN: "지형", SATELLITE: "위성", HYBRID: "하이브리드" },
    campusOverview: "전체 보기",
    myLocation: "내 위치",
    zoomIn: "확대",
    zoomOut: "축소",
    mapOptionsOpen: "지도 옵션 열기",
    mapOptionsClose: "지도 옵션 닫기",
    footprintLegend: "건물 테두리 (등급)",
    footprintHint: "건물 폴리곤을 눌러 상세 정보를 볼 수 있습니다.",
    gradeGuideOpen: "접근성 등급 설명 열기",
    pickOrigin: "지도에서 출발지를 터치하세요",
    pickDestination: "지도에서 도착지를 터치하세요",
    originMarker: "출",
    destMarker: "도",
    myLocationTitle: "내 위치",
    noBarrierInfo: (name) => `${name}: 베리어프리 조사 정보가 없습니다.`,
    geoUnsupported: "이 브라우저는 위치 정보를 지원하지 않습니다.",
    mapNotReady: "지도가 준비된 뒤 다시 시도해 주세요.",
    geoFailed: "위치를 가져올 수 없습니다.",
    geoDenied: "위치 권한이 거부되었습니다.",
    geoUnavailable: "위치를 확인할 수 없습니다.",
    geoTimeout: "위치 확인 시간이 초과되었습니다.",
    locationDialogTitle: "현재 위치를 사용할까요?",
    locationDialogBody:
      "지도에서 내 위치를 표시하려면 기기의 위치 정보가 필요합니다. 아래에서 동의하면 브라우저에서 위치 접근 허용 여부를 추가로 묻습니다. 허용하지 않으면 내 위치를 표시할 수 없습니다.",
    locationDialogCancel: "취소",
    locationDialogConfirm: "위치 사용에 동의합니다",
    gradeGuideTitle: "접근성 등급 안내",
    gradeGuideIntro:
      "건물별 접근성 등급은 현장 조사 결과를 바탕으로 안내하며, 이용자마다 체감이 다를 수 있습니다.",
    gradeGuideClose: "닫기",
    gradeGuideA:
      "A 우수 · 주요 이동 동선에서 접근이 비교적 원활하고 편의시설이 전반적으로 잘 갖춰진 건물",
    gradeGuideB:
      "B 양호 · 이용은 가능하지만 일부 구간(문턱, 동선, 시설 수 등)에 보완이 필요한 건물",
    gradeGuideC:
      "C 개선필요 · 이동 또는 이용에 제약이 커서 사전 확인과 도움이 필요한 건물",
    gradeGuideUnsurveyed: "미조사 · 상세 접근성 데이터가 아직 등록되지 않은 건물",
    buildingFallback: "건물",
    facilityFilterMatch: (name) => `${name} · 시설 필터 매치`,
  },
  building: {
    selected: "선택된 건물",
    viewDetails: "자세히 보기",
    close: "닫기",
    yes: "예",
    no: "아니오",
    wheelchairAccess: "휠체어 진입",
    statusAvailable: "가능",
    statusExists: "있음",
    statusNone: "없음",
    moreDetails: "추가 정보",
    elevator: "승강기",
    toilet: "장애인 화장실",
    braille: "점자블록",
    autoDoor: "자동문",
    threshold: "문턱·단차 존재(조사 결과)",
    ramp: "경사로",
    parking: "장애인 주차",
    parkingAvailable: (n, m) => `${n}대 가능 · 입구 약 ${m}m`,
    parkingNone: "전용 구역 없음 또는 미조사",
    facilitiesSection: "정리된 편의시설",
    photoSummary: "사진 요약:",
    floorPhotos: "층별 상세 사진",
    floorPhotosHint: "사진을 누르면 크게 볼 수 있습니다.",
    photosCount: (n) => `사진 ${n}장`,
    naverMap: "네이버 지도에서 보기 · 길찾기",
    unsurveyedNotice: "이 건물은 아직 베리어프리 조사가 완료되지 않았습니다. 길 안내는 이용할 수 있으나, 접근성 상세 정보는 제공되지 않습니다.",
    gradeLine: (floor, level, label, desc) => `${floor} · 등급 ${level} ${label} · ${desc}`,
    enlargedImage: "확대 이미지",
  },
  route: {
    title: "길찾기",
    back: "뒤로",
    origin: "출발지",
    destination: "도착지",
    searchPlaceholder: "건물 이름 검색 또는 아래 버튼 사용",
    pickOnMap: "지도에서 선택",
    currentLocation: "현재 위치",
    clearPoint: (label) => `${label} 지우기`,
    swap: "출발지와 도착지 교환",
    sheetResize: "길찾기 창 높이 조절",
    aboutMinutes: "약",
    min: "분",
    walking: "도보",
    walkwayBased: "보행로 기반",
    stairsWarning: "경로에 계단이 포함되어 있습니다",
    elevatorNotice: "승강기 구간이 포함된 경로입니다",
    startNav: "안내 시작",
    stopNav: "안내 중지",
    acquiringGps: "GPS 위치를 확인하는 중…",
    navActive: "길안내 진행 중",
    offRouteWarning: "경로에서 벗어났습니다. 새 경로를 찾는 중…",
    reroutedNotice: "새 경로로 안내를 재시작했습니다.",
    voiceOn: "음성 안내 끄기",
    voiceOff: "음성 안내 켜기",
    voiceOnTitle: "음성 안내 켜짐",
    voiceOffTitle: "음성 안내 꺼짐",
    emptyHint1: "출발지와 도착지를 선택하면",
    emptyHint2: "보행로 기반 경로를 안내합니다.",
    total: "총",
    fitRoute: "경로 맞춤",
    resumeFollow: "추적 재개",
    followPausedHint: "지도를 직접 이동 중 — 추적 재개를 누르면 다시 따라갑니다",
    errors: {
      loadingWalkways: "보행로 데이터를 불러오는 중입니다…",
      noRoute: "두 지점을 잇는 보행로 경로를 찾지 못했습니다. 다른 지점을 선택해 보세요.",
      geoUnsupported: "이 브라우저에서는 위치를 사용할 수 없습니다.",
      navGeoUnsupported: "이 브라우저에서는 위치 안내를 사용할 수 없습니다.",
      geoDenied: "위치 권한이 거부되었습니다.",
      geoUnavailable: "위치를 확인할 수 없습니다.",
      geoTimeout: "위치 확인 시간이 초과되었습니다.",
      geoFailed: "위치를 가져올 수 없습니다.",
      trackFailed: "위치 추적 실패",
      rerouteFailed: "새 경로를 찾지 못했습니다. 보행로 근처로 이동해 주세요.",
    },
    currentLocationLabel: "현재 위치",
    mapPickLabel: (lat, lng) => `지도 선택 (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
    legendTitle: "경로 색상",
    distanceAhead: "앞",
    legend: {
      path: "보행로",
      crosswalk: "횡단보도",
      stairs: "계단",
      ramp: "경사로",
    },
  },
  page: {
    directions: "길찾기",
    loadError:
      "건물 데이터를 불러오지 못했습니다. 배포 후에도 발생하면 빌드 시 CSV 경로와 public/data/buildings.json 생성 여부를 확인해 주세요.",
  },
  filterBar: {
    ariaLabel: "시설 필터",
    all: "전체",
    report: "불편신고",
    mapHintAll: "지도: 캠퍼스 전체 건물 · 테두리 색 = 접근성 등급",
    mapHintFiltered: (labels) => `지도: ${labels} 보유 건물만 · 📍 위치 핀`,
    mapHintAllShort: "전체 건물 표시 · 테두리 색 = 접근성 등급",
    mapHintFilteredShort: (labels) => `${labels} 보유 건물 · 📍 위치 핀`,
    reportShort: "신고",
  },
  settings: {
    title: "접근성 설정",
    close: "닫기",
    language: "언어",
    languageHint: "길안내 문장 및 음성 안내 언어",
    highContrast: "고대비 모드",
    highContrastHint: "시각적 대비를 높여 가독성 향상",
    fontSize: "글꼴 크기",
    fontSizeHint: (pct) => `텍스트 크기 조절 (${pct}%)`,
    fontSm: "작게",
    fontLg: "크게",
    preview: "미리보기 텍스트입니다",
    savedHint: "설정은 자동으로 저장되며, 다음 방문 시에도 유지됩니다.",
    localeKo: "한국어",
    localeEn: "English",
  },
};

const en: UiText = {
  header: {
    university: "Kongju National University",
    subtitleShort: "Barrier-Free Map",
    subtitleFull: "Singwan Campus Barrier-Free Map",
    searchPlaceholder: "e.g. Central Library, elevator, ramp",
    searchPlaceholderShort: "Search buildings (e.g. library)",
    settingsAria: "Accessibility settings",
  },
  sidebar: {
    filtersAndList: "Filters & list",
    facilityFilter: "Facility filters",
    buildingList: "Buildings",
    count: (n) => `${n}`,
    countOf: (f, t) => `${f} / ${t}`,
    empty: "No buildings match your filters.",
    facilities: (n) => `${n} facilities`,
    selected: " (selected)",
    close: "Close sidebar",
    open: "Open sidebar",
    accessibilityGrade: "Accessibility grade",
    gradeA: "A Excellent",
    gradeB: "B Good",
    gradeC: "C Needs improvement",
  },
  facilities: {
    elevator: "Elevator",
    ramp: "Ramp",
    toilet: "Accessible restroom",
    braille: "Tactile paving",
    "auto-door": "Automatic door",
  },
  facilitiesShort: {
    elevator: "Elevator",
    ramp: "Ramp",
    toilet: "Restroom",
    braille: "Braille",
    "auto-door": "Auto door",
  },
  grade: {
    A: { label: "Excellent", description: "Strong accessibility facilities" },
    B: { label: "Good", description: "Partial facilities available" },
    C: { label: "Needs improvement", description: "May be difficult for some users" },
  },
  gradeUnsurveyed: "Not surveyed",
  map: {
    loading: "Loading barrier-free map…",
    scriptError: "Failed to load map script.",
    scriptErrorHint:
      "Check that this domain is allowed in Naver Cloud and NEXT_PUBLIC_NAVER_MAP_CLIENT_ID is included in the build, then refresh.",
    clientIdRequired: "Naver Map client ID required",
    clientIdHint:
      "Add your Naver Cloud Dynamic Map client ID to NEXT_PUBLIC_NAVER_MAP_CLIENT_ID. Also add the same variable in your Vercel project settings for production.",
    mapOptions: "Map options",
    mapTypes: { NORMAL: "Standard", TERRAIN: "Terrain", SATELLITE: "Satellite", HYBRID: "Hybrid" },
    campusOverview: "Campus overview",
    myLocation: "My location",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    mapOptionsOpen: "Open map options",
    mapOptionsClose: "Close map options",
    footprintLegend: "Building outline (grade)",
    footprintHint: "Tap a building polygon to view details.",
    gradeGuideOpen: "Open accessibility grade guide",
    pickOrigin: "Tap the map to set origin",
    pickDestination: "Tap the map to set destination",
    originMarker: "O",
    destMarker: "D",
    myLocationTitle: "My location",
    noBarrierInfo: (name) => `${name}: No barrier-free survey data.`,
    geoUnsupported: "This browser does not support location.",
    mapNotReady: "Please try again after the map loads.",
    geoFailed: "Could not get location.",
    geoDenied: "Location permission denied.",
    geoUnavailable: "Location unavailable.",
    geoTimeout: "Location request timed out.",
    locationDialogTitle: "Use your current location?",
    locationDialogBody:
      "Showing your location on the map requires device location access. If you agree below, your browser will ask for permission. Without permission, your location cannot be shown.",
    locationDialogCancel: "Cancel",
    locationDialogConfirm: "Agree to use location",
    gradeGuideTitle: "Accessibility grades",
    gradeGuideIntro:
      "Grades are based on field surveys. Individual experience may vary.",
    gradeGuideClose: "Close",
    gradeGuideA:
      "A Excellent · Generally accessible routes with well-equipped facilities",
    gradeGuideB:
      "B Good · Usable but some areas (steps, routes, facilities) need improvement",
    gradeGuideC:
      "C Needs improvement · Significant barriers; check in advance",
    gradeGuideUnsurveyed: "Not surveyed · No detailed accessibility data yet",
    buildingFallback: "Building",
    facilityFilterMatch: (name) => `${name} · facility filter match`,
  },
  building: {
    selected: "Selected building",
    viewDetails: "View details",
    close: "Close",
    yes: "Yes",
    no: "No",
    wheelchairAccess: "Wheelchair access",
    statusAvailable: "Available",
    statusExists: "Yes",
    statusNone: "None",
    moreDetails: "More details",
    elevator: "Elevator",
    toilet: "Accessible restroom",
    braille: "Tactile paving",
    autoDoor: "Automatic door",
    threshold: "Threshold / step (survey)",
    ramp: "Ramp",
    parking: "Accessible parking",
    parkingAvailable: (n, m) => `${n} spaces · ~${m} m from entrance`,
    parkingNone: "No dedicated spaces or not surveyed",
    facilitiesSection: "Listed facilities",
    photoSummary: "Photo summary:",
    floorPhotos: "Photos by floor",
    floorPhotosHint: "Tap a photo to enlarge.",
    photosCount: (n) => `${n} photos`,
    naverMap: "Open in Naver Map · Directions",
    unsurveyedNotice:
      "This building has not been surveyed for barrier-free access yet. You can still get directions, but detailed accessibility information is not available.",
    gradeLine: (floor, level, label, desc) => `${floor} · Grade ${level} ${label} · ${desc}`,
    enlargedImage: "Enlarged image",
  },
  route: {
    title: "Directions",
    back: "Back",
    origin: "Origin",
    destination: "Destination",
    searchPlaceholder: "Search building or use buttons below",
    pickOnMap: "Pick on map",
    currentLocation: "Current location",
    clearPoint: (label) => `Clear ${label}`,
    swap: "Swap origin and destination",
    sheetResize: "Resize directions panel",
    aboutMinutes: "About",
    min: "min",
    walking: "Walking",
    walkwayBased: "Walkway network",
    stairsWarning: "This route includes stairs",
    elevatorNotice: "This route includes an elevator segment",
    startNav: "Start guidance",
    stopNav: "Stop guidance",
    acquiringGps: "Acquiring GPS location…",
    navActive: "Guidance active",
    offRouteWarning: "Off route. Finding a new path…",
    reroutedNotice: "Guidance restarted on a new route.",
    voiceOn: "Turn voice off",
    voiceOff: "Turn voice on",
    voiceOnTitle: "Voice guidance on",
    voiceOffTitle: "Voice guidance off",
    emptyHint1: "Select origin and destination",
    emptyHint2: "to get walkway-based directions.",
    total: "Total",
    fitRoute: "Fit route",
    resumeFollow: "Resume tracking",
    followPausedHint: "Map moved manually — tap Resume tracking to follow again",
    errors: {
      loadingWalkways: "Loading walkway data…",
      noRoute: "No walkway route found between these points. Try different locations.",
      geoUnsupported: "Location is not available in this browser.",
      navGeoUnsupported: "Turn-by-turn guidance is not available in this browser.",
      geoDenied: "Location permission denied.",
      geoUnavailable: "Location unavailable.",
      geoTimeout: "Location request timed out.",
      geoFailed: "Could not get location.",
      trackFailed: "Location tracking failed",
      rerouteFailed: "Could not find a new route. Move closer to a walkway.",
    },
    currentLocationLabel: "Current location",
    mapPickLabel: (lat, lng) => `Map pick (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
    legendTitle: "Route colors",
    distanceAhead: "ahead",
    legend: {
      path: "Walkway",
      crosswalk: "Crosswalk",
      stairs: "Stairs",
      ramp: "Ramp",
    },
  },
  page: {
    directions: "Directions",
    loadError:
      "Failed to load building data. If this persists after deploy, check CSV paths and public/data/buildings.json generation.",
  },
  filterBar: {
    ariaLabel: "Facility filters",
    all: "All",
    report: "Report issue",
    mapHintAll: "Map: all campus buildings · border color = accessibility grade",
    mapHintFiltered: (labels) => `Map: buildings with ${labels} · 📍 pins`,
    mapHintAllShort: "All buildings · border color = grade",
    mapHintFilteredShort: (labels) => `${labels} · 📍 pins`,
    reportShort: "Report",
  },
  settings: {
    title: "Accessibility settings",
    close: "Close",
    language: "Language",
    languageHint: "Route guidance and voice language",
    highContrast: "High contrast",
    highContrastHint: "Increase visual contrast for readability",
    fontSize: "Font size",
    fontSizeHint: (pct) => `Adjust text size (${pct}%)`,
    fontSm: "Sm",
    fontLg: "Lg",
    preview: "Preview text sample",
    savedHint: "Settings are saved automatically and kept on your next visit.",
    localeKo: "한국어",
    localeEn: "English",
  },
};

const UI: Record<AppLocale, UiText> = { ko, en };

export function getUi(locale: AppLocale): UiText {
  return UI[locale] ?? UI.ko;
}
