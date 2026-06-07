"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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

          {/* 모바일: 메뉴 + 필터 (목록 열리면 필터 숨김) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
            {!isSidebarOpen ? (
              <div className="pointer-events-auto grid w-full grid-cols-[auto_1fr] gap-x-2 gap-y-1.5 animate-in fade-in duration-200">
                <MobileSidebarToggle
                  embedded
                  isOpen={isSidebarOpen}
                  onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="row-start-1 self-start"
                />
                <FacilityFilterBar
                  embedded
                  compact
                  showHint={false}
                  filters={filters}
                  onFilterChange={setFilters}
                  className="col-start-2 row-start-1 min-w-0"
                />
                <FacilityFilterMapHint
                  filters={filters}
                  compact
                  className="col-span-2 row-start-2"
                />
              </div>
            ) : (
              <div className="pointer-events-auto">
                <MobileSidebarToggle
                  embedded
                  isOpen={isSidebarOpen}
                  onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                />
              </div>
            )}
          </div>

          {/* 데스크톱: 필터만 상단 */}
          <FacilityFilterBar
            filters={filters}
            onFilterChange={setFilters}
            className="top-3 right-3 left-3 hidden md:flex"
          />

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
