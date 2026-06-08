"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { Accessibility, Building2, Check, Navigation } from "lucide-react";
import {
  FacilityPictogram,
  PictogramDisabledParking,
} from "@/components/barrier-free/facility-pictograms";
import { Button } from "@/components/ui/button";
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
import { shortBuildingName } from "@/lib/building-display-name";
import { sortFloorPhotoGroups, sortFloorPhotoSummary, sortFloorTokens } from "@/lib/floor-sort";
import type { UiText } from "@/lib/i18n/ui";
import type { BarrierBuilding } from "@/lib/building-types";
import { isUnsurveyedBuilding } from "@/lib/merge-campus-buildings";

interface BuildingDetailProps {
  building: BarrierBuilding | null;
  onClose: () => void;
  onDirections?: (building: BarrierBuilding) => void;
}

function DetailFooterActions({
  building,
  ui,
  onClose,
  onDirections,
}: {
  building: BarrierBuilding;
  ui: UiText;
  onClose: () => void;
  onDirections?: (building: BarrierBuilding) => void;
}) {
  return (
    <div className="flex gap-2 border-t border-border pt-3">
      <Button variant="outline" className="flex-1" type="button" onClick={onClose}>
        {ui.building.close}
      </Button>
      {onDirections ? (
        <Button
          className="flex-[1.4] gap-1.5 font-semibold"
          type="button"
          onClick={() => onDirections(building)}
        >
          <Navigation className="h-4 w-4" aria-hidden />
          {ui.page.directions}
        </Button>
      ) : null}
    </div>
  );
}

function FacilityStatusCard({
  label,
  available,
  statusLabel,
  icon,
}: {
  label: string;
  available: boolean;
  statusLabel: string;
  icon: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border p-3 text-center transition-colors",
        available
          ? "border-2 border-[#005D91] bg-white shadow-md ring-1 ring-[#005D91]/20"
          : "border border-dashed border-muted-foreground/25 bg-white/60 opacity-65",
      )}
    >
      <div
        className={cn(
          "mb-2 flex h-11 w-11 items-center justify-center rounded-lg",
          available
            ? "bg-white text-[#005D91] shadow-sm ring-1 ring-[#005D91]/30"
            : "bg-muted/80 text-muted-foreground/70",
        )}
      >
        {icon}
      </div>
      <p
        className={cn(
          "mb-2 text-xs leading-tight",
          available ? "font-bold text-foreground" : "font-medium text-muted-foreground",
        )}
      >
        {label}
      </p>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-[11px]",
          available
            ? "bg-[#005D91] font-bold text-white"
            : "bg-muted font-medium text-muted-foreground",
        )}
      >
        {available ? <Check className="h-3 w-3" aria-hidden /> : null}
        {statusLabel}
      </span>
    </div>
  );
}

