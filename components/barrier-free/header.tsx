"use client";

import Image from "next/image";
import { Download, Search, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InstallGuideDialog } from "@/components/barrier-free/install-guide-dialog";
import { useUi } from "@/hooks/use-ui";

interface HeaderProps {
  onSettingsClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Header({ onSettingsClick, searchQuery, onSearchChange }: HeaderProps) {
  const ui = useUi();
  const [useShortPlaceholder, setUseShortPlaceholder] = useState(true);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);

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
    <header className="relative border-b border-border bg-card px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
      <div className="absolute right-3 top-2.5 z-10 flex items-center gap-1 sm:right-4 sm:top-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setInstallGuideOpen(true)}
          aria-label={ui.installGuide.openAria}
        >
          <Download className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onSettingsClick}
          aria-label={ui.header.settingsAria}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 sm:pr-[5.25rem]">
        <div className="min-w-0 pr-[5.25rem] sm:shrink-0 sm:pr-0">
          <Image
            src="/logo.png"
            alt={`${ui.header.university} ${ui.header.subtitleFull}`}
            width={240}
            height={48}
            className="h-9 w-auto max-w-[11rem] object-contain object-left sm:h-10 sm:max-w-[13rem]"
            priority
          />
        </div>

        <div className="w-full min-w-0 sm:flex-1 sm:max-w-none">
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
      </div>

      <InstallGuideDialog open={installGuideOpen} onOpenChange={setInstallGuideOpen} />
    </header>
  );
}
