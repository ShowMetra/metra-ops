"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNavigation({ links }: { links: Array<[string, string]> }) {
  const pathname = usePathname();

  return <nav className="nav">{links.map(([label, href]) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return <Link className={active ? "active" : undefined} aria-current={active ? "page" : undefined} key={href} href={href}>{label}</Link>;
  })}</nav>;
}
