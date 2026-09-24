import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Remarc Entertainment",
  description: "Show scheduling and financial operations for entertainment agencies",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
