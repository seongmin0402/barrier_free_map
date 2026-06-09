"use client";

import { memo } from "react";
import { Navigation } from "lucide-react";
import { arriveMessage, remainingDistanceLabel } from "@/lib/i18n/navigation";
import { formatDistance } from "@/lib/routing/geo";
import type { AppLocale } from "@/lib/app-settings";
import type { NavMetricsDisplayRef } from "@/hooks/use-navigation";
import { useNavMetricsDisplay } from "@/hooks/use-nav-metrics-display";
import { cn } from "@/lib/utils";

export type RouteNavHudProps = {
  navigating: boolean;
  hasUserPos: boolean;
  isArrive: boolean;
  bannerText: string;
  locale: AppLocale;
  metricsDisplayRef: NavMetricsDisplayRef;
  followPaused?: boolean;
  followPausedHint?: string;
  labels: {
    navActive: string;
    acquiringGps: string;
  };
};

function RouteNavHudInner({
  navigating,
  hasUserPos,
  isArrive,
  bannerText,
  locale,
  metricsDisplayRef,
  followPaused = false,
  followPausedHint,
  labels,
}: RouteNavHudProps) {
  const { remaining, distanceToNext } = useNavMetricsDisplay(metricsDisplayRef, navigating);

  if (!navigating) return null;

  const remainingLabel =
    remaining != null && !isArrive
      ? `${remainingDistanceLabel(locale)} ${formatDistance(remaining, locale)}`
      : null;

  const followPausedBanner =
    followPaused && followPausedHint ? (
      <div className="rounded-md border border-border/80 bg-card/95 px-2 py-1 text-[10px] leading-tight text-muted-foreground shadow-sm backdrop-blur-sm">
        {followPausedHint}
      </div>
    ) : null;

  const mobileHudTop = "top-[max(0.5rem,env(safe-area-inset-top))]";

  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute z-40 flex w-max max-w-[min(calc(100%-5.5rem),13.5rem)] flex-col gap-1 sm:hidden",
          "left-2.5",
          mobileHudTop,
        )}
      >
        {followPausedBanner}
        <div className="rounded-lg bg-blue-600 px-2 py-1.5 text-white shadow-lg ring-1 ring-blue-500/30">
          {!hasUserPos ? (
            <>
              <p className="text-xs font-semibold leading-tight">{labels.navActive}</p>
              <p className="mt-0.5 text-[10px] text-blue-100">{labels.acquiringGps}</p>
            </>
          ) : isArrive ? (
            <p className="text-sm font-bold leading-tight">{arriveMessage(locale)}</p>
          ) : (
            <>
              <p className="text-lg font-bold tabular-nums leading-none">
                {formatDistance(distanceToNext ?? 0, locale)}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug">{bannerText}</p>
              {remainingLabel ? (
                <p className="mt-0.5 text-[10px] text-blue-100">{remainingLabel}</p>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div
        className={cn(
          "absolute left-[calc(22rem+0.75rem)] z-40 hidden w-max max-w-xs flex-col gap-1.5 sm:flex",
          mobileHudTop,
        )}
      >
        {followPaused && followPausedHint ? (
          <div className="rounded-md border border-border/80 bg-card/95 px-2.5 py-1 text-[11px] leading-tight text-muted-foreground shadow-sm backdrop-blur-sm">
            {followPausedHint}
          </div>
        ) : null}
        <div className="rounded-lg bg-blue-600 px-3 py-2 text-white shadow-lg">
          <div className="flex items-start gap-2">
            <Navigation className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              {!hasUserPos ? (
                <>
                  <p className="text-xs font-semibold leading-tight">{labels.navActive}</p>
                  <p className="mt-0.5 text-[10px] text-blue-100">{labels.acquiringGps}</p>
                </>
              ) : isArrive ? (
                <p className="text-base font-bold leading-tight">{arriveMessage(locale)}</p>
              ) : bannerText ? (
                <>
                  <p className="text-xl font-bold leading-none">
                    {formatDistance(distanceToNext ?? 0, locale)}
                  </p>
                  <p className="mt-0.5 line-clamp-3 text-xs font-medium leading-snug">{bannerText}</p>
                </>
              ) : (
                <p className="text-xs font-semibold leading-tight">{labels.navActive}</p>
              )}
              {hasUserPos && remainingLabel ? (
                <p className="mt-0.5 text-[10px] text-blue-100">{remainingLabel}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function hudPropsAreEqual(prev: RouteNavHudProps, next: RouteNavHudProps): boolean {
  return (
    prev.navigating === next.navigating &&
    prev.hasUserPos === next.hasUserPos &&
    prev.isArrive === next.isArrive &&
    prev.bannerText === next.bannerText &&
    prev.locale === next.locale &&
    prev.metricsDisplayRef === next.metricsDisplayRef &&
    prev.followPaused === next.followPaused &&
    prev.followPausedHint === next.followPausedHint &&
    prev.labels.navActive === next.labels.navActive &&
    prev.labels.acquiringGps === next.labels.acquiringGps
  );
}

export const RouteNavHud = memo(RouteNavHudInner, hudPropsAreEqual);
