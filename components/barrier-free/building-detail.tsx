"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { X, Navigation } from "lucide-react";
import { FacilityPictogram, PictogramDisabledParking } from "@/components/barrier-free/facility-pictograms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { BarrierBuilding } from "@/lib/building-types";

interface BuildingDetailProps {
  building: BarrierBuilding | null;
  onClose: () => void;
}

const facilityLabels: Record<string, string> = {
  elevator: "엘리베이터",
  ramp: "경사로",
  toilet: "장애인 화장실",
  braille: "점자블록",
  "auto-door": "자동문",
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

function BuildingFullSections({
  building,
  onPhotoClick,
}: {
  building: BarrierBuilding;
  onPhotoClick: (url: string, alt: string) => void;
}) {
  const info = accessibilityInfo[building.accessibilityLevel];
  const floorsWithPhotos =
    building.floorPhotoGroups?.filter((g) => g.images?.length) ?? [];

  const naverSearchUrl =
    Number.isFinite(building.lat) && Number.isFinite(building.lng)
      ? `https://map.naver.com/p/search/${encodeURIComponent(building.name)}/${building.lng},${building.lat},PLACE`
      : `https://map.naver.com/p/search/${encodeURIComponent(building.name)}`;

  return (
    <div className="space-y-4 pr-1">
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
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <PictogramDisabledParking className="h-4 w-4 shrink-0" />
            장애인 주차
          </span>
          <span className="text-right font-medium text-foreground">
            {building.parkingCapacity > 0
              ? `${building.parkingCapacity}대 가능 · 입구 약 ${building.parkingDistanceEntranceM}m`
              : "전용 구역 없음 또는 미조사"}
          </span>
        </div>
      </div>

      {building.facilities.filter((f) => f !== "charging").length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">정리된 편의시설</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {building.facilities
              .filter((f) => f !== "charging")
              .map((facility) => (
              <div key={facility} className="flex items-center gap-2 rounded-lg bg-secondary p-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <FacilityPictogram facilityId={facility} className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm text-foreground">{facilityLabels[facility] ?? facility}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {building.floorPhotoSummary ? (
        <p className="text-xs text-muted-foreground">사진 요약: {building.floorPhotoSummary}</p>
      ) : null}

      {floorsWithPhotos.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">층별 상세 사진</h3>
          <p className="mb-2 text-xs text-muted-foreground">사진을 누르면 크게 볼 수 있습니다.</p>
          <Accordion type="multiple" className="w-full rounded-lg border border-border">
            {floorsWithPhotos.map((group) => (
              <AccordionItem key={group.floor} value={group.floor}>
                <AccordionTrigger className="px-3 text-sm">
                  {group.floor} · 사진 {group.images.length}장
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {group.images.map((im, idx) => {
                      const alt =
                        im.originalName ?? `${building.name} ${group.floor} 사진 ${idx + 1}`;
                      return (
                        <button
                          key={`${im.url}-${idx}`}
                          type="button"
                          className="group relative block h-32 w-full overflow-hidden rounded-md border border-border bg-muted/20 text-left outline-none ring-offset-background transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => onPhotoClick(im.url, alt)}
                        >
                          <Image
                            src={im.url}
                            alt={alt}
                            fill
                            className="object-cover transition group-hover:scale-[1.02]"
                            sizes="(max-width: 640px) 50vw, 33vw"
                          />
                          {im.originalName ? (
                            <span className="pointer-events-none absolute bottom-0 left-0 right-0 truncate bg-background/80 px-1 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
                              {im.originalName}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
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
  );
}

export function BuildingDetail({ building, onClose }: BuildingDetailProps) {
  const [fullOpen, setFullOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);

  const buildingId = building?.id ?? null;

  useEffect(() => {
    setFullOpen(false);
    setLightbox(null);
  }, [buildingId]);

  const openLightbox = useCallback((url: string, alt: string) => {
    setLightbox({ url, alt });
  }, []);

  if (!building) return null;

  const info = accessibilityInfo[building.accessibilityLevel];

  return (
    <>
      {/* 요약 카드 — 지도를 덮지 않도록 한쪽에 작게 */}
      <div
        className={cn(
          "animate-in fade-in slide-in-from-bottom-2 absolute z-20 duration-200",
          "bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-[min(100%,20rem)]",
        )}
      >
        <div className="rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <h2 className="truncate text-sm font-bold text-foreground">{building.name}</h2>
                <Badge className={cn("shrink-0 px-1.5 py-0 text-[10px]", info.color)}>
                  {building.accessibilityLevel} {info.label}
                </Badge>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {building.floorLabel || "—"} · {info.description}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
              <span className="sr-only">닫기</span>
            </Button>
          </div>
          <div className="mt-2 flex justify-end">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setFullOpen(true)}>
              자세히 보기
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={fullOpen} onOpenChange={setFullOpen}>
        <DialogContent
          className="flex max-h-[min(88vh,800px)] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
          showCloseButton
        >
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
            <DialogTitle className="text-base leading-snug sm:text-lg">{building.name}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {building.floorLabel || "—"} · 등급 {building.accessibilityLevel} {info.label} · {info.description}
            </p>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <BuildingFullSections building={building} onPhotoClick={openLightbox} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={lightbox != null} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent
          className="max-h-[95vh] max-w-[min(96vw,56rem)] gap-0 border-zinc-800 bg-zinc-950/90 p-3 text-zinc-50 shadow-2xl sm:p-4 [&_[data-slot=dialog-close]]:text-zinc-100 [&_[data-slot=dialog-close]]:hover:bg-zinc-800"
          showCloseButton
        >
          <DialogHeader className="sr-only">
            <DialogTitle>확대 이미지</DialogTitle>
          </DialogHeader>
          {lightbox ? (
            <div className="flex max-h-[min(88vh,900px)] items-center justify-center pt-1">
              {/* 원본 비율 유지·경로 제약 회피를 위해 img 사용 */}
              <img
                src={lightbox.url}
                alt={lightbox.alt}
                className="max-h-[min(82vh,860px)] max-w-full rounded-md object-contain"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
