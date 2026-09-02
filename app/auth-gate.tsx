"use client";

import { useEffect, useState, type FormEvent } from "react";
import CRMApp from "./crm-app";

const SUPABASE_URL = "https://jkibcngeendceqmnimgg.supabase.co";
const SUPABASE_KEY = "sb_publishable_eKcl0T4Yanjb9AJfjRoc8w_kY3wBq1S";
const SESSION_KEY = "arbi-x-crm-session";

type Session = { access_token: string; refresh_token: string; expires_at?: number; user: { email?: string } };
type Member = { id: string; email: string; name: string; role: "OWNER" | "ADMIN" | "VIEWER"; is_active: boolean };

const headers = (token?: string) => ({
  apikey: SUPABASE_KEY,
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("evgen.aff1@gmail.com");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [membersOpen, setMembersOpen] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      const next = { access_token: accessToken, refresh_token: refreshToken, user: { email: "" } };
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      history.replaceState(null, "", window.location.pathname);
      setSession(next);
      return;
    }
    try { setSession(JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null")); }
    catch { localStorage.removeItem(SESSION_KEY); setChecking(false); }
  }, []);

  useEffect(() => {
    if (!session) { setChecking(false); return; }
    void validate(session);
  }, [session]);

  async function validate(current: Session) {
    setChecking(true);
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: headers(current.access_token) });
    if (!userResponse.ok) { signOut(); return; }
    const user = await userResponse.json() as { email?: string };
    const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?select=id,email,name,role,is_active&email=eq.${encodeURIComponent(user.email ?? "")}&is_active=eq.true`, { headers: headers(current.access_token) });
    const rows = response.ok ? await response.json() as Member[] : [];
    if (!rows[0]) { setMessage("Ця пошта не має доступу до CRM"); signOut(false); return; }
    const next = { ...current, user };
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setMember(rows[0]); setChecking(false);
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setMessage("Входимо…");
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email: email.trim().toLowerCase(), password, gotrue_meta_security: {} }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(response.status === 400 ? "Неправильна пошта або пароль" : String(body.msg ?? body.message ?? "Не вдалося увійти"));
      return;
    }
    const next = { access_token: body.access_token, refresh_token: body.refresh_token, expires_at: body.expires_at, user: body.user ?? { email } };
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
    setMessage("");
  }

  function signOut(clearMessage = true) {
    localStorage.removeItem(SESSION_KEY); setSession(null); setMember(null); setChecking(false);
    if (clearMessage) setMessage("");
  }

  if (checking) return <div className="auth-screen"><div className="auth-card"><div className="auth-logo">A</div><h1>ARBI X TEAM</h1><p>Перевіряємо доступ…</p></div></div>;
  if (!session || !member) return <div className="auth-screen"><div className="auth-card"><div className="auth-logo">A</div><span>ЗАКРИТА CRM</span><h1>Вхід у CRM</h1><p>Увійти можуть тільки користувачі, яких додав власник.</p><form onSubmit={signIn}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label><label>Пароль<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label><button type="submit">Увійти</button></form>{message && <div className="auth-message">{message}</div>}</div></div>;

  return <><CRMApp user={{ name: member.name || member.email.split("@")[0], email: member.email }} /><div className="auth-user-tools"><span>{member.email}</span>{member.role === "OWNER" && <button onClick={() => setMembersOpen(true)}>Користувачі</button>}<button onClick={() => signOut()}>Вийти</button></div>{membersOpen && <MembersDialog session={session} onClose={() => setMembersOpen(false)} />}</>;
}

function MembersDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState(""); const [name, setName] = useState(""); const [role, setRole] = useState<"ADMIN" | "VIEWER">("ADMIN"); const [message, setMessage] = useState("");
  async function load() { const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?select=id,email,name,role,is_active&order=created_at.asc`, { headers: headers(session.access_token) }); if (r.ok) setMembers(await r.json()); }
  useEffect(() => { void load(); }, []);
  async function add(event: FormEvent) { event.preventDefault(); const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_users`, { method: "POST", headers: { ...headers(session.access_token), Prefer: "return=representation" }, body: JSON.stringify({ id: crypto.randomUUID(), email: email.trim().toLowerCase(), name: name.trim() || email.split("@")[0], role, is_active: true }) }); if (r.ok) { setEmail(""); setName(""); setMessage("Користувача додано"); await load(); } else { const b = await r.json().catch(() => ({})); setMessage(String(b.message ?? "Не вдалося додати")); } }
  async function remove(item: Member) { if (item.role === "OWNER" || !confirm(`Забрати доступ у ${item.email}?`)) return; const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?id=eq.${item.id}`, { method: "DELETE", headers: headers(session.access_token) }); if (r.ok) await load(); }
  return <div className="members-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="members-dialog"><header><div><span>ДОСТУП ДО CRM</span><h2>Користувачі</h2></div><button onClick={onClose}>×</button></header><form onSubmit={add}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@gmail.com" required /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ім’я" /><select value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "VIEWER")}><option value="ADMIN">Адміністратор</option><option value="VIEWER">Перегляд</option></select><button type="submit">＋ Додати</button></form>{message && <p className="members-message">{message}</p>}<div className="members-list">{members.map((item) => <article key={item.id}><div><strong>{item.name || "Без імені"}</strong><span>{item.email}</span></div><em>{item.role === "OWNER" ? "Власник" : item.role === "ADMIN" ? "Адмін" : "Перегляд"}</em>{item.role !== "OWNER" && <button onClick={() => remove(item)}>Видалити</button>}</article>)}</div></section></div>;
}
