"use client";

import { Search, Settings, Accessibility } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUi } from "@/hooks/use-ui";

interface HeaderProps {
  onSettingsClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Header({ onSettingsClick, searchQuery, onSearchChange }: HeaderProps) {
  const ui = useUi();
  const [useShortPlaceholder, setUseShortPlaceholder] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setUseShortPlaceholder(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const searchPlaceholder = useShortPlaceholder
    ? ui.header.searchPlaceholderShort
    : ui.header.searchPlaceholder;

  return (
    <header className="flex flex-col gap-2 border-b border-border bg-card px-3 py-2.5 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-3">
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground sm:h-10 sm:w-10">
            <Accessibility className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold leading-tight text-foreground sm:text-lg">
              {ui.header.university}
            </h1>
            <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
              <span className="sm:hidden">{ui.header.subtitleShort}</span>
              <span className="hidden sm:inline">{ui.header.subtitleFull}</span>
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onSettingsClick}
          aria-label={ui.header.settingsAria}
          className="shrink-0 sm:hidden"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      <div className="w-full min-w-0 sm:max-w-md sm:flex-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:left-3" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            className="h-9 w-full pl-9 text-base sm:h-10 sm:pl-10 sm:text-sm"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label={ui.header.searchPlaceholder}
          />
        </div>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={onSettingsClick}
        aria-label={ui.header.settingsAria}
        className="hidden shrink-0 sm:inline-flex"
      >
        <Settings className="h-5 w-5" />
      </Button>
    </header>
  );
}
