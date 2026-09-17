import Link from "next/link";
import { registerOwner } from "./actions";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className="publicShell authShell">
    <main className="card authCard">
      <div className="brand"><span className="brandMark">S</span>ShowMetra</div>
      <p className="eyebrow">Owner setup</p><h1>Create your workspace</h1><p className="lede">The owner creates the company first, then invites partners.</p>
      <form action={registerOwner} className="formGrid authForm">
        <div className="field full"><label htmlFor="full_name">Full name</label><input id="full_name" name="full_name" autoComplete="name" required /></div>
        <div className="field full"><label htmlFor="register_email">Email</label><input id="register_email" name="email" type="email" autoComplete="email" required /></div>
        <div className="field full"><label htmlFor="register_password">Password</label><input id="register_password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div>
        {error && <div className="field full"><span className="badge danger">{error}</span></div>}
        <div className="field full"><button className="button primary" type="submit">Create owner account</button></div>
      </form>
      <p className="authFooter">Already have an account? <Link href="/login">Sign in</Link></p>
    </main>
  </div>;
}
