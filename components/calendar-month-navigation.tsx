"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function CalendarMonthNavigation({
  previousHref,
  todayHref,
  nextHref,
  monthLabel,
  performanceCount,
  viewMode,
  onViewModeChange,
}: {
  previousHref: string;
  todayHref: string;
  nextHref: string;
  monthLabel: string;
  performanceCount: number;
  viewMode: "calendar" | "list";
  onViewModeChange: (mode: "calendar" | "list") => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navigate = (href: string) => {
    if (pending) return;
    startTransition(() => router.push(href, { scroll: false }));
  };

  return <>
    <div className={`calendarToolbar${pending ? " pending" : ""}`} aria-busy={pending}>
      <div className="calendarNav">
        <button className="button small" type="button" onClick={() => navigate(previousHref)} disabled={pending} aria-label="Previous month">‹</button>
        <button className="button small" type="button" onClick={() => navigate(todayHref)} disabled={pending}>Today</button>
        <button className="button small" type="button" onClick={() => navigate(nextHref)} disabled={pending} aria-label="Next month">›</button>
      </div>
      <h2>{pending ? "Loading month…" : monthLabel}</h2>
      <div className="calendarToolbarRight">
        <span className="badge">{performanceCount} performances</span>
        <div className="segmented" aria-label="Calendar view">
          <button className={`button small${viewMode === "calendar" ? " active" : ""}`} type="button" onClick={() => onViewModeChange("calendar")} aria-pressed={viewMode === "calendar"}>Calendar</button>
          <button className={`button small${viewMode === "list" ? " active" : ""}`} type="button" onClick={() => onViewModeChange("list")} aria-pressed={viewMode === "list"}>List</button>
        </div>
      </div>
    </div>
    {pending && <div className="calendarMonthLoading" role="status" aria-live="polite"><span className="calendarLoadingSpinner" aria-hidden="true" /><strong>Loading calendar…</strong></div>}
  </>;
}
