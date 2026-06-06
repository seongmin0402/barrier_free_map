"use client";

import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUi } from "@/hooks/use-ui";

interface MobileSidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  /** 필터 바 옆 인라인 배치 */
  embedded?: boolean;
  className?: string;
}

export function MobileSidebarToggle({
  isOpen,
  onToggle,
  embedded = false,
  className,
}: MobileSidebarToggleProps) {
  const ui = useUi();

  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={onToggle}
      className={cn(
        embedded
          ? "h-9 w-9 shrink-0 shadow-md"
          : "fixed left-4 top-20 z-30 shadow-lg md:hidden",
        className,
      )}
      aria-label={isOpen ? ui.sidebar.close : ui.sidebar.open}
    >
      {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </Button>
  );
}
