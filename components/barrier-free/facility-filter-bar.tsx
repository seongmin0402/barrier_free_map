"use client";

import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { FacilityPictogram } from "@/components/barrier-free/facility-pictograms";
import { cn } from "@/lib/utils";
import { useUi } from "@/hooks/use-ui";

const FEEDBACK_FORM_URL = "https://naver.me/5Vx4YGxF";

const facilityIds = ["elevator", "ramp", "toilet", "braille", "auto-door"] as const;

function useFacilityFilterHint(filters: string[], compact: boolean) {
  const ui = useUi();
  const allActive = filters.length === 0;

  const activeFacilityLabels = facilityIds
    .filter((id) => filters.includes(id))
    .map((id) => (compact ? ui.facilitiesShort[id] : ui.facilities[id]))
    .join(", ");

  return allActive
    ? compact
      ? ui.filterBar.mapHintAllShort
      : ui.filterBar.mapHintAll
    : compact
      ? ui.filterBar.mapHintFilteredShort(activeFacilityLabels)
      : ui.filterBar.mapHintFiltered(activeFacilityLabels);
}

interface FacilityFilterMapHintProps {
  filters: string[];
  compact?: boolean;
  className?: string;
}

export function FacilityFilterMapHint({ filters, compact = false, className }: FacilityFilterMapHintProps) {
  const mapHint = useFacilityFilterHint(filters, compact);

  return (
    <p
      className={cn(
        "text-[11px] leading-snug text-muted-foreground sm:text-xs",
        className,
      )}
      aria-live="polite"
    >
      {mapHint}
    </p>
  );
}

interface FacilityFilterBarProps {
  filters: string[];
  onFilterChange: (filters: string[]) => void;
  /** 지도 상단 절대 배치 대신 부모 flex 안에 넣을 때 */
  embedded?: boolean;
  /** 모바일 등 좁은 화면 — 짧은 라벨·안내 */
  compact?: boolean;
  /** false면 안내 문구를 FacilityFilterMapHint로 따로 배치 */
  showHint?: boolean;
  className?: string;
}

export function FacilityFilterBar({
  filters,
  onFilterChange,
  embedded = false,
  compact = false,
  showHint = true,
  className,
}: FacilityFilterBarProps) {
  const ui = useUi();
  const allActive = filters.length === 0;
  const mapHint = useFacilityFilterHint(filters, compact);

  const toggleFilter = (id: string) => {
    if (filters.includes(id)) {
      onFilterChange(filters.filter((f) => f !== id));
    } else {
      onFilterChange([...filters, id]);
    }
  };

  const facilityLabel = (id: (typeof facilityIds)[number]) =>
    compact ? ui.facilitiesShort[id] : ui.facilities[id];

  return (
    <div
      className={cn(
        "pointer-events-auto flex min-w-0 flex-col gap-1.5",
        embedded && "min-w-0 flex-1",
        !embedded && "absolute z-30 max-w-[calc(100%-1.5rem)] sm:max-w-none",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-auto flex gap-1 overflow-x-auto overscroll-x-contain rounded-xl p-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:gap-1.5",
          embedded
            ? "bg-muted/50"
            : "bg-card/90 shadow-lg backdrop-blur-sm",
        )}
        role="toolbar"
        aria-label={ui.filterBar.ariaLabel}
      >
        <FilterPill active={allActive} onClick={() => onFilterChange([])} compact={compact}>
          {ui.filterBar.all}
        </FilterPill>

        {facilityIds.map((id) => (
          <FilterPill
            key={id}
            active={filters.includes(id)}
            onClick={() => toggleFilter(id)}
            compact={compact}
            icon={<FacilityPictogram facilityId={id} className="h-4 w-4 shrink-0" />}
          >
            {facilityLabel(id)}
          </FilterPill>
        ))}

        <a
          href={FEEDBACK_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card font-medium text-foreground transition-colors",
            "hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-1.5 text-xs",
          )}
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
          {compact ? ui.filterBar.reportShort : ui.filterBar.report}
        </a>
      </div>
      {showHint ? (
        <p
          className="rounded-lg bg-card/90 px-2.5 py-1 text-[11px] leading-snug text-muted-foreground shadow-md backdrop-blur-sm sm:text-xs"
          aria-live="polite"
        >
          {mapHint}
        </p>
      ) : null}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  icon,
  children,
  compact = false,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "px-2.5 py-1.5 text-[11px] sm:gap-1.5 sm:px-3 sm:text-xs" : "gap-1.5 px-3 py-1.5 text-xs",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-foreground hover:bg-secondary",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
