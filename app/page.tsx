"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Header } from "@/components/barrier-free/header";
import { Sidebar } from "@/components/barrier-free/sidebar";
import { CampusMap } from "@/components/barrier-free/campus-map";
import { BuildingDetail } from "@/components/barrier-free/building-detail";
import { FacilityFilterBar, FacilityFilterMapHint } from "@/components/barrier-free/facility-filter-bar";
import { SettingsPanel } from "@/components/barrier-free/settings-panel";
import { MobileSidebarToggle } from "@/components/barrier-free/mobile-sidebar-toggle";
import { useAppSettings } from "@/components/app-settings-provider";
import { useUi } from "@/hooks/use-ui";
import { useCampusBuildings } from "@/hooks/use-campus-buildings";

const facilitySearchTerms: Record<string, string[]> = {
  elevator: ["elevator", "엘리베이터", "승강기"],
  ramp: ["ramp", "경사로"],
  toilet: ["toilet", "화장실", "장애인 화장실"],
  braille: ["braille", "점자", "점자블록"],
  "auto-door": ["auto-door", "자동문", "자동 문"],
};

export default function BarrierFreeMapPage() {
  const { settings, updateSettings } = useAppSettings();
  const ui = useUi();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { buildings, loadError } = useCampusBuildings(ui.page.loadError);

  const filteredBuildings = useMemo(() => {
    return buildings.filter((building) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const nameMatched = building.name.toLowerCase().includes(q);
        const facilityMatched = building.facilities.some((facilityId) => {
          const terms = facilitySearchTerms[facilityId] ?? [facilityId];
          return terms.some((term) => term.toLowerCase().includes(q));
        });
        if (!nameMatched && !facilityMatched) return false;
      }
      if (filters.length > 0 && !filters.every((f) => building.facilities.includes(f))) {
        return false;
      }
      return true;
    });
  }, [buildings, searchQuery, filters]);

  useEffect(() => {
    if (
      selectedBuildingId != null &&
      !filteredBuildings.some((b) => b.id === selectedBuildingId)
    ) {
      setSelectedBuildingId(null);
    }
  }, [filteredBuildings, selectedBuildingId]);

  const selectedBuilding = useMemo(() => {
    return buildings.find((b) => b.id === selectedBuildingId) ?? null;
  }, [buildings, selectedBuildingId]);

  const handleBuildingSelect = useCallback((id: string) => {
    setSelectedBuildingId(id);

    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setIsSidebarOpen(false);
    }
  }, []);

  return (
    <div
      className="flex h-screen flex-col bg-background text-foreground"
      style={{ fontSize: `${settings.fontSize}%` }}
      data-high-contrast={settings.highContrast ? "true" : undefined}
    >
      <Header
        onSettingsClick={() => setIsSettingsOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {loadError && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
          {loadError}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          buildings={filteredBuildings}
          totalBuildingCount={buildings.length}
          selectedBuilding={selectedBuildingId}
          onBuildingSelect={handleBuildingSelect}
          isOpen={isSidebarOpen}
          onRequestClose={() => setIsSidebarOpen(false)}
        />

        <main className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-border bg-card px-2 py-2 sm:px-3">
            {isSidebarOpen ? (
              <div className="md:hidden">
                <MobileSidebarToggle
                  embedded
                  isOpen={isSidebarOpen}
                  onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                />
              </div>
            ) : null}
            <div
              className={cn(
                "flex items-start gap-2",
                isSidebarOpen && "max-md:hidden",
              )}
            >
              <MobileSidebarToggle
                embedded
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden"
              />
              <FacilityFilterBar
                embedded
                showHint={false}
                filters={filters}
                onFilterChange={setFilters}
                className="min-w-0 flex-1"
              />
            </div>
            <FacilityFilterMapHint
              filters={filters}
              className={cn(
                "mt-1.5 bg-transparent px-0 py-0 shadow-none backdrop-blur-none md:mt-2",
                isSidebarOpen && "max-md:hidden",
              )}
            />
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <CampusMap
              buildings={filteredBuildings}
              selectedBuilding={selectedBuildingId}
              onBuildingSelect={handleBuildingSelect}
              showFacilityPins={filters.length > 0}
              showAllFootprints={filters.length === 0}
              mapLayout="explore"
              directionsHref="/route"
              directionsLabel={ui.page.directions}
            />
          </div>

          <BuildingDetail building={selectedBuilding} onClose={() => setSelectedBuildingId(null)} />
        </main>
      </div>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={updateSettings}
      />
    </div>
  );
}
