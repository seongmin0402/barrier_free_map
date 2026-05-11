"use client";

import { Search, Settings, Accessibility } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  onSettingsClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Header({ onSettingsClick, searchQuery, onSearchChange }: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 bg-card px-4 py-3 shadow-sm border-b border-border">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground">
          <Accessibility className="w-5 h-5" />
        </div>
        <div className="hidden sm:block">
          <h1 className="text-lg font-bold text-foreground leading-tight">공주대학교</h1>
          <p className="text-xs text-muted-foreground">신관캠퍼스 베리어프리맵</p>
        </div>
      </div>

      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="건물 또는 시설 검색..."
            className="pl-10 h-10"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="건물 또는 시설 검색"
          />
        </div>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={onSettingsClick}
        aria-label="접근성 설정"
        className="shrink-0"
      >
        <Settings className="w-5 h-5" />
      </Button>
    </header>
  );
}
