import { AppShell } from "@/components/app-shell";

const artists = [
  ["Yaroslav Borovyk", "Acrobatic Pirate", "€3,000", "18 / 29", "€0"],
  ["Gabor Piros", "Acrobatic Pirate", "€2,000", "18 / 29", "€0"],
  ["Akmal Nagornov", "Acrobatic Aerial I", "€1,900", "31 / 29", "€140"],
  ["Yelyzaveta Nagornova", "Acrobatic Aerial I", "€1,900", "31 / 29", "€140"],
];

export default function ArtistsPage() {
  return <AppShell section="Artist payroll">
    <div className="pageHeader"><div><p className="eyebrow">September 2026</p><h1>Artists</h1><p className="lede">Monthly salary stays fixed. Extra is added only above the required working days.</p></div><button className="button primary">Add artist</button></div>
    <div className="card sectionBody tableWrap" style={{ paddingTop: 8 }}><table><thead><tr><th>Artist</th><th>Show</th><th>Monthly salary</th><th>Worked / required</th><th>Extra</th></tr></thead><tbody>{artists.map(a => <tr key={a[0]}><td className="strong">{a[0]}</td><td>{a[1]}</td><td>{a[2]}</td><td>{a[3]}</td><td className="strong">{a[4]}</td></tr>)}</tbody></table></div>
  </AppShell>;
}
