"use client";

import { useState, useMemo, useEffect } from "react";
import { Header } from "@/components/barrier-free/header";
import { Sidebar } from "@/components/barrier-free/sidebar";
import { CampusMap } from "@/components/barrier-free/campus-map";
import { BuildingDetail } from "@/components/barrier-free/building-detail";
import { SettingsPanel } from "@/components/barrier-free/settings-panel";
import { MobileSidebarToggle } from "@/components/barrier-free/mobile-sidebar-toggle";
import type { BarrierBuilding } from "@/lib/building-types";

export default function BarrierFreeMapPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [buildings, setBuildings] = useState<BarrierBuilding[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    highContrast: false,
    fontSize: 100,
    screenReader: false,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/data/buildings.json")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data: BarrierBuilding[]) => {
        if (!cancelled) {
          setBuildings(Array.isArray(data) ? data : []);
          setLoadError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBuildings([]);
          setLoadError("건물 데이터를 불러오지 못했습니다. 배포 후에도 발생하면 빌드 시 CSV 경로와 public/data/buildings.json 생성 여부를 확인해 주세요.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredBuildings = useMemo(() => {
    return buildings.filter((building) => {
      if (searchQuery && !building.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
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
        <MobileSidebarToggle isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

        <Sidebar
          filters={filters}
          onFilterChange={setFilters}
          buildings={filteredBuildings}
          totalBuildingCount={buildings.length}
          selectedBuilding={selectedBuildingId}
          onBuildingSelect={setSelectedBuildingId}
          isOpen={isSidebarOpen}
        />

        <main className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
          <CampusMap
            buildings={filteredBuildings}
            selectedBuilding={selectedBuildingId}
            onBuildingSelect={setSelectedBuildingId}
          />

          <BuildingDetail building={selectedBuilding} onClose={() => setSelectedBuildingId(null)} />
        </main>
      </div>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />
    </div>
  );
}
