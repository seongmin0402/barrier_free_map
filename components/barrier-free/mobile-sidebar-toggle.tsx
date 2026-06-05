"use client";

import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUi } from "@/hooks/use-ui";

interface MobileSidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function MobileSidebarToggle({ isOpen, onToggle }: MobileSidebarToggleProps) {
  const ui = useUi();

  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={onToggle}
      className="fixed left-4 top-20 z-30 shadow-lg md:hidden"
      aria-label={isOpen ? ui.sidebar.close : ui.sidebar.open}
    >
      {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
    </Button>
  );
}
