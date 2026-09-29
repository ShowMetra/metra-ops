"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

function NavigationPending() {
  const { pending } = useLinkStatus();
  return <span className={`navPending${pending ? " visible" : ""}`} aria-hidden="true" />;
}

export function AppNavigation({ links }: { links: Array<[string, string]> }) {
  const pathname = usePathname();

  return <nav className="nav">{links.map(([label, href]) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return <Link className={active ? "active" : undefined} aria-current={active ? "page" : undefined} key={href} href={href}><span>{label}</span><NavigationPending /></Link>;
  })}</nav>;
}
