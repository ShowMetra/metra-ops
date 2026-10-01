"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { CalendarMonthNavigation } from "@/components/calendar-month-navigation";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { deletePerformance, updatePerformance } from "@/app/(dashboard)/calendar/actions";

type ShowOption = { id: string; name: string; color: string };
type HotelOption = { id: string; name: string };
type CalendarDay = { date: string; dayNumber: number; weekday: string; outside: boolean; today: boolean };
type CalendarPerformance = {
  id: string;
  showId: string;
  showName: string;
  showColor: string;
  hotelId: string;
  hotelName: string;
  hotelAddress: string | null;
  startsAt: string;
  date: string;
  time: string;
  dateTimeLabel: string;
  inMonth: boolean;
  durationMinutes: number;
  operationalNotes: string | null;
  partnerName: string | null;
  finished: boolean;
};

const colorStyle = (color: string) => ({ "--show-color": color } as CSSProperties);

export function CalendarWorkspace({
  previousHref,
  todayHref,
  nextHref,
  monthLabel,
  days,
  performances,
  shows,
  editableShows,
  hotels,
  isOwner,
  storageKey,
}: {
  previousHref: string;
  todayHref: string;
  nextHref: string;
  monthLabel: string;
  days: CalendarDay[];
  performances: CalendarPerformance[];
  shows: ShowOption[];
  editableShows: ShowOption[];
  hotels: HotelOption[];
  isOwner: boolean;
  storageKey: string;
}) {
  const monthlyPerformances = useMemo(() => performances.filter(item => item.inMonth), [performances]);
  const defaultShowIds = useMemo(() => {
    const ids = [...new Set(monthlyPerformances.map(item => item.showId))];
    for (const show of shows) if (!ids.includes(show.id)) ids.push(show.id);
    return ids.slice(0, 4);
  }, [monthlyPerformances, shows]);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedShowIds, setSelectedShowIds] = useState<string[]>(defaultShowIds);
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const validIds = new Set(shows.map(show => show.id));
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
        const restored = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string" && validIds.has(id)).slice(0, 4) : [];
        setSelectedShowIds(restored.length ? restored : defaultShowIds);
      } catch {
        setSelectedShowIds(defaultShowIds);
      }
      setFiltersLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [defaultShowIds, shows, storageKey]);

  useEffect(() => {
    if (filtersLoaded) localStorage.setItem(storageKey, JSON.stringify(selectedShowIds));
  }, [filtersLoaded, selectedShowIds, storageKey]);

  const selected = new Set(selectedShowIds);
  const filteredPerformances = performances.filter(item => selected.has(item.showId));
  const filteredMonthlyPerformances = monthlyPerformances.filter(item => selected.has(item.showId));
  const eventsByDate = new Map<string, CalendarPerformance[]>();
  for (const performance of filteredPerformances) {
    const events = eventsByDate.get(performance.date) ?? [];
    events.push(performance);
    eventsByDate.set(performance.date, events);
  }

  const toggleShow = (showId: string) => {
    setSelectedShowIds(current => current.includes(showId)
      ? current.filter(id => id !== showId)
      : current.length < 4 ? [...current, showId] : current);
  };

  return <section className="card calendarCard">
    <CalendarMonthNavigation
      previousHref={previousHref}
      todayHref={todayHref}
      nextHref={nextHref}
      monthLabel={monthLabel}
      performanceCount={filteredMonthlyPerformances.length}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
    />

    <div className={`calendarFilters${filtersOpen ? "" : " collapsed"}`}>
      <button className="calendarFiltersToggle" type="button" onClick={() => setFiltersOpen(open => !open)} aria-expanded={filtersOpen} aria-controls="calendar-show-filters">
        <span className="calendarFiltersIntro"><strong>Visible shows</strong><small>{filtersOpen ? "Select up to 4. Your choice is saved on this device." : `${selectedShowIds.length} shows selected`}</small></span>
        <span className="calendarFiltersToggleMeta"><span className="badge brand">{selectedShowIds.length}/4</span><span>{filtersOpen ? "Hide" : "Show"}</span><span className="calendarFiltersChevron" aria-hidden="true">⌄</span></span>
      </button>
      {filtersOpen && <div className="calendarShowFilters" id="calendar-show-filters" role="group" aria-label="Visible shows">
        {shows.map(show => {
          const checked = selected.has(show.id);
          const disabled = !checked && selectedShowIds.length >= 4;
          return <label className={`calendarShowFilter${checked ? " selected" : ""}${disabled ? " disabled" : ""}`} key={show.id} style={colorStyle(show.color)}>
            <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleShow(show.id)} />
            <span className="showColorDot" aria-hidden="true" />
            <span>{show.name}</span>
          </label>;
        })}
      </div>}
    </div>

    {viewMode === "calendar" ? <div className="calendarScroll"><div className="monthCalendar">
      {days.slice(0, 7).map(day => <div className="monthCalendarWeekday" key={`weekday-${day.date}`}>{day.weekday}</div>)}
      {days.map(day => {
        const dayEvents = eventsByDate.get(day.date) ?? [];
        const visibleEvents = dayEvents.slice(0, 4);
        return <div className={`monthCalendarDay${day.outside ? " outside" : ""}${day.today ? " today" : ""}`} key={day.date}>
          <div className="monthCalendarDate"><span>{day.dayNumber}</span></div>
          <div className="monthCalendarEvents">
            {visibleEvents.map(performance => <div className={`calendarEvent${performance.finished ? " finished" : " planned"}`} key={performance.id} style={colorStyle(performance.showColor)} title={`${performance.showName} · ${performance.hotelName}${performance.partnerName ? ` · ${performance.partnerName}` : ""}`}>
              <div className="calendarEventTitle"><span>{performance.time}</span><strong>{performance.hotelName}</strong></div>
              <small>{performance.operationalNotes || "No operational notes"}</small>
            </div>)}
            {dayEvents.length > visibleEvents.length && <div className="calendarMore">+{dayEvents.length - visibleEvents.length} more</div>}
          </div>
        </div>;
      })}
    </div></div> : <div className="calendarList tableWrap"><table><thead><tr><th>Date & time</th><th>Show</th><th>Hotel</th>{isOwner && <th>Partner</th>}<th>Status</th><th>Notes</th>{!isOwner && <th>Actions</th>}</tr></thead><tbody>
      {filteredMonthlyPerformances.map(item => <tr key={item.id}>
        <td className="strong">{item.dateTimeLabel}</td>
        <td><span className="showNameWithColor" style={colorStyle(item.showColor)}><span className="showColorDot" aria-hidden="true" />{item.showName}</span></td>
        <td><div>{item.hotelName}</div><div className="sub">{item.hotelAddress}</div></td>
        {isOwner && <td>{item.partnerName || "—"}</td>}
        <td><span className={`badge ${item.finished ? "success" : "brand"}`}>{item.finished ? "Finished" : "Planned"}</span></td>
        <td className="muted">{item.operationalNotes || "—"}</td>
        {!isOwner && <td>{item.finished ? <span className="muted">Locked</span> : <div className="showActions calendarRowActions">
          <details className="showEditor"><summary>Edit</summary><form action={updatePerformance} className="formGrid compactForm">
            <input name="performance_id" type="hidden" value={item.id} />
            <div className="field"><label htmlFor={`show_${item.id}`}>Show</label><select id={`show_${item.id}`} name="show_id" defaultValue={item.showId} required>{editableShows.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div>
            <div className="field"><label htmlFor={`hotel_${item.id}`}>Hotel</label><select id={`hotel_${item.id}`} name="hotel_id" defaultValue={item.hotelId} required>{hotels.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div>
            <div className="field"><label htmlFor={`date_${item.id}`}>Date</label><input id={`date_${item.id}`} name="date" type="date" defaultValue={item.date} required /></div>
            <div className="field"><label htmlFor={`time_${item.id}`}>Start time</label><input id={`time_${item.id}`} name="time" type="time" defaultValue={item.time} required /></div>
            <div className="field"><label htmlFor={`duration_${item.id}`}>Duration (minutes)</label><input id={`duration_${item.id}`} name="duration_minutes" type="number" min="15" max="480" step="5" defaultValue={item.durationMinutes} required /></div>
            <div className="field full"><label htmlFor={`notes_${item.id}`}>Operational notes</label><textarea id={`notes_${item.id}`} name="notes" defaultValue={item.operationalNotes || ""} rows={3} /></div>
            <div className="field full"><SubmitButton className="button primary small" type="submit" pendingLabel="Saving…">Save</SubmitButton></div>
          </form></details>
          <form action={deletePerformance}><input name="performance_id" type="hidden" value={item.id} /><ConfirmSubmitButton className="button danger small" type="submit" pendingLabel="Deleting…" confirmMessage="Delete this planned performance?">Delete</ConfirmSubmitButton></form>
        </div>}</td>}
      </tr>)}
      {!filteredMonthlyPerformances.length && <tr><td colSpan={isOwner ? 6 : 7}><div className="emptyState">No performances for the selected shows in this month.</div></td></tr>}
    </tbody></table></div>}
  </section>;
}
