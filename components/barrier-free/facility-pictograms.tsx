"use client";

/**
 * 화장실·경사로·승강기·주차: public/icons/facilities/*.png (copy-facility-icons 스크립트로 복사)
 * 점자블록·자동문: 벡터 아이콘
 */

import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

const BASE = "/icons/facilities";

type PictogramProps = { className?: string };

function FacilityRaster({ file, className }: { file: string; className?: string }) {
  return (
    <img
      src={`${BASE}/${file}`}
      alt=""
      width={40}
      height={40}
      decoding="async"
      draggable={false}
      className={cn("h-5 w-5 shrink-0 object-contain", className)}
    />
  );
}

function IconToilet(props: PictogramProps) {
  return <FacilityRaster file="toilet.png" {...props} />;
}
function IconRamp(props: PictogramProps) {
  return <FacilityRaster file="ramp.png" {...props} />;
}
function IconElevator(props: PictogramProps) {
  return <FacilityRaster file="elevator.png" {...props} />;
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

export const facilityPictogramMap: Record<string, ComponentType<PictogramProps>> = {
  elevator: IconElevator,
  ramp: IconRamp,
  toilet: IconToilet,
  braille: PictogramBrailleBlock,
  "auto-door": PictogramAutoDoor,
};

export function FacilityPictogram({
  facilityId,
  className,
}: {
  facilityId: string;
  className?: string;
}) {
  const Cmp = facilityPictogramMap[facilityId] ?? IconToilet;
  return <Cmp className={className} />;
}

/** 장애인 주차 표지 PNG */
export function PictogramDisabledParking({ className }: PictogramProps) {
  return <FacilityRaster file="parking.png" className={cn("h-4 w-4", className)} />;
}
