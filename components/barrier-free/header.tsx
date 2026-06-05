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
    <header className="flex items-center justify-between gap-2 bg-card px-3 py-2.5 shadow-sm border-b border-border sm:gap-4 sm:px-4 sm:py-3">
      <div className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground sm:h-10 sm:w-10">
          <Accessibility className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold leading-tight text-foreground sm:text-lg">
            공주대학교
          </h1>
          <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
            <span className="sm:hidden">베리어프리맵</span>
            <span className="hidden sm:inline">신관캠퍼스 베리어프리맵</span>
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:left-3" />
          <Input
            type="search"
            placeholder="건물·시설 검색"
            className="h-9 pl-9 text-base sm:h-10 sm:pl-10 sm:text-sm"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="건물·시설 검색"
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
