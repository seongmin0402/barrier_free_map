"use client";

import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileSidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function MobileSidebarToggle({ isOpen, onToggle }: MobileSidebarToggleProps) {
  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={onToggle}
      className="fixed left-4 top-20 z-30 shadow-lg md:hidden"
      aria-label={isOpen ? "사이드바 닫기" : "사이드바 열기"}
    >
      {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
    </Button>
  );
}
