import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Brand } from "@/components/brand";

const navigation = [
  ["Overview", "/dashboard"],
  ["Calendar", "/calendar"],
  ["Hotels & rates", "/hotels"],
  ["Shows", "/shows"],
  ["Artists", "/artists"],
  ["Expenses", "/expenses"],
  ["Monthly finance", "/finance"],
];

export function AppShell({ children, name, organization, role }: {
  children: React.ReactNode;
  name: string;
  organization: string;
  role: "owner" | "partner";
}) {
  const links = role === "owner" ? [...navigation, ["Team", "/team"]] : navigation;
  return <div className="shell">
    <aside className="sidebar">
      <Brand href="/dashboard" />
      <div className="navLabel">{organization}</div>
      <nav className="nav">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
      <div className="sidebarFooter"><div className="profileName">{name}</div><div className="profileRole">{role === "owner" ? "Owner · Hotels & finance" : "Partner · Operations"}</div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="topbarTitle">{organization}</div><div className="topbarActions"><span className="badge brand">Live workspace</span><form action={signOut}><button className="button small" type="submit">Sign out</button></form></div></header>
      <div className="content">{children}</div>
    </main>
  </div>;
}
