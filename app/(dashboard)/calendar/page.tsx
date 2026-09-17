import { AppShell } from "@/components/app-shell";

const slots = [
  { row: 0, col: 1, content: <div className="event"><strong>Acrobatic Pirate</strong><br/>Stella Palace · 20:30</div> },
  { row: 0, col: 3, content: <div className="event green"><strong>Fire Show I</strong><br/>Lyttos Beach · 21:00</div> },
  { row: 1, col: 2, content: <div className="event orange"><strong>Cuba Latin</strong><br/>Eliros Mare · 20:45</div> },
  { row: 1, col: 5, content: <div className="event"><strong>Aerial II</strong><br/>Pilot Beach · 21:15</div> },
];

export default function CalendarPage() {
  const days = ["Mon 14", "Tue 15", "Wed 16", "Thu 17", "Fri 18", "Sat 19", "Sun 20"];
  return <AppShell section="Schedule">
    <div className="pageHeader"><div><p className="eyebrow">14–20 September</p><h1>Performance calendar</h1><p className="lede">Plan the week and confirm what actually happened.</p></div><div><button className="button">Today</button> <button className="button primary">Add performance</button></div></div>
    <div className="card tableWrap">
      <div className="calendar">
        <div className="head" />{days.map(day => <div className="head" key={day}>{day}</div>)}
        {["19:00", "20:30", "22:00"].flatMap((time,row) => [<div className="time" key={time}>{time}</div>, ...days.map((day,col) => <div key={`${time}-${day}`}>{slots.find(s => s.row===row && s.col===col)?.content}</div>)])}
      </div>
    </div>
    <div className="card section"><div className="sectionHeader"><h2>Needs confirmation</h2><span className="badge warning">5 performances</span></div><div className="sectionBody tableWrap"><table><thead><tr><th>Date</th><th>Show</th><th>Hotel</th><th>Status</th><th></th></tr></thead><tbody><tr><td>16 Sep · 21:00</td><td className="strong">Fire Show I</td><td>Lyttos Beach</td><td><span className="badge warning">Planned</span></td><td className="num"><button className="button small primary">Confirm</button></td></tr></tbody></table></div></div>
  </AppShell>;
}
