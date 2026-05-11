"use client";

/**
 * 실제 안내판·표지에서 쓰는 픽토그램(승강기, 경사로, 장애인 화장실 등)을 참고해
 * 단순화한 SVG입니다. 공식 ISO 7001 도안과 픽셀 단위로 동일하지는 않습니다.
 */

import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

type PictogramProps = { className?: string };

/** ISO 7001 계열 이동약자(휠체어) 기호 단순화 — currentColor */
function PictogramWheelchair({ className }: PictogramProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <circle cx="10" cy="6" r="2.25" fill="currentColor" />
      <path
        d="M7.5 20.5a6.2 6.2 0 0 1 11.2-3.2"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M7.5 12.5h3l1.8 3.2 3.5 1.3"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** 승강기 — 문형 프레임 + 상·하 화살표(건물 안내판 흔한 형태) */
function PictogramElevator({ className }: PictogramProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect x="5.5" y="2.5" width="13" height="19" rx="1.2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 4.8L9.6 7.6h4.8L12 4.8z" fill="currentColor" />
      <path d="M12 19.2L9.6 16.4h4.8L12 19.2z" fill="currentColor" />
      <circle cx="12" cy="10.8" r="1.45" fill="currentColor" />
      <path
        d="M12 12.4v3.6M10 14.8h4"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 경사로(경사면+휠체어 실루엣) */
function PictogramRamp({ className }: PictogramProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path d="M2 18h20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M4 18L20 9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="7.5" cy="15.2" r="1.6" fill="currentColor" />
      <path
        d="M6 18.2a3.2 3.2 0 0 1 5.8-1.6"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M5.2 16.2h1.8l.9 1.6 2 0.8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** 장애인 화장실(휠체어+변기 윤곽) */
function PictogramAccessibleRestroom({ className }: PictogramProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <ellipse cx="8" cy="16.5" rx="4.2" ry="3" stroke="currentColor" strokeWidth="1.65" />
      <path
        d="M8 13.5V10M6 10.5h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="5" y="5" width="6" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="16" cy="6.5" r="1.8" fill="currentColor" />
      <path
        d="M14.2 18.2a4 4 0 0 1 7.2-2"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14 11.5h2.5l1.2 2.2 2.5 1"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** 점자블록(촉지 블록 돌기 패턴) */
function PictogramBrailleBlock({ className }: PictogramProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect x="4" y="4" width="16" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.65" />
      <circle cx="9" cy="9" r="1.35" fill="currentColor" />
      <circle cx="15" cy="9" r="1.35" fill="currentColor" />
      <circle cx="9" cy="15" r="1.35" fill="currentColor" />
      <circle cx="15" cy="15" r="1.35" fill="currentColor" />
    </svg>
  );
}

/** 자동문(여닫이+개방 방향 호) */
function PictogramAutoDoor({ className }: PictogramProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path d="M5 4v16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M19 4v16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12 4v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M8 10c2-1.2 4-1.2 6 0M8 14c2 1.2 4 1.2 6 0"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** 휠체어 충전 — 전원(콘센트+번개) + 휠체어 실루엣 */
function PictogramWheelchairCharging({ className }: PictogramProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect x="2.5" y="8" width="6" height="9" rx="0.9" stroke="currentColor" strokeWidth="1.55" fill="none" />
      <path d="M5.5 6v2.2" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path
        d="M10.5 5.5L8.2 12.2h3.4L9.5 19l5.8-9.2h-3.6l1.8-4.3z"
        fill="currentColor"
      />
      <circle cx="18.8" cy="14.6" r="1.35" fill="currentColor" />
      <path
        d="M16.8 18.6a3.4 3.4 0 0 1 6.2-1.6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16.6 16.2h1.6l.8 1.5 1.8.7"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export const facilityPictogramMap: Record<string, ComponentType<PictogramProps>> = {
  elevator: PictogramElevator,
  ramp: PictogramRamp,
  toilet: PictogramAccessibleRestroom,
  braille: PictogramBrailleBlock,
  "auto-door": PictogramAutoDoor,
  charging: PictogramWheelchairCharging,
};

export function FacilityPictogram({
  facilityId,
  className,
}: {
  facilityId: string;
  className?: string;
}) {
  const Cmp = facilityPictogramMap[facilityId] ?? PictogramWheelchair;
  return <Cmp className={className} />;
}
