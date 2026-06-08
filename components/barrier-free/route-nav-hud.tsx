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
  labels,
}: RouteNavHudProps) {
  const { remaining, distanceToNext } = useNavMetricsDisplay(metricsDisplayRef, navigating);

  if (!navigating) return null;

  const remainingLabel =
    remaining != null && !isArrive
      ? `${remainingDistanceLabel(locale)} ${formatDistance(remaining, locale)}`
      : null;

  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute z-40 max-w-[min(calc(100%-1.5rem),18rem)] sm:hidden",
          "left-3 top-[max(0.75rem,env(safe-area-inset-top))]",
        )}
      >
        <div className="rounded-xl bg-blue-600 px-3 py-2.5 text-white shadow-xl ring-1 ring-blue-500/40">
          {!hasUserPos ? (
            <>
              <p className="text-sm font-semibold leading-tight">{labels.navActive}</p>
              <p className="mt-0.5 text-xs text-blue-100">{labels.acquiringGps}</p>
            </>
          ) : isArrive ? (
            <p className="text-base font-bold leading-tight">{arriveMessage(locale)}</p>
          ) : (
            <>
              <p className="text-2xl font-extrabold tabular-nums leading-none">
                {formatDistance(distanceToNext ?? 0, locale)}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">{bannerText}</p>
              {remainingLabel ? (
                <p className="mt-1 text-[11px] text-blue-100">{remainingLabel}</p>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="absolute left-[calc(22rem+0.75rem)] top-3 z-40 hidden max-w-xs rounded-xl bg-blue-600 px-4 py-3 text-white shadow-xl sm:block">
        <div className="flex items-start gap-3">
          <Navigation className="mt-0.5 h-6 w-6 shrink-0" />
          <div className="min-w-0">
            {!hasUserPos ? (
              <>
                <p className="text-sm font-semibold leading-tight">{labels.navActive}</p>
                <p className="mt-1 text-xs text-blue-100">{labels.acquiringGps}</p>
              </>
            ) : isArrive ? (
              <p className="text-lg font-bold leading-tight">{arriveMessage(locale)}</p>
            ) : bannerText ? (
              <>
                <p className="text-2xl font-extrabold leading-none">
                  {formatDistance(distanceToNext ?? 0, locale)}
                </p>
                <p className="mt-1 line-clamp-3 text-sm font-medium leading-snug">{bannerText}</p>
              </>
            ) : (
              <p className="text-sm font-semibold leading-tight">{labels.navActive}</p>
            )}
            {hasUserPos && remainingLabel ? (
              <p className="mt-1 text-xs text-blue-100">{remainingLabel}</p>
            ) : null}
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
    prev.labels.navActive === next.labels.navActive &&
    prev.labels.acquiringGps === next.labels.acquiringGps
  );
}

export const RouteNavHud = memo(RouteNavHudInner, hudPropsAreEqual);
