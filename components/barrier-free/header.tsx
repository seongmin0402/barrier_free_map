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
    <header className="flex flex-col gap-2 border-b border-border bg-card px-3 py-2.5 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-3">
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
        <div className="flex min-w-0 flex-1 items-center sm:flex-initial">
          <Image
            src="/logo.png"
            alt={`${ui.header.university} ${ui.header.subtitleFull}`}
            width={240}
            height={48}
            className="h-9 w-auto max-w-[11rem] object-contain object-left sm:h-10 sm:max-w-[13rem]"
            priority
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:hidden">
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

      <div className="hidden shrink-0 items-center gap-1 sm:flex">
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

      <InstallGuideDialog open={installGuideOpen} onOpenChange={setInstallGuideOpen} />
    </header>
  );
}
