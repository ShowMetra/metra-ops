import { CalendarMonthNavigation } from "@/components/calendar-month-navigation";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { createPerformance, deletePerformance, updatePerformance } from "./actions";

const localParts = (value: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
};

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const dateInput = (value: Date) => value.toISOString().slice(0, 10);
const monthInput = (value: Date) => value.toISOString().slice(0, 7);
const addUtcDays = (value: Date, amount: number) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + amount));
const addUtcMonths = (value: Date, amount: number) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + amount, 1));

type CalendarPerformance = {
  id: string;
  show_id: string;
  hotel_id: string;
  starts_at: string;
  ends_at: string | null;
  operational_notes: string | null;
  shows: { name: string; partner_user_id: string } | { name: string; partner_user_id: string }[] | null;
  hotels: { name: string; address: string | null } | { name: string; address: string | null }[] | null;
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; month?: string | string[] }> }) {
  const [{ error, message, month: requestedMonth }, workspace] = await Promise.all([searchParams, requireWorkspace()]);
  const now = new Date();
  const today = localParts(now, workspace.organization.timezone).date;
  const currentMonth = today.slice(0, 7);
  const month = typeof requestedMonth === "string" && monthPattern.test(requestedMonth) ? requestedMonth : currentMonth;
  const monthStart = new Date(`${month}-01T00:00:00Z`);
  const mondayOffset = (monthStart.getUTCDay() + 6) % 7;
  const gridStart = addUtcDays(monthStart, -mondayOffset);
  const gridDays = Array.from({ length: 42 }, (_, index) => addUtcDays(gridStart, index));
  const gridEnd = addUtcDays(gridStart, 42);
  const queryStart = addUtcDays(gridStart, -1).toISOString();
  const queryEnd = addUtcDays(gridEnd, 1).toISOString();
  const previousMonth = monthInput(addUtcMonths(monthStart, -1));
  const nextMonth = monthInput(addUtcMonths(monthStart, 1));
  const defaultStart = addUtcDays(new Date(`${today}T00:00:00Z`), 1);
  const defaultDate = dateInput(defaultStart);
  const defaultRepeatUntil = dateInput(addUtcDays(defaultStart, 84));
  const maxRepeatUntil = dateInput(addUtcDays(defaultStart, 365));

  const supabase = await createSupabaseServerClient();
  const [{ data: performanceData }, { data: shows }, { data: hotels }, { data: profiles }] = await Promise.all([
    supabase.from("performances")
      .select("id, show_id, hotel_id, starts_at, ends_at, operational_notes, shows(name, partner_user_id), hotels(name, address)")
      .gte("starts_at", queryStart)
      .lt("starts_at", queryEnd)
      .order("starts_at"),
    supabase.from("shows").select("id, name").eq("status", "planned").order("name"),
    supabase.from("hotels").select("id, name").eq("status", "active").order("name"),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const performances = (performanceData ?? []) as CalendarPerformance[];
  const partnerNames = new Map((profiles ?? []).map(profile => [profile.id, profile.full_name || profile.email || "Partner"]));
  const eventsByDay = new Map<string, CalendarPerformance[]>();
  for (const performance of performances) {
    const date = localParts(new Date(performance.starts_at), workspace.organization.timezone).date;
    const dayEvents = eventsByDay.get(date) ?? [];
    dayEvents.push(performance);
    eventsByDay.set(date, dayEvents);
  }
  const monthPerformances = performances.filter(performance => localParts(new Date(performance.starts_at), workspace.organization.timezone).date.startsWith(month));
  const monthLabel = monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const isOwner = workspace.membership.role === "owner";

  return <>
    <div className="pageHeader calendarPageHeader"><div><p className="eyebrow">Live schedule</p><h1>Calendar</h1><p className="lede">Plan individual or recurring performances. Past entries automatically become Finished.</p></div>{isOwner && <span className="badge brand">All partners</span>}</div>
    {error && <div className="notice danger">{error}</div>}{message && <div className="notice success">{message}</div>}

    {!isOwner && <details className="card calendarCreate" open={!monthPerformances.length}><summary><span><strong>Create performance</strong><small>Single event or recurring series</small></span><span className="button primary small">+ Create</span></summary><div className="sectionBody">
      {shows?.length && hotels?.length ? <form action={createPerformance} className="formGrid">
        <div className="field"><label htmlFor="performance_show">Show</label><select id="performance_show" name="show_id" required>{shows.map(show => <option key={show.id} value={show.id}>{show.name}</option>)}</select></div>
        <div className="field"><label htmlFor="performance_hotel">Hotel</label><select id="performance_hotel" name="hotel_id" required>{hotels.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></div>
        <div className="field"><label htmlFor="performance_date">First date</label><input id="performance_date" name="date" type="date" defaultValue={defaultDate} required /></div>
        <div className="field"><label htmlFor="performance_time">Start time</label><input id="performance_time" name="time" type="time" defaultValue="20:00" required /></div>
        <div className="field"><label htmlFor="performance_duration">Duration (minutes)</label><input id="performance_duration" name="duration_minutes" type="number" min="15" max="480" step="5" defaultValue="60" required /></div>
        <div className="field"><label htmlFor="performance_recurrence">Repeat</label><select id="performance_recurrence" name="recurrence" defaultValue="none"><option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Every month</option></select></div>
        <div className="field"><label htmlFor="performance_repeat_until">Repeat until</label><input id="performance_repeat_until" name="repeat_until" type="date" defaultValue={defaultRepeatUntil} max={maxRepeatUntil} /><span className="helpText">Used only for recurring series, up to one year.</span></div>
        <div className="field full"><label htmlFor="performance_notes">Operational notes</label><textarea id="performance_notes" name="notes" rows={3} /></div>
        <div className="field full"><SubmitButton className="button primary" type="submit" pendingLabel="Creating…">Create performance</SubmitButton></div>
      </form> : <div className="emptyState">Create a show and add a hotel first.</div>}
    </div></details>}

    <section className="card calendarCard">
      <CalendarMonthNavigation
        previousHref={`/calendar?month=${previousMonth}`}
        todayHref={`/calendar?month=${currentMonth}`}
        nextHref={`/calendar?month=${nextMonth}`}
        monthLabel={monthLabel}
        performanceCount={monthPerformances.length}
      />
      <div className="calendarScroll"><div className="monthCalendar">
        {gridDays.slice(0, 7).map(day => <div className="monthCalendarWeekday" key={`weekday-${dateInput(day)}`}>{day.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</div>)}
        {gridDays.map(day => {
          const date = dateInput(day);
          const dayEvents = eventsByDay.get(date) ?? [];
          const visibleEvents = dayEvents.slice(0, 4);
          return <div className={`monthCalendarDay${date.slice(0, 7) !== month ? " outside" : ""}${date === today ? " today" : ""}`} key={date}>
            <div className="monthCalendarDate"><span>{day.getUTCDate()}</span></div>
            <div className="monthCalendarEvents">{visibleEvents.map(performance => {
              const show = Array.isArray(performance.shows) ? performance.shows[0] : performance.shows;
              const hotel = Array.isArray(performance.hotels) ? performance.hotels[0] : performance.hotels;
              const start = new Date(performance.starts_at);
              const end = new Date(performance.ends_at || performance.starts_at);
              const finished = end.getTime() <= now.getTime();
              return <div className={`calendarEvent ${finished ? "finished" : "planned"}`} key={performance.id} title={`${show?.name ?? "Show"} · ${hotel?.name ?? "Hotel"}`}>
                <span>{localParts(start, workspace.organization.timezone).time}</span><strong>{show?.name ?? "Show"}</strong><small>{hotel?.name ?? "Hotel"}{isOwner && show?.partner_user_id ? ` · ${partnerNames.get(show.partner_user_id) ?? "Partner"}` : ""}</small>
              </div>;
            })}{dayEvents.length > visibleEvents.length && <div className="calendarMore">+{dayEvents.length - visibleEvents.length} more</div>}</div>
          </div>;
        })}
      </div></div>
    </section>

    <section className="card section"><div className="sectionHeader"><div><h2>{monthLabel} agenda</h2><p className="sub">Detailed list and controls</p></div><span className="badge">{monthPerformances.length}</span></div><div className="sectionBody tableWrap"><table><thead><tr><th>Date & time</th><th>Show</th><th>Hotel</th>{isOwner && <th>Partner</th>}<th>Status</th><th>Notes</th>{!isOwner && <th>Actions</th>}</tr></thead><tbody>
      {monthPerformances.map(item => {
        const show = Array.isArray(item.shows) ? item.shows[0] : item.shows;
        const hotel = Array.isArray(item.hotels) ? item.hotels[0] : item.hotels;
        const start = new Date(item.starts_at);
        const end = new Date(item.ends_at || item.starts_at);
        const isFinished = end.getTime() <= now.getTime();
        const values = localParts(start, workspace.organization.timezone);
        const duration = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
        return <tr key={item.id}>
          <td className="strong">{start.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: workspace.organization.timezone })}</td>
          <td>{show?.name ?? "—"}</td>
          <td><div>{hotel?.name ?? "—"}</div><div className="sub">{hotel?.address}</div></td>
          {isOwner && <td>{show?.partner_user_id ? partnerNames.get(show.partner_user_id) ?? "Unknown" : "—"}</td>}
          <td><span className={`badge ${isFinished ? "success" : "brand"}`}>{isFinished ? "Finished" : "Planned"}</span></td>
          <td className="muted">{item.operational_notes || "—"}</td>
          {!isOwner && <td>{isFinished ? <span className="muted">Locked</span> : <div className="showActions calendarRowActions">
            <details className="showEditor"><summary>Edit</summary><form action={updatePerformance} className="formGrid compactForm">
              <input name="performance_id" type="hidden" value={item.id} />
              <div className="field"><label htmlFor={`show_${item.id}`}>Show</label><select id={`show_${item.id}`} name="show_id" defaultValue={item.show_id} required>{shows?.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div>
              <div className="field"><label htmlFor={`hotel_${item.id}`}>Hotel</label><select id={`hotel_${item.id}`} name="hotel_id" defaultValue={item.hotel_id} required>{hotels?.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div>
              <div className="field"><label htmlFor={`date_${item.id}`}>Date</label><input id={`date_${item.id}`} name="date" type="date" defaultValue={values.date} required /></div>
              <div className="field"><label htmlFor={`time_${item.id}`}>Start time</label><input id={`time_${item.id}`} name="time" type="time" defaultValue={values.time} required /></div>
              <div className="field"><label htmlFor={`duration_${item.id}`}>Duration (minutes)</label><input id={`duration_${item.id}`} name="duration_minutes" type="number" min="15" max="480" step="5" defaultValue={duration} required /></div>
              <div className="field full"><label htmlFor={`notes_${item.id}`}>Operational notes</label><textarea id={`notes_${item.id}`} name="notes" defaultValue={item.operational_notes || ""} rows={3} /></div>
              <div className="field full"><SubmitButton className="button primary small" type="submit" pendingLabel="Saving…">Save</SubmitButton></div>
            </form></details>
            <form action={deletePerformance}><input name="performance_id" type="hidden" value={item.id} /><ConfirmSubmitButton className="button danger small" type="submit" pendingLabel="Deleting…" confirmMessage="Delete this planned performance?">Delete</ConfirmSubmitButton></form>
          </div>}</td>}
        </tr>;
      })}
      {!monthPerformances.length && <tr><td colSpan={6}><div className="emptyState">No performances in this month.</div></td></tr>}
    </tbody></table></div></section>
  </>;
}
