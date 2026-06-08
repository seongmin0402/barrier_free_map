"use client";

import { useEffect } from "react";
import { Building2, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUi } from "@/hooks/use-ui";
import { shortBuildingName } from "@/lib/building-display-name";

interface Building {
  id: string;
  name: string;
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
          "fixed top-0 left-0 z-30 flex h-full w-[min(100vw-1rem,20rem)] flex-col border-r border-border bg-card pt-[env(safe-area-inset-top)] transition-transform duration-300 md:static md:z-auto md:h-auto md:w-80 md:translate-x-0 md:pt-0",
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
                    "flex w-full items-start gap-3 rounded-lg border-2 p-3 text-left transition-colors",
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
                    <p
                      className="line-clamp-2 text-sm font-medium leading-snug text-foreground"
                      title={building.name}
                    >
                      {shortBuildingName(building.name)}
                      {selectedBuilding === building.id ? (
                        <span className="sr-only">{ui.sidebar.selected}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ui.sidebar.facilities(building.facilities.filter((f) => f !== "charging").length)}
                    </p>
                  </div>
                  <ChevronRight className="mt-2 hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
                </button>
              ))
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
