# 공주대학교 신관캠퍼스 베리어프리맵 - 디자인 가이드

## 프로젝트 개요
장애인, 노약자, 임산부 등 이동약자를 위한 캠퍼스 접근성 지도 웹앱

## 기술 스택
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui 컴포넌트

---

## 레이아웃 구조

```
┌─────────────────────────────────────────────────────────┐
│  헤더: 로고 + 검색창 + 접근성 설정 + 언어 선택          │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  사이드바     │         인터랙티브 캠퍼스 지도            │
│  - 시설 필터  │         (중앙 메인 영역)                 │
│  - 건물 목록  │                                          │
│  - 범례       │         [+] [-] 줌 컨트롤                │
│              │                                          │
├──────────────┴──────────────────────────────────────────┤
│  하단 패널: 선택된 건물 상세 정보 (슬라이드업)           │
└─────────────────────────────────────────────────────────┘
```

---

## 컬러 시스템 (접근성 최적화, WCAG AA 준수)

### 메인 컬러
```css
--primary: #0066CC;        /* 파란색 - 메인 브랜드, 액션 버튼 */
--primary-foreground: #FFFFFF;
```

### 접근성 상태 컬러
```css
--accessible: #22A557;     /* 초록색 - 접근 가능 (등급 A) */
--partial: #F5A623;        /* 주황색 - 부분 접근 가능 (등급 B) */
--inaccessible: #DC3545;   /* 빨간색 - 접근 불가 (등급 C) */
```

### 중립 컬러
```css
--background: #F8FAFC;     /* 밝은 회색 배경 */
--foreground: #1A1A2E;     /* 진한 텍스트 */
--card: #FFFFFF;           /* 카드 배경 */
--border: #E2E8F0;         /* 테두리 */
--muted: #64748B;          /* 보조 텍스트 */
```

---

## 핵심 컴포넌트

### 1. 헤더 (Header)
- 높이: 64px
- 로고 (왼쪽)
- 검색창 (중앙) - 건물명, 시설 검색
- 접근성 설정 버튼 (오른쪽) - 고대비 모드, 글꼴 크기 조절

### 2. 사이드바 (Sidebar)
- 너비: 320px (데스크톱), 전체화면 (모바일)
- 시설 필터 체크박스:
  - 엘리베이터
  - 경사로
  - 장애인 화장실
  - 점자블록
  - 자동문
  - 휠체어 충전소
- 건물 목록 (접근성 등급 배지 포함)
- 범례 설명

### 3. 캠퍼스 지도 (Campus Map)
- SVG 기반 인터랙티브 지도 또는 이미지 맵
- 건물 클릭 시 상세정보 팝업
- 줌 인/아웃 컨트롤 (+/-)
- 현재 위치 표시 버튼
- 휠체어 경로 하이라이트 (점선)

### 4. 건물 상세 패널 (Building Detail)
- 슬라이드업 모달 또는 사이드 패널
- 건물명 + 접근성 등급 배지
- 층별 시설 아이콘 표시
- 연락처 정보
- 길찾기 버튼

### 5. 접근성 설정 패널 (Settings)
- 고대비 모드 토글
- 글꼴 크기 조절 (소/중/대)
- 애니메이션 줄이기 옵션

---

## 접근성 시설 아이콘 (Lucide Icons 사용)

| 시설 | 아이콘 | 색상 |
|------|--------|------|
| 엘리베이터 | `ArrowUpDown` | primary |
| 경사로 | `TrendingUp` | primary |
| 장애인 화장실 | `Accessibility` | primary |
| 점자블록 | `Grid3X3` | primary |
| 자동문 | `DoorOpen` | primary |
| 휠체어 충전소 | `BatteryCharging` | primary |
| 주차장 | `Car` | primary |

---

## 접근성 등급 배지

```jsx
// 등급 A - 우수
<Badge className="bg-green-500 text-white">A</Badge>

// 등급 B - 양호  
<Badge className="bg-yellow-500 text-white">B</Badge>

// 등급 C - 개선필요
<Badge className="bg-red-500 text-white">C</Badge>
```

---

## 반응형 브레이크포인트

```css
/* 모바일 */
@media (max-width: 767px) {
  /* 사이드바: 전체화면 오버레이 */
  /* 지도: 전체 화면 */
  /* 하단 패널: 바텀시트 */
}

/* 태블릿 */
@media (min-width: 768px) and (max-width: 1023px) {
  /* 사이드바: 280px */
  /* 지도: 나머지 영역 */
}

/* 데스크톱 */
@media (min-width: 1024px) {
  /* 사이드바: 320px */
  /* 지도: 나머지 영역 */
}
```

---

## 접근성 UX 가이드라인

1. **터치 타겟**: 모든 버튼/링크 최소 48px × 48px
2. **포커스 표시**: 키보드 포커스 시 명확한 아웃라인 (ring-2 ring-primary)
3. **색상 대비**: 텍스트/배경 대비 4.5:1 이상 (WCAG AA)
4. **아이콘 + 텍스트**: 아이콘 단독 사용 금지, 항상 레이블 병행
5. **키보드 내비게이션**: Tab 순서 논리적 배치
6. **스크린리더**: aria-label, role 속성 적절히 사용
7. **애니메이션**: prefers-reduced-motion 미디어 쿼리 존중

---

## 건물 데이터 구조 예시

```typescript
interface Building {
  id: string;
  name: string;
  nameEn?: string;
  grade: 'A' | 'B' | 'C';
  coordinates: { x: number; y: number };
  floors: number;
  facilities: {
    elevator: boolean;
    ramp: boolean;
    accessibleToilet: boolean;
    brailleBlock: boolean;
    autoDoor: boolean;
    wheelchairCharger: boolean;
  };
  floorInfo: {
    floor: number;
    facilities: string[];
  }[];
  contact?: string;
  description?: string;
}
```

---

## 필터 상태 관리

```typescript
interface FilterState {
  elevator: boolean;
  ramp: boolean;
  accessibleToilet: boolean;
  brailleBlock: boolean;
  autoDoor: boolean;
  wheelchairCharger: boolean;
}
```

---

## 참고 사항

- 지도는 SVG로 직접 그리거나, 실제 캠퍼스 도면 이미지 위에 클릭 영역을 오버레이
- 실제 배포 시 Leaflet, Mapbox 등 지도 라이브러리 연동 고려
- 다국어 지원 (한국어/영어) 고려
- PWA 지원으로 오프라인 사용 가능하게 구현 권장
