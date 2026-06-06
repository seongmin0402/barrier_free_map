"use client";

import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { FacilityPictogram } from "@/components/barrier-free/facility-pictograms";
import { cn } from "@/lib/utils";
import { useUi } from "@/hooks/use-ui";

const FEEDBACK_FORM_URL = "https://naver.me/5Vx4YGxF";

const facilityIds = ["elevator", "ramp", "toilet", "braille", "auto-door"] as const;

interface FacilityFilterBarProps {
  filters: string[];
  onFilterChange: (filters: string[]) => void;
  className?: string;
}

export function FacilityFilterBar({ filters, onFilterChange, className }: FacilityFilterBarProps) {
  const ui = useUi();
  const allActive = filters.length === 0;

  const toggleFilter = (id: string) => {
    if (filters.includes(id)) {
      onFilterChange(filters.filter((f) => f !== id));
    } else {
      onFilterChange([...filters, id]);
    }
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-30 flex max-w-[calc(100%-7rem)] flex-col gap-1.5 sm:max-w-[calc(100%-5rem)]",
        className,
      )}
    >
      <div
        className="pointer-events-auto flex gap-1.5 overflow-x-auto overscroll-x-contain rounded-xl bg-card/90 p-1.5 shadow-lg backdrop-blur-sm [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        role="toolbar"
        aria-label={ui.filterBar.ariaLabel}
      >
        <FilterPill active={allActive} onClick={() => onFilterChange([])}>
          {ui.filterBar.all}
        </FilterPill>

        {facilityIds.map((id) => (
          <FilterPill
            key={id}
            active={filters.includes(id)}
            onClick={() => toggleFilter(id)}
            icon={<FacilityPictogram facilityId={id} className="h-4 w-4 shrink-0" />}
          >
            {ui.facilities[id]}
          </FilterPill>
        ))}

        <a
          href={FEEDBACK_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors",
            "hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
          {ui.filterBar.report}
        </a>
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
