"use client";

import { Building2, ChevronRight } from "lucide-react";
import { FacilityPictogram } from "@/components/barrier-free/facility-pictograms";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  selectedBuilding: string | null;
  onBuildingSelect: (id: string) => void;
  isOpen: boolean;
}

const facilityOptions = [
  { id: "elevator", label: "엘리베이터" },
  { id: "ramp", label: "경사로" },
  { id: "toilet", label: "장애인 화장실" },
  { id: "braille", label: "점자블록" },
  { id: "auto-door", label: "자동문" },
  { id: "charging", label: "휠체어 충전소" },
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
  selectedBuilding,
  onBuildingSelect,
  isOpen,
}: SidebarProps) {
  const toggleFilter = (id: string) => {
    if (filters.includes(id)) {
      onFilterChange(filters.filter((f) => f !== id));
    } else {
      onFilterChange([...filters, id]);
    }
  };

  return (
    <aside
      className={cn(
        "bg-card border-r border-border flex flex-col transition-all duration-300 overflow-hidden",
        isOpen ? "w-72" : "w-0 md:w-72"
      )}
    >
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

      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="font-semibold text-foreground mb-3">건물 목록</h2>
        <div className="space-y-2">
          {buildings.map((building) => (
            <button
              key={building.id}
              onClick={() => onBuildingSelect(building.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                selectedBuilding === building.id
                  ? "bg-primary/10 border border-primary"
                  : "bg-secondary hover:bg-secondary/80 border border-transparent"
              )}
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted">
                <Building2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground truncate">
                  {building.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {building.facilities.length}개 시설
                </p>
              </div>
              <Badge className={cn("shrink-0", accessibilityColors[building.accessibilityLevel])}>
                {building.accessibilityLevel}
              </Badge>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
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
  );
}
