"use client";

import { useEffect } from "react";
import { Building2, ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUi } from "@/hooks/use-ui";
import type { AccessibilityLevel } from "@/lib/building-types";

interface Building {
  id: string;
  name: string;
  accessibilityLevel: AccessibilityLevel;
  facilities: string[];
}

interface SidebarProps {
  buildings: Building[];
  /** 전체 건물 수(필터·검색 전). 목록 건수와 비교해 표시 */
  totalBuildingCount: number;
  selectedBuilding: string | null;
  onBuildingSelect: (id: string) => void;
  isOpen: boolean;
  onRequestClose: () => void;
}

const accessibilityColors: Record<AccessibilityLevel, string> = {
  A: "bg-[oklch(0.65_0.18_160)] text-white",
  B: "bg-[oklch(0.70_0.18_85)] text-foreground",
  C: "bg-[oklch(0.55_0.22_25)] text-white",
  unknown: "bg-[#1a1a1a] text-white",
};

export function Sidebar({
  buildings,
  totalBuildingCount,
  selectedBuilding,
  onBuildingSelect,
  isOpen,
  onRequestClose,
}: SidebarProps) {
  const ui = useUi();

  useEffect(() => {
    if (!selectedBuilding) return;
    const el = document.getElementById(`sidebar-building-${selectedBuilding}`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedBuilding, buildings]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-20 bg-black/35 transition-opacity duration-200 md:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onRequestClose}
        aria-hidden={!isOpen}
      />
      <aside
        className={cn(
          "fixed top-0 left-0 z-30 flex h-full w-72 flex-col border-r border-border bg-card transition-transform duration-300 md:static md:z-auto md:h-auto md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-border p-4 md:hidden">
          <h2 className="text-base font-semibold text-foreground">{ui.sidebar.buildingList}</h2>
          <Button variant="ghost" size="icon" onClick={onRequestClose} aria-label={ui.sidebar.close}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 [touch-action:pan-y] [-webkit-overflow-scrolling:touch]">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="hidden font-semibold text-foreground md:block">{ui.sidebar.buildingList}</h2>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {buildings.length === totalBuildingCount ? (
                <>{ui.sidebar.count(totalBuildingCount)}</>
              ) : (
                <>{ui.sidebar.countOf(buildings.length, totalBuildingCount)}</>
              )}
            </span>
          </div>
          <div className="space-y-2">
            {buildings.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
                {ui.sidebar.empty}
              </p>
            ) : (
              buildings.map((building) => (
                <button
                  key={building.id}
                  id={`sidebar-building-${building.id}`}
                  type="button"
                  onClick={() => onBuildingSelect(building.id)}
                  aria-current={selectedBuilding === building.id ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors",
                    selectedBuilding === building.id
                      ? "border-primary bg-primary/15 shadow-md ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
                      : "border-transparent bg-secondary hover:bg-secondary/80",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      selectedBuilding === building.id ? "bg-primary/20 text-primary" : "bg-muted",
                    )}
                  >
                    <Building2
                      className={cn(
                        "h-5 w-5",
                        selectedBuilding === building.id ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {building.name}
                      {selectedBuilding === building.id ? (
                        <span className="sr-only">{ui.sidebar.selected}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {building.accessibilityLevel === "unknown"
                        ? ui.gradeUnsurveyed
                        : ui.sidebar.facilities(building.facilities.filter((f) => f !== "charging").length)}
                    </p>
                  </div>
                  <Badge className={cn("shrink-0", accessibilityColors[building.accessibilityLevel])}>
                    {building.accessibilityLevel === "unknown"
                      ? ui.gradeUnsurveyed
                      : building.accessibilityLevel}
                  </Badge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-border bg-muted/50 p-4">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">{ui.sidebar.accessibilityGrade}</h3>
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[oklch(0.65_0.18_160)]" />
              <span className="text-xs text-muted-foreground">{ui.sidebar.gradeA}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[oklch(0.70_0.18_85)]" />
              <span className="text-xs text-muted-foreground">{ui.sidebar.gradeB}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[oklch(0.55_0.22_25)]" />
              <span className="text-xs text-muted-foreground">{ui.sidebar.gradeC}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#1a1a1a]" />
              <span className="text-xs text-muted-foreground">{ui.gradeUnsurveyed}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
