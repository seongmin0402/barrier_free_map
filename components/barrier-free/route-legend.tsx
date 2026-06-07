"use client";

import { useUi } from "@/hooks/use-ui";
import { ROUTE_LEGEND, legendItemsForRoute } from "@/lib/routing/style";
import type { WalkwayType } from "@/lib/routing/types";
import { cn } from "@/lib/utils";

interface RouteLegendProps {
  segmentTypes: WalkwayType[];
  /** 지도 위 오버레이 — 배경·그림자 강조 */
  variant?: "panel" | "map";
  className?: string;
}

export function RouteLegend({ segmentTypes, variant = "panel", className }: RouteLegendProps) {
  const ui = useUi();
  const items = legendItemsForRoute(segmentTypes);

  if (items.length <= 1) return null;

  return (
    <div
      className={cn(
        variant === "map" &&
          "rounded-lg border border-border/80 bg-background/95 px-3 py-2 shadow-md backdrop-blur-sm",
        className,
      )}
      role="note"
      aria-label={ui.route.legendTitle}
    >
      <p
        className={cn(
          "font-semibold text-foreground",
          variant === "map" ? "mb-1.5 text-xs" : "mb-1 text-[11px]",
        )}
      >
        {ui.route.legendTitle}
      </p>
      <ul
        className={cn(
          "flex flex-wrap gap-x-2 gap-y-1 sm:gap-x-3",
          variant === "map" ? "text-[11px] sm:text-xs" : "text-[11px]",
        )}
      >
        {items.map((l) => (
          <li key={l.type} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block h-2 w-5 shrink-0 rounded-full"
              style={{ backgroundColor: l.color }}
              aria-hidden
            />
            <span className="text-foreground/90">{ui.route.legend[l.type as keyof typeof ui.route.legend]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
