"use client";

import { useEffect } from "react";
import { Building2, ChevronRight, X } from "lucide-react";
import { FacilityPictogram } from "@/components/barrier-free/facility-pictograms";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Building {
  id: string;
  name: string;
  accessibilityLevel: "A" | "B" | "C";
  facilities: string[];
}

interface SidebarProps {
  filters: string[];
  onFilterChange: (filters: string[]) => void;
  buildings: Building[];
  /** 전체 건물 수(필터·검색 전). 목록 건수와 비교해 표시 */
  totalBuildingCount: number;
  selectedBuilding: string | null;
  onBuildingSelect: (id: string) => void;
  isOpen: boolean;
  onRequestClose: () => void;
}

const facilityOptions = [
  { id: "elevator", label: "엘리베이터" },
  { id: "ramp", label: "경사로" },
  { id: "toilet", label: "장애인 화장실" },
  { id: "braille", label: "점자블록" },
  { id: "auto-door", label: "자동문" },
] as const;

const accessibilityColors = {
  A: "bg-[oklch(0.65_0.18_160)] text-white",
  B: "bg-[oklch(0.70_0.18_85)] text-foreground",
  C: "bg-[oklch(0.55_0.22_25)] text-white",
};

export function Sidebar({
  filters,
  onFilterChange,
  buildings,
  totalBuildingCount,
  selectedBuilding,
  onBuildingSelect,
  isOpen,
  onRequestClose,
}: SidebarProps) {
  useEffect(() => {
    if (!selectedBuilding) return;
    const el = document.getElementById(`sidebar-building-${selectedBuilding}`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedBuilding, buildings]);

  const toggleFilter = (id: string) => {
    if (filters.includes(id)) {
      onFilterChange(filters.filter((f) => f !== id));
    } else {
      onFilterChange([...filters, id]);
    }
  };

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
        <h2 className="text-base font-semibold text-foreground">필터와 목록</h2>
        <Button variant="ghost" size="icon" onClick={onRequestClose} aria-label="사이드바 닫기">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground mb-3">시설 필터</h2>
        <div className="space-y-2">
          {facilityOptions.map((option) => (
            <div key={option.id} className="flex items-center gap-3">
              <Checkbox
                id={option.id}
                checked={filters.includes(option.id)}
                onCheckedChange={() => toggleFilter(option.id)}
              />
              <Label
                htmlFor={option.id}
                className="flex items-center gap-2 text-sm cursor-pointer flex-1"
              >
                <FacilityPictogram facilityId={option.id} className="h-4 w-4 text-muted-foreground" />
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 [touch-action:pan-y] [-webkit-overflow-scrolling:touch]">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="font-semibold text-foreground">건물 목록</h2>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {buildings.length === totalBuildingCount ? (
              <>{totalBuildingCount}개</>
            ) : (
              <>
                <span className="font-medium text-foreground">{buildings.length}</span>
                <span> / {totalBuildingCount}개</span>
              </>
            )}
          </span>
        </div>
        <div className="space-y-2">
          {buildings.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
              조건에 맞는 건물이 없습니다.
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
                "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                selectedBuilding === building.id
                  ? "border-2 border-primary bg-primary/15 shadow-md ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
                  : "bg-secondary hover:bg-secondary/80 border-2 border-transparent",
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
                  {selectedBuilding === building.id ? <span className="sr-only"> (선택됨)</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {building.facilities.filter((f) => f !== "charging").length}개 시설
                </p>
              </div>
              <Badge className={cn("shrink-0", accessibilityColors[building.accessibilityLevel])}>
                {building.accessibilityLevel}
              </Badge>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))
          )}
        </div>
      </div>

      <div className="p-4 border-t border-border bg-muted/50">
        <h3 className="text-xs font-medium text-muted-foreground mb-2">접근성 등급</h3>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[oklch(0.65_0.18_160)]" />
            <span className="text-xs text-muted-foreground">A 우수</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[oklch(0.70_0.18_85)]" />
            <span className="text-xs text-muted-foreground">B 양호</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[oklch(0.55_0.22_25)]" />
            <span className="text-xs text-muted-foreground">C 개선필요</span>
          </div>
        </div>
      </div>
      </aside>
    </>
  );
}
