"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useUi } from "@/hooks/use-ui";
import { sortFloorPhotoGroups, sortFloorPhotoSummary, sortFloorTokens } from "@/lib/floor-sort";
import type { UiText } from "@/lib/i18n/ui";
import type { BarrierBuilding } from "@/lib/building-types";

interface BuildingDetailProps {
  building: BarrierBuilding | null;
  onClose: () => void;
}

const gradeColors = {
  A: "bg-[#22A557] text-white",
  B: "bg-[#F5A623] text-foreground",
  C: "bg-[#DC3545] text-white",
} as const;

function BoolLine({
  label,
  value,
  yes,
  no,
}: {
  label: string;
  value: boolean;
  yes: string;
  no: string;
}) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value ? yes : no}</span>
    </div>
  );
}

function BuildingFullSections({
  building,
  onPhotoClick,
  ui,
}: {
  building: BarrierBuilding;
  onPhotoClick: (url: string, alt: string) => void;
  ui: UiText;
}) {
  const grade = ui.grade[building.accessibilityLevel];
  const floorsSorted = sortFloorPhotoGroups(building.floorPhotoGroups ?? []);
  const floorsWithPhotos = floorsSorted.filter((g) => g.images?.length);
  const floorSummarySorted = building.floorPhotoSummary
    ? sortFloorPhotoSummary(building.floorPhotoSummary)
    : "";

  const naverSearchUrl =
    Number.isFinite(building.lat) && Number.isFinite(building.lng)
      ? `https://map.naver.com/p/search/${encodeURIComponent(building.name)}/${building.lng},${building.lat},PLACE`
      : `https://map.naver.com/p/search/${encodeURIComponent(building.name)}`;

  const openNaverRoute = useCallback(() => {
    const hasCoords = Number.isFinite(building.lat) && Number.isFinite(building.lng);
    if (!hasCoords) {
      window.open(naverSearchUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const ua = window.navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    if (!isMobile) {
      window.open(naverSearchUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const destinationName = encodeURIComponent(building.name);
    const appName = encodeURIComponent("barrier-free-map");
    const routeScheme = `nmap://route/walk?dlat=${building.lat}&dlng=${building.lng}&dname=${destinationName}&appname=${appName}`;

    // 모바일에서는 앱 스킴 우선 시도 후, 열리지 않으면 웹 링크로 폴백
    const fallbackTimer = window.setTimeout(() => {
      window.open(naverSearchUrl, "_blank", "noopener,noreferrer");
    }, 1200);

    window.location.href = routeScheme;

    const clearFallback = () => {
      window.clearTimeout(fallbackTimer);
      document.removeEventListener("visibilitychange", clearFallback);
      window.removeEventListener("pagehide", clearFallback);
    };
    document.addEventListener("visibilitychange", clearFallback, { once: true });
    window.addEventListener("pagehide", clearFallback, { once: true });
  }, [building.lat, building.lng, building.name, naverSearchUrl]);

  return (
    <div className="space-y-4 pr-1">
      {building.description ? (
        <p className="whitespace-pre-line text-sm text-foreground">{building.description}</p>
      ) : null}

      <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <BoolLine label={ui.building.elevator} value={building.elevatorAvailable} yes={ui.building.yes} no={ui.building.no} />
        <BoolLine label={ui.building.toilet} value={building.toiletAvailable} yes={ui.building.yes} no={ui.building.no} />
        <BoolLine label={ui.building.braille} value={building.brailleAvailable} yes={ui.building.yes} no={ui.building.no} />
        <BoolLine label={ui.building.autoDoor} value={building.autoDoorAvailable} yes={ui.building.yes} no={ui.building.no} />
        <BoolLine label={ui.building.threshold} value={building.thresholdPresent} yes={ui.building.yes} no={ui.building.no} />
        <BoolLine label={ui.building.ramp} value={building.rampAvailable} yes={ui.building.yes} no={ui.building.no} />
        <div className="flex justify-between gap-4 border-t border-border pt-2 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <PictogramDisabledParking className="h-4 w-4 shrink-0" />
            {ui.building.parking}
          </span>
          <span className="text-right font-medium text-foreground">
            {building.parkingCapacity > 0
              ? ui.building.parkingAvailable(building.parkingCapacity, building.parkingDistanceEntranceM)
              : ui.building.parkingNone}
          </span>
        </div>
      </div>

      {building.facilities.filter((f) => f !== "charging").length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">{ui.building.facilitiesSection}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {building.facilities
              .filter((f) => f !== "charging")
              .map((facility) => (
              <div key={facility} className="flex items-center gap-2 rounded-lg bg-secondary p-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <FacilityPictogram facilityId={facility} className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm text-foreground">
                  {ui.facilities[facility as keyof typeof ui.facilities] ?? facility}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {floorSummarySorted ? (
        <p className="text-xs text-muted-foreground">
          {ui.building.photoSummary} {floorSummarySorted}
        </p>
      ) : null}

      {floorsWithPhotos.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">{ui.building.floorPhotos}</h3>
          <p className="mb-2 text-xs text-muted-foreground">{ui.building.floorPhotosHint}</p>
          <Accordion type="multiple" className="w-full rounded-lg border border-border">
            {floorsWithPhotos.map((group) => (
              <AccordionItem key={group.floor} value={group.floor}>
                <AccordionTrigger className="px-3 text-sm">
                  {group.floor} · {ui.building.photosCount(group.images.length)}
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

      <Button className="w-full gap-2" size="lg" type="button" onClick={openNaverRoute}>
        <Navigation className="h-5 w-5" />
        {ui.building.naverMap}
      </Button>
    </div>
  );
}

export function BuildingDetail({ building, onClose }: BuildingDetailProps) {
  const ui = useUi();
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

  const sortedFloorLabel = useMemo(() => {
    const fl = building?.floorLabel?.trim();
    if (!fl) return "—";
    return sortFloorTokens(fl);
  }, [building?.floorLabel]);

  if (!building) return null;

  const grade = ui.grade[building.accessibilityLevel];

  return (
    <>
      {/* 요약 카드 — 모바일: 하단 좌측(등급 범례·줌 버튼과 겹치지 않게), 데스크톱: 우하단 */}
      <div
        className={cn(
          "animate-in fade-in slide-in-from-bottom-2 absolute z-20 duration-200",
          "bottom-[5.5rem] left-3 right-14 max-w-[calc(100%-3.5rem)]",
          "sm:bottom-3 sm:left-auto sm:right-4 sm:w-[min(100%,20rem)] sm:max-w-none",
        )}
      >
        <div className="rounded-xl border-2 border-primary bg-card/95 p-3 shadow-lg ring-2 ring-primary/30 backdrop-blur-sm">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {ui.building.selected}
          </p>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <h2 className="truncate text-sm font-bold text-foreground">{building.name}</h2>
                <Badge className={cn("shrink-0 px-1.5 py-0 text-[10px]", gradeColors[building.accessibilityLevel])}>
                  {building.accessibilityLevel} {grade.label}
                </Badge>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {sortedFloorLabel} · {grade.description}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
              <span className="sr-only">{ui.building.close}</span>
            </Button>
          </div>
          <div className="mt-2 flex justify-end">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setFullOpen(true)}>
              {ui.building.viewDetails}
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
              {ui.building.gradeLine(
                sortedFloorLabel,
                building.accessibilityLevel,
                grade.label,
                grade.description,
              )}
            </p>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <BuildingFullSections building={building} onPhotoClick={openLightbox} ui={ui} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={lightbox != null} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent
          className="max-h-[95vh] max-w-[min(96vw,56rem)] gap-0 border-zinc-800 bg-zinc-950/90 p-3 text-zinc-50 shadow-2xl sm:p-4 [&_[data-slot=dialog-close]]:text-zinc-100 [&_[data-slot=dialog-close]]:hover:bg-zinc-800"
          showCloseButton
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{ui.building.enlargedImage}</DialogTitle>
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
