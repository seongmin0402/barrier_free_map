"use client";

/**
 * 화장실(이동약자 ISA 패널), 경사로, 승강기, 장애인 주차 표지 스타일을
 * 사용자 제공 이미지에 맞춘 색·구도로 SVG 재현했습니다. (공식 도안과 동일하지 않음)
 */

import { useId } from "react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

type PictogramProps = { className?: string };

/** 흰색 ISA 실루엣 (head + chair) — 공통 부품 */
function IsaWhiteSilhouette() {
  return (
    <g fill="#fff">
      <circle cx="10" cy="6.2" r="2.35" />
      <path
        d="M7.4 20.6a6.4 6.4 0 0 1 11.6-3.3"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M7.4 12.6h3.1l1.9 3.3 3.6 1.35"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </g>
  );
}

/** 1. 화장실 — 밝은 파란 패널 + 회색 테두리 + 흰 ISA */
function PictogramToiletIsaPanel({ className }: PictogramProps) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={`isaBlue-${uid}`} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7ec8ff" />
          <stop offset="0.45" stopColor="#4aa8ff" />
          <stop offset="1" stopColor="#2a7fd4" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="4.5" fill="#d5dee8" />
      <rect x="2.2" y="2.2" width="19.6" height="19.6" rx="3.6" fill={`url(#isaBlue-${uid})`} />
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="2.8" fill="none" stroke="#ffffff55" strokeWidth="0.5" />
      <IsaWhiteSilhouette />
    </svg>
  );
}

/** 2. 경사로 — 어두운 배경 + 회색 경사면 + 밝은 실루엣 + 파란 바퀴 */
function PictogramRampSign({ className }: PictogramProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 overflow-visible", className)}
      aria-hidden
    >
      <rect x="1" y="1" width="22" height="22" rx="4" fill="#0f0f0f" />
      <path d="M4 19.5 L20 19.5 L20 10 Z" fill="#6b7280" />
      <circle cx="8.2" cy="14.8" r="1.65" fill="#dbeafe" />
      <path
        d="M6.8 18.5a3.4 3.4 0 0 1 6.2-1.6"
        stroke="#dbeafe"
        strokeWidth="1.35"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M6.5 16.2h1.7l.85 1.55 1.95.75"
        stroke="#dbeafe"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="9.5" cy="15.5" r="2.85" fill="#3b82f6" />
      <circle cx="9.5" cy="15.5" r="1.35" fill="#1d4ed8" opacity="0.35" />
    </svg>
  );
}

/** 3. 승강기 — 좌측 파란 띠(상하 쉐브론) + 우측 밝은 면에 휠체어 실루엣 */
function PictogramElevatorSign({ className }: PictogramProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 overflow-visible", className)}
      aria-hidden
    >
      <rect x="1" y="1" width="22" height="22" rx="3" fill="#e8edf4" />
      <rect x="1.5" y="1.5" width="7.2" height="21" rx="1.2" fill="#1d63d8" />
      <path d="M4.9 5.8L3.6 7.4h2.6L4.9 5.8z" fill="#fff" />
      <path d="M4.9 18.2L3.6 16.6h2.6L4.9 18.2z" fill="#fff" />
      <g transform="translate(9.2 3.8) scale(0.92)">
        <circle cx="10" cy="6.2" r="2.1" fill="#60a5fa" />
        <path
          d="M7.4 20.6a6.4 6.4 0 0 1 11.6-3.3"
          stroke="#2563eb"
          strokeWidth="1.75"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M7.4 12.6h3.1l1.9 3.3 3.6 1.35"
          stroke="#2563eb"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M9.5 8.5v2.5" stroke="#93c5fd" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** 4. 장애인 주차 — 파란 사각 + P + 작은 ISA */
function PictogramDisabledParking({ className }: PictogramProps) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={`pkBg-${uid}`} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3d7dd4" />
          <stop offset="1" stopColor="#1e4a9e" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="4" fill={`url(#pkBg-${uid})`} stroke="#93c5fd" strokeWidth="1.35" />
      <path
        d="M14 3.5A9 9 0 0 1 21.5 12"
        fill="none"
        stroke="#ffffff35"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <text
        x="6.2"
        y="17.2"
        fill="#fff"
        fontSize="15"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
      >
        P
      </text>
      <g transform="translate(13.2 12.8) scale(0.38)">
        <circle cx="10" cy="6.2" r="2.35" fill="#fff" />
        <path
          d="M7.4 20.6a6.4 6.4 0 0 1 11.6-3.3"
          stroke="#fff"
          strokeWidth="1.9"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M7.4 12.6h3.1l1.9 3.3 3.6 1.35"
          stroke="#fff"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

/** 점자블록 */
function PictogramBrailleBlock({ className }: PictogramProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-foreground", className)}
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

/** 자동문 */
function PictogramAutoDoor({ className }: PictogramProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-foreground", className)}
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

/** 휠체어 충전 */
function PictogramWheelchairCharging({ className }: PictogramProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-foreground", className)}
      aria-hidden
    >
      <rect x="2.5" y="8" width="6" height="9" rx="0.9" stroke="currentColor" strokeWidth="1.55" fill="none" />
      <path d="M5.5 6v2.2" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M10.5 5.5L8.2 12.2h3.4L9.5 19l5.8-9.2h-3.6l1.8-4.3z" fill="currentColor" />
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
  elevator: PictogramElevatorSign,
  ramp: PictogramRampSign,
  toilet: PictogramToiletIsaPanel,
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
  const Cmp = facilityPictogramMap[facilityId] ?? PictogramToiletIsaPanel;
  return <Cmp className={className} />;
}

export { PictogramDisabledParking };
