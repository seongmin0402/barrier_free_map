"use client";

interface NavLiveRegionProps {
  message: string;
  label: string;
  /** 안내 중 모바일 등에서 보이는 요약 (스크린리더는 sr-only 영역도 동시 갱신) */
  visible?: boolean;
}

export function NavLiveRegion({ message, label, visible = false }: NavLiveRegionProps) {
  return (
    <>
      <div
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        aria-label={label}
        className="sr-only"
      >
        {message}
      </div>
      {visible && message ? (
        <p
          className="rounded-lg border border-blue-500/40 bg-blue-50 px-3 py-2 text-sm font-semibold leading-snug text-blue-950 dark:bg-blue-950/50 dark:text-blue-100"
          aria-hidden="true"
        >
          {message}
        </p>
      ) : null}
    </>
  );
}
