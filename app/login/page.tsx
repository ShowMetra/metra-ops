import { signIn } from "./actions";
import Link from "next/link";
import { Brand } from "@/components/brand";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const { error, message, next } = await searchParams;
  return <div className="publicShell" style={{ display: "grid", placeItems: "center", padding: 20 }}>
    <main className="card" style={{ width: "100%", maxWidth: 420, padding: 30 }}>
      <Brand />
      <p className="eyebrow">Operations</p><h1>Welcome back</h1><p className="lede">Sign in as an owner or partner.</p>
      <form action={signIn} className="formGrid" style={{ marginTop: 26 }}>
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        <div className="field full"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="field full"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
        {error && <div className="field full"><span className="badge danger">{error}</span></div>}
        {message && <div className="field full"><span className="badge success">{message}</span></div>}
        <div className="field full"><button className="button primary" type="submit">Sign in</button></div>
      </form>
      <p className="authFooter">Setting up the company? <Link href="/register">Create owner account</Link></p>
    </main>
  </div>;
}