function BuildingFullSections({
  building,
  onPhotoClick,
  ui,
  onClose,
  onDirections,
}: {
  building: BarrierBuilding;
  onPhotoClick: (url: string, alt: string) => void;
  ui: UiText;
  onClose: () => void;
  onDirections?: (building: BarrierBuilding) => void;
}) {
  const floorsSorted = sortFloorPhotoGroups(building.floorPhotoGroups ?? []);
  const floorsWithPhotos = floorsSorted.filter((g) => g.images?.length);
  const floorSummarySorted = building.floorPhotoSummary
    ? sortFloorPhotoSummary(building.floorPhotoSummary)
    : "";

  const parkingAvailable = building.parkingCapacity > 0;

  const statusPositive = (value: boolean, useExists = false) =>
    value ? (useExists ? ui.building.statusExists : ui.building.statusAvailable) : ui.building.statusNone;

  const hasExtra =
    building.description ||
    floorSummarySorted ||
    floorsWithPhotos.length > 0 ||
    building.thresholdPresent;

  if (isUnsurveyedBuilding(building)) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
          {ui.building.unsurveyedNotice}
        </p>
        <DetailFooterActions
          building={building}
          ui={ui}
          onClose={onClose}
          onDirections={onDirections}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <FacilityStatusCard
          label={ui.building.wheelchairAccess}
          available={building.wheelchairAccess}
          statusLabel={statusPositive(building.wheelchairAccess)}
          icon={<Accessibility className="h-6 w-6" aria-hidden />}
        />
        <FacilityStatusCard
          label={ui.building.elevator}
          available={building.elevatorAvailable}
          statusLabel={statusPositive(building.elevatorAvailable, true)}
          icon={<FacilityPictogram facilityId="elevator" className="h-6 w-6" />}
        />
        <FacilityStatusCard
          label={ui.building.ramp}
          available={building.rampAvailable}
          statusLabel={statusPositive(building.rampAvailable, true)}
          icon={<FacilityPictogram facilityId="ramp" className="h-6 w-6" />}
        />
        <FacilityStatusCard
          label={ui.building.braille}
          available={building.brailleAvailable}
          statusLabel={statusPositive(building.brailleAvailable)}
          icon={<FacilityPictogram facilityId="braille" className="h-6 w-6" />}
        />
        <FacilityStatusCard
          label={ui.building.toilet}
          available={building.toiletAvailable}
          statusLabel={statusPositive(building.toiletAvailable, true)}
          icon={<FacilityPictogram facilityId="toilet" className="h-6 w-6" />}
        />
        <FacilityStatusCard
          label={ui.building.autoDoor}
          available={building.autoDoorAvailable}
          statusLabel={statusPositive(building.autoDoorAvailable, true)}
          icon={<FacilityPictogram facilityId="auto-door" className="h-6 w-6" />}
        />
        <FacilityStatusCard
          label={ui.building.parking}
          available={parkingAvailable}
          statusLabel={
            parkingAvailable
              ? ui.building.parkingAvailable(building.parkingCapacity, building.parkingDistanceEntranceM)
              : ui.building.parkingNone
          }
          icon={<PictogramDisabledParking className="h-6 w-6" />}
        />
        {building.thresholdPresent ? (
          <FacilityStatusCard
            label={ui.building.threshold}
            available={false}
            statusLabel={ui.building.statusExists}
            icon={<span className="text-lg font-bold leading-none" aria-hidden>▲</span>}
          />
        ) : null}
      </div>

      {hasExtra ? (
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {ui.building.moreDetails}
          </h3>
          {building.description ? (
            <p className="mb-2 whitespace-pre-line text-sm text-foreground">{building.description}</p>
          ) : null}
          {floorSummarySorted ? (
            <p className="text-xs text-muted-foreground">
              {ui.building.photoSummary} {floorSummarySorted}
            </p>
          ) : null}
        </div>
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

      <DetailFooterActions
        building={building}
        ui={ui}
        onClose={onClose}
        onDirections={onDirections}
      />
    </div>
  );
}

export function BuildingDetail({ building, onClose, onDirections }: BuildingDetailProps) {
  const ui = useUi();
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);

  const buildingId = building?.id ?? null;

  useEffect(() => {
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

  const unsurveyed = isUnsurveyedBuilding(building);

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          className="flex max-h-[min(90vh,820px)] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
          showCloseButton
        >
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#005D91]/10 text-[#005D91]"
                aria-hidden
              >
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base leading-snug sm:text-lg">
                  <span className="sm:hidden">{shortBuildingName(building.name)}</span>
                  <span className="hidden sm:inline">{building.name}</span>
                </DialogTitle>
                {!unsurveyed && sortedFloorLabel !== "—" ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{sortedFloorLabel}</p>
                ) : null}
              </div>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <BuildingFullSections
              building={building}
              onPhotoClick={openLightbox}
              ui={ui}
              onClose={onClose}
              onDirections={onDirections}
            />
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
