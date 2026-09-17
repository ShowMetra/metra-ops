import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className="publicShell" style={{ display: "grid", placeItems: "center", padding: 20 }}>
    <main className="card" style={{ width: "100%", maxWidth: 420, padding: 30 }}>
      <div className="brand"><span className="brandMark">S</span>ShowMetra</div>
      <p className="eyebrow">Operations</p><h1>Welcome back</h1><p className="lede">Sign in as an owner or partner.</p>
      <form action={signIn} className="formGrid" style={{ marginTop: 26 }}>
        <div className="field full"><label>Email</label><input name="email" type="email" autoComplete="email" required /></div>
        <div className="field full"><label>Password</label><input name="password" type="password" autoComplete="current-password" required /></div>
        {error && <div className="field full"><span className="badge danger">{error}</span></div>}
        <div className="field full"><button className="button primary" type="submit">Sign in</button></div>
      </form>
    </main>
  </div>;
}
