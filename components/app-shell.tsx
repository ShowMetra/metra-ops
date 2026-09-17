import Link from "next/link";

const navigation = [
  ["Overview", "/dashboard"],
  ["Calendar", "/calendar"],
  ["Shows", "/shows"],
  ["Artists", "/artists"],
  ["Expenses", "/expenses"],
  ["Monthly finance", "/finance"],
];

export function AppShell({ children, section = "Operations" }: { children: React.ReactNode; section?: string }) {
  return <div className="shell">
    <aside className="sidebar">
      <Link href="/dashboard" className="brand"><span className="brandMark">S</span>ShowMetra</Link>
      <div className="navLabel">Workspace</div>
      <nav className="nav">{navigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
      <div className="sidebarFooter"><div className="profileName">ShowMetra owner</div><div className="profileRole">Owner · Full access</div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="topbarTitle">{section}</div><div className="topbarActions"><span className="badge brand">September 2026</span><button className="button small">Sign out</button></div></header>
      <div className="content">{children}</div>
    </main>
  </div>;
}
