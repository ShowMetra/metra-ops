import { CalendarWorkspace } from "@/components/calendar-workspace";
import { SubmitButton } from "@/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { createPerformance } from "./actions";

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
  shows: { name: string; color: string; partner_user_id: string } | { name: string; color: string; partner_user_id: string }[] | null;
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
  const [{ data: performanceData }, { data: allShows }, { data: editableShows }, { data: hotels }, { data: profiles }] = await Promise.all([
    supabase.from("performances")
      .select("id, show_id, hotel_id, starts_at, ends_at, operational_notes, shows(name, color, partner_user_id), hotels(name, address)")
      .gte("starts_at", queryStart)
      .lt("starts_at", queryEnd)
      .order("starts_at"),
    supabase.from("shows").select("id, name, color").order("name"),
    supabase.from("shows").select("id, name, color").eq("status", "planned").is("archived_at", null).order("name"),
    supabase.from("hotels").select("id, name").eq("status", "active").order("name"),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const performances = (performanceData ?? []) as CalendarPerformance[];
  const partnerNames = new Map((profiles ?? []).map(profile => [profile.id, profile.full_name || profile.email || "Partner"]));
  const monthLabel = monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const isOwner = workspace.membership.role === "owner";
  const monthPerformances = performances.filter(performance => localParts(new Date(performance.starts_at), workspace.organization.timezone).date.startsWith(month));
  const serializedPerformances = performances.map(item => {
    const show = Array.isArray(item.shows) ? item.shows[0] : item.shows;
    const hotel = Array.isArray(item.hotels) ? item.hotels[0] : item.hotels;
    const start = new Date(item.starts_at);
    const end = new Date(item.ends_at || item.starts_at);
    const values = localParts(start, workspace.organization.timezone);
    return {
      id: item.id,
      showId: item.show_id,
      showName: show?.name ?? "Show",
      showColor: show?.color ?? "#157AAD",
      hotelId: item.hotel_id,
      hotelName: hotel?.name ?? "Hotel",
      hotelAddress: hotel?.address ?? null,
      startsAt: item.starts_at,
      date: values.date,
      time: values.time,
      dateTimeLabel: start.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: workspace.organization.timezone }),
      inMonth: values.date.startsWith(month),
      durationMinutes: Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)),
      operationalNotes: item.operational_notes,
      partnerName: isOwner && show?.partner_user_id ? partnerNames.get(show.partner_user_id) ?? "Unknown" : null,
      finished: end.getTime() <= now.getTime(),
    };
  });
  const days = gridDays.map(day => {
    const date = dateInput(day);
    return {
      date,
      dayNumber: day.getUTCDate(),
      weekday: day.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
      outside: date.slice(0, 7) !== month,
      today: date === today,
    };
  });

  return <>
    <div className="pageHeader calendarPageHeader"><div><p className="eyebrow">Live schedule</p><h1>Calendar</h1><p className="lede">Plan individual or recurring performances. Past entries automatically become Finished.</p></div>{isOwner && <span className="badge brand">All partners</span>}</div>
    {error && <div className="notice danger">{error}</div>}{message && <div className="notice success">{message}</div>}

    {!isOwner && <details className="card calendarCreate" open={!monthPerformances.length}><summary><span><strong>Create performance</strong><small>Single event or recurring series</small></span><span className="button primary small">+ Create</span></summary><div className="sectionBody">
      {editableShows?.length && hotels?.length ? <form action={createPerformance} className="formGrid">
        <div className="field"><label htmlFor="performance_show">Show</label><select id="performance_show" name="show_id" required>{editableShows.map(show => <option key={show.id} value={show.id}>{show.name}</option>)}</select></div>
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

    <CalendarWorkspace
      previousHref={`/calendar?month=${previousMonth}`}
      todayHref={`/calendar?month=${currentMonth}`}
      nextHref={`/calendar?month=${nextMonth}`}
      monthLabel={monthLabel}
      days={days}
      performances={serializedPerformances}
      shows={allShows ?? []}
      editableShows={editableShows ?? []}
      hotels={hotels ?? []}
      isOwner={isOwner}
      storageKey={`remarc:calendar-show-filter:${workspace.organization.id}:${workspace.user.id}`}
    />
  </>;
}
