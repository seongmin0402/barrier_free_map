"use client";

import Image from "next/image";
import {
  X,
  Navigation,
  ArrowUpFromLine,
  Bath,
  DoorOpen,
  Footprints,
  Zap,
  Accessibility,
  ParkingCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { BarrierBuilding } from "@/lib/building-types";

interface BuildingDetailProps {
  building: BarrierBuilding | null;
  onClose: () => void;
}

const facilityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  elevator: ArrowUpFromLine,
  ramp: Accessibility,
  toilet: Bath,
  braille: Footprints,
  "auto-door": DoorOpen,
  charging: Zap,
};

const facilityLabels: Record<string, string> = {
  elevator: "엘리베이터",
  ramp: "경사로",
  toilet: "장애인 화장실",
  braille: "점자블록",
  "auto-door": "자동문",
  charging: "휠체어 충전소",
};

const accessibilityInfo = {
  A: { label: "우수", color: "bg-[#22A557] text-white", description: "접근성 시설 충실" },
  B: { label: "양호", color: "bg-[#F5A623] text-foreground", description: "주요 일부만 구비" },
  C: { label: "개선필요", color: "bg-[#DC3545] text-white", description: "이동약자에게 어려울 수 있음" },
};

function BoolLine({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value ? "예" : "아니오"}</span>
    </div>
  );
}

export function BuildingDetail({ building, onClose }: BuildingDetailProps) {
  if (!building) return null;

  const info = accessibilityInfo[building.accessibilityLevel];
  const floorsWithPhotos =
    building.floorPhotoGroups?.filter((g) => g.images?.length) ?? [];

  const naverSearchUrl =
    Number.isFinite(building.lat) && Number.isFinite(building.lng)
      ? `https://map.naver.com/p/search/${encodeURIComponent(building.name)}/${building.lng},${building.lat},PLACE`
      : `https://map.naver.com/p/search/${encodeURIComponent(building.name)}`;

  return (
    <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] animate-in slide-in-from-bottom rounded-t-2xl border-t border-border bg-card shadow-lg duration-300 overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-border bg-card px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-bold text-foreground">{building.name}</h2>
              <Badge className={cn("shrink-0", info.color)}>
                {building.accessibilityLevel} {info.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              최고층(조사 기준) {building.floorLabel || "—"} · {info.description}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="-mr-2 -mt-1 shrink-0">
            <X className="h-5 w-5" />
            <span className="sr-only">닫기</span>
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {building.description ? (
          <p className="whitespace-pre-line text-sm text-foreground">{building.description}</p>
        ) : null}

        <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <BoolLine label="휠체어 동선" value={building.wheelchairAccess} />
          <BoolLine label="엘리베이터" value={building.elevatorAvailable} />
          <BoolLine label="장애인 화장실" value={building.toiletAvailable} />
          <BoolLine label="점자블록" value={building.brailleAvailable} />
          <BoolLine label="자동문" value={building.autoDoorAvailable} />
          <BoolLine label="문턱·단차 존재(조사 결과)" value={building.thresholdPresent} />
          <BoolLine label="경사로" value={building.rampAvailable} />
          <div className="flex justify-between gap-4 border-t border-border pt-2 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <ParkingCircle className="h-4 w-4 shrink-0" />
              장애인 주차
            </span>
            <span className="text-right font-medium text-foreground">
              {building.parkingCapacity > 0
                ? `${building.parkingCapacity}대 가능 · 입구 약 ${building.parkingDistanceEntranceM}m`
                : "전용 구역 없음 또는 미조사"}
            </span>
          </div>
        </div>

        {building.facilities.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">정리된 편의시설</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {building.facilities.map((facility) => {
                const Icon = facilityIcons[facility] || Accessibility;
                return (
                  <div key={facility} className="flex items-center gap-2 rounded-lg bg-secondary p-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm text-foreground">{facilityLabels[facility] ?? facility}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {building.floorPhotoSummary ? (
          <p className="text-xs text-muted-foreground">사진 요약: {building.floorPhotoSummary}</p>
        ) : null}

        {floorsWithPhotos.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">층별 상세 사진</h3>
            <Accordion type="multiple" className="w-full rounded-lg border border-border">
              {floorsWithPhotos.map((group) => (
                <AccordionItem key={group.floor} value={group.floor}>
                  <AccordionTrigger className="px-3 text-sm">
                    {group.floor} · 사진 {group.images.length}장
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {group.images.map((im, idx) => (
                        <figure key={`${im.url}-${idx}`} className="relative h-32 overflow-hidden rounded-md border border-border bg-muted/20">
                          <Image
                            src={im.url}
                            alt={im.originalName ?? `${building.name} ${group.floor} 사진 ${idx + 1}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, 33vw"
                          />
                          {im.originalName ? (
                            <figcaption className="absolute bottom-0 left-0 right-0 truncate bg-background/80 px-1 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
                              {im.originalName}
                            </figcaption>
                          ) : null}
                        </figure>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ) : null}

        <Button className="w-full gap-2" size="lg" asChild>
          <a href={naverSearchUrl} target="_blank" rel="noopener noreferrer">
            <Navigation className="h-5 w-5" />
            네이버 지도에서 보기 · 길찾기
          </a>
        </Button>
      </div>
    </div>
  );
}
