"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode, type SelectHTMLAttributes } from "react";

type RecordType = "lead" | "student" | "payment" | "access" | "expense" | "task" | "cohort" | "team" | "split" | "activity";
type EditableType = Exclude<RecordType, "activity">;
type Section = "dashboard" | EditableType | "analytics" | "activity" | "archive" | "settings";
type Data = Record<string, string | number | boolean>;
type CrmRecord = { id: string; type: RecordType; data: Data; createdBy: string; createdAt: string; updatedAt: string };
type Groups = Record<RecordType, CrmRecord[]>;
type ModalState = { type: EditableType; record?: CrmRecord; draft?: Data };
type Theme = "light" | "dark";

const TYPES: RecordType[] = ["lead", "student", "payment", "access", "expense", "task", "cohort", "team", "split", "activity"];
const NAV: { id: Section; label: string; icon: string }[] = [
  { id: "dashboard", label: "Головна", icon: "⌂" },
  { id: "lead", label: "Ліди", icon: "◎" },
  { id: "student", label: "Учні", icon: "◇" },
  { id: "task", label: "Завдання", icon: "✓" },
  { id: "cohort", label: "Потоки", icon: "◫" },
  { id: "payment", label: "Оплати", icon: "$" },
  { id: "access", label: "Доступ $49", icon: "↗" },
  { id: "expense", label: "Витрати", icon: "−" },
  { id: "team", label: "Команда", icon: "♙" },
  { id: "split", label: "Розподіл", icon: "%" },
  { id: "analytics", label: "Аналітика", icon: "▥" },
  { id: "activity", label: "Журнал дій", icon: "↻" },
  { id: "archive", label: "Архів", icon: "□" },
  { id: "settings", label: "Налаштування", icon: "⚙" },
];
const PRICES: Record<string, number> = { Базовий: 290, PRO: 450, Індивідуальний: 2000 };
const TITLES: Record<EditableType, string> = { lead: "ліда", student: "учня", payment: "оплату", access: "доступ", expense: "витрату", task: "завдання", cohort: "потік", team: "учасника", split: "частку" };
const DESCRIPTIONS: Record<EditableType, string> = {
  lead: "Усі заявки та етапи продажу — жоден контакт не загубиться.", student: "Картки учнів, тарифи, потоки, розстрочки та залишки.",
  payment: "Повні, часткові та розстрочені платежі.", access: "Щомісячні доступи до сайту FRANKLIN за $49.",
  expense: "Реклама, сервіси, зарплати й витрати за джерелами.", task: "Дзвінки, доплати та нагадування для команди.",
  cohort: "Окремий облік кожного запуску та навчального потоку.", team: "Учасники, ролі та показники менеджерів.", split: "Розрахунок часток із чистого прибутку.",
};

const today = () => new Date().toISOString().slice(0, 10);
const nowMs = new Date().setHours(0, 0, 0, 0);
const addDays = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); };
const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount || 0);
const value = (data: Data, key: string) => String(data[key] ?? "");
const num = (data: Data, key: string) => Number(data[key] ?? 0);
const isArchived = (record: CrmRecord) => Boolean(record.data.archived);
const RECORDS_STORAGE_KEY = "franklin-crm-records";
const SETTINGS_STORAGE_KEY = "franklin-crm-settings";

function initialData(type: EditableType): Data {
  if (type === "lead") return { name: "", telegram: "", phone: "", source: "Telegram", status: "Новий", tariff: "Базовий", manager: "", cohortId: "", cohortName: "", nextContactDate: addDays(1), comment: "" };
  if (type === "student") return { name: "", telegram: "", phone: "", source: "Telegram", tariff: "Базовий", totalPrice: 290, startDate: today(), status: "Активний", manager: "", cohortId: "", cohortName: "", installments: 1, nextPaymentDate: "", nextPaymentAmount: 0, comment: "" };
  if (type === "payment") return { studentId: "", studentName: "", kind: "Навчання", amount: 290, date: today(), method: "USDT", comment: "" };
  if (type === "access") return { studentId: "", studentName: "", amount: 49, purchasedAt: today(), expiresAt: addDays(30), status: "Активний", comment: "" };
  if (type === "expense") return { category: "Реклама", source: "Telegram", amount: 0, date: today(), manager: "", cohortId: "", cohortName: "", comment: "" };
  if (type === "task") return { title: "", dueDate: today(), priority: "Середній", status: "Нове", assignee: "", relatedType: "Лід", relatedId: "", relatedName: "", comment: "" };
  if (type === "cohort") return { name: "", startDate: today(), endDate: addDays(45), status: "Планується", goal: 50, budget: 0, comment: "" };
  if (type === "team") return { name: "", email: "", role: "Менеджер", status: "Активний", comment: "" };
  return { name: "", percent: 0, role: "Власник", comment: "" };
}

export default function CRMApp({ user }: { user: { name: string; email: string } }) {
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [active, setActive] = useState<Section>("dashboard");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [detail, setDetail] = useState<CrmRecord | null>(null);
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("franklin-theme");
    const preferredTheme: Theme = savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = preferredTheme;
    document.documentElement.style.colorScheme = preferredTheme;
  }, []);

  useEffect(() => {
    try {
      setRecords(JSON.parse(window.localStorage.getItem(RECORDS_STORAGE_KEY) ?? "[]"));
      setSettings(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "{}"));
    } catch {
      notify("Локальні дані пошкоджені — CRM відкрито порожньою");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
  }, [loading, records]);

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2800); }

  function toggleTheme() {
    const nextTheme: Theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    window.localStorage.setItem("franklin-theme", nextTheme);
  }

  const groups = useMemo(() => {
    const result = Object.fromEntries(TYPES.map((type) => [type, []])) as Groups;
    records.filter((record) => !isArchived(record)).forEach((record) => result[record.type]?.push(record));
    return result;
  }, [records]);
  const archived = useMemo(() => records.filter(isArchived), [records]);
  const stats = useMemo(() => {
    const revenue = [...groups.payment, ...groups.access].reduce((sum, record) => sum + num(record.data, "amount"), 0);
    const expenses = groups.expense.reduce((sum, record) => sum + num(record.data, "amount"), 0);
    const expected = groups.student.reduce((sum, record) => sum + num(record.data, "totalPrice"), 0);
    const coursePaid = groups.payment.reduce((sum, record) => sum + num(record.data, "amount"), 0);
    const won = groups.lead.filter((record) => value(record.data, "status") === "Оплачено").length;
    return { revenue, expenses, profit: revenue - expenses, expected, balance: Math.max(0, expected - coursePaid), conversion: groups.lead.length ? Math.round(won / groups.lead.length * 100) : 0 };
  }, [groups]);

  async function saveRecord(type: EditableType, data: Data, id?: string) {
    setSaving(true);
    try {
      const timestamp = new Date().toISOString();
      const record: CrmRecord = id
        ? { ...(records.find((item) => item.id === id) as CrmRecord), data, updatedAt: timestamp }
        : { id: crypto.randomUUID(), type, data, createdBy: user.email, createdAt: timestamp, updatedAt: timestamp };
      setRecords((current) => id ? current.map((item) => item.id === id ? record : item) : [record, ...current]);
      setModal(null);
      notify(id ? "Запис оновлено" : "Запис додано");
      return record;
    } catch { notify("Помилка збереження"); return null; }
    finally { setSaving(false); }
  }

  async function archiveRecord(record: CrmRecord) {
    if (!window.confirm("Перемістити запис в архів? Його можна буде відновити.")) return;
    const updated = { ...record, data: { ...record.data, archived: true, archivedAt: new Date().toISOString(), archivedBy: user.email }, updatedAt: new Date().toISOString() };
    setRecords((current) => current.map((item) => item.id === record.id ? updated : item));
    notify("Переміщено в архів");
  }

  async function restoreRecord(record: CrmRecord) {
    const data = { ...record.data, archived: false, archivedAt: "", archivedBy: "" };
    const updated = { ...record, data, updatedAt: new Date().toISOString() };
    setRecords((current) => current.map((item) => item.id === record.id ? updated : item));
    notify("Запис відновлено");
  }

  async function convertLead(record: CrmRecord) {
    const updated = await saveRecord("lead", { ...record.data, status: "Оплачено" }, record.id);
    if (!updated) return;
    setModal({ type: "student", draft: { ...initialData("student"), name: value(record.data, "name"), telegram: value(record.data, "telegram"), phone: value(record.data, "phone"), source: value(record.data, "source"), tariff: value(record.data, "tariff"), totalPrice: PRICES[value(record.data, "tariff")] ?? 290, manager: value(record.data, "manager"), cohortId: value(record.data, "cohortId"), cohortName: value(record.data, "cohortName"), comment: value(record.data, "comment") } });
  }

  const quickType: EditableType = (["lead", "student", "task", "cohort", "payment", "access", "expense", "team", "split"] as Section[]).includes(active) ? active as EditableType : "lead";
  const title = NAV.find((item) => item.id === active)?.label ?? "FRANKLIN P2P";

  return <div className="crm-shell">
    <aside className={`sidebar ${menu ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark">F</div><div><strong>FRANKLIN</strong><span>P2P · CRM PRO</span></div></div>
      <nav>{NAV.map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => { setActive(item.id); setMenu(false); }}><span className="nav-icon">{item.icon}</span>{item.label}{item.id === "task" && groups.task.filter((record) => value(record.data, "status") !== "Готово").length > 0 && <em>{groups.task.filter((record) => value(record.data, "status") !== "Готово").length}</em>}</button>)}</nav>
      <div className="sidebar-card"><span className="live-dot" /><div><strong>CRM працює</strong><small>{records.length} записів у базі</small></div></div>
      <div className="profile"><div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div><div><strong>{user.name}</strong><small>Власник</small></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="header-left"><button className="menu-button" onClick={() => setMenu(!menu)}>☰</button><div><p>FRANKLIN P2P</p><h1>{title}</h1></div></div><div className="header-actions"><button className="theme-toggle" onClick={toggleTheme} aria-label="Перемкнути світлу або темну тему" title="Змінити тему"><span aria-hidden="true">☀</span><span aria-hidden="true">☾</span><i aria-hidden="true" /></button><label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Пошук..." /></label>{!["activity", "archive", "settings", "analytics"].includes(active) && <button className="primary" onClick={() => setModal({ type: quickType })}>＋ Додати</button>}</div></header>
      <div className="content">{loading ? <Loading /> : renderSection(active, { groups, archived, stats, search, settings, setSettings, setActive, setModal, setDetail, saveRecord, archiveRecord, restoreRecord, convertLead, notify })}</div>
    </main>
    {modal && <RecordModal modal={modal} groups={groups} saving={saving} onClose={() => setModal(null)} onSave={saveRecord} />}
    {detail && <StudentCard student={detail} groups={groups} onClose={() => setDetail(null)} onEdit={() => { setDetail(null); setModal({ type: "student", record: detail }); }} />}
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>;
}

type RenderProps = { groups: Groups; archived: CrmRecord[]; stats: Stats; search: string; settings: Record<string, string>; setSettings: (settings: Record<string, string>) => void; setActive: (section: Section) => void; setModal: (modal: ModalState) => void; setDetail: (record: CrmRecord) => void; saveRecord: (type: EditableType, data: Data, id?: string) => Promise<CrmRecord | null>; archiveRecord: (record: CrmRecord) => void; restoreRecord: (record: CrmRecord) => void; convertLead: (record: CrmRecord) => void; notify: (message: string) => void };
type Stats = { revenue: number; expenses: number; profit: number; expected: number; balance: number; conversion: number };

function renderSection(active: Section, props: RenderProps) {
  if (active === "dashboard") return <Dashboard {...props} />;
  if (active === "analytics") return <Analytics groups={props.groups} stats={props.stats} />;
  if (active === "activity") return <ActivityPage records={props.groups.activity} />;
  if (active === "archive") return <ArchivePage records={props.archived} onRestore={props.restoreRecord} />;
  if (active === "settings") return <Settings settings={props.settings} setSettings={props.setSettings} notify={props.notify} />;
  if (active === "team") return <TeamPage {...props} />;
  if (active === "split") return <SplitPage {...props} />;
  return <RecordsPage type={active} records={props.groups[active]} groups={props.groups} search={props.search} onAdd={() => props.setModal({ type: active })} onEdit={(record) => props.setModal({ type: active, record })} onArchive={props.archiveRecord} onConvert={props.convertLead} onDetail={props.setDetail} />;
}

function Loading() { return <div className="loading"><div className="spinner" /><p>Завантажуємо CRM…</p></div>; }

function Dashboard({ groups, stats, setActive, setModal, setDetail }: RenderProps) {
  const overdueTasks = groups.task.filter((record) => value(record.data, "status") !== "Готово" && new Date(value(record.data, "dueDate")).getTime() <= nowMs);
  const expiring = groups.access.filter((record) => { const days = (new Date(value(record.data, "expiresAt")).getTime() - nowMs) / 86400000; return days >= 0 && days <= 7; });
  const dueStudents = groups.student.filter((record) => value(record.data, "nextPaymentDate") && new Date(value(record.data, "nextPaymentDate")).getTime() <= nowMs + 3 * 86400000);
  return <>
    <section className="welcome"><div><span>ЦЕНТР УПРАВЛІННЯ</span><h2>Все під контролем.</h2><p>Продажі, навчання, команда й фінанси FRANKLIN в одній системі.</p></div><button onClick={() => setModal({ type: "lead" })}>＋ Новий лід</button></section>
    <section className="metric-grid"><Metric label="Загальний дохід" amount={money(stats.revenue)} note="Навчання + доступи" color="green" icon="$" /><Metric label="Чистий прибуток" amount={money(stats.profit)} note={`${money(stats.expenses)} витрат`} color="gold" icon="↗" /><Metric label="Ліди" amount={String(groups.lead.length)} note={`${stats.conversion}% конверсія`} color="blue" icon="◎" /><Metric label="Борги учнів" amount={money(stats.balance)} note={`${dueStudents.length} найближчих оплат`} color="violet" icon="…" /></section>
    <section className="dashboard-grid"><article className="panel funnel-panel"><PanelHead title="Воронка продажів" subtitle="Поточний стан лідів" action="Усі ліди" onAction={() => setActive("lead")} /><Funnel leads={groups.lead} /></article><article className="panel plan-panel"><PanelHead title="Продажі за тарифами" subtitle="Учні в кожному пакеті" />{Object.entries(PRICES).map(([plan, price]) => <div className="plan-row" key={plan}><div className={`plan-dot ${plan === "PRO" ? "gold" : plan === "Індивідуальний" ? "violet" : "green"}`} /><div><strong>{plan}</strong><span>{money(price)}</span></div><b>{groups.student.filter((record) => value(record.data, "tariff") === plan).length}</b></div>)}<div className="plan-total"><span>Активних потоків</span><strong>{groups.cohort.filter((record) => value(record.data, "status") === "Активний").length}</strong></div></article></section>
    <section className="dashboard-grid lower"><article className="panel"><PanelHead title="Найближчі завдання" subtitle="Що потрібно зробити команді" action="Усі завдання" onAction={() => setActive("task")} />{overdueTasks.length ? <div className="compact-table">{overdueTasks.slice(0, 5).map((record) => <button key={record.id} onClick={() => setModal({ type: "task", record })}><div className="person-avatar">!</div><div><strong>{value(record.data, "title")}</strong><small>{value(record.data, "assignee") || "Без виконавця"} · {value(record.data, "dueDate")}</small></div><Status text={value(record.data, "priority")} /></button>)}</div> : <Empty mini text="Прострочених завдань немає" />}</article><article className="panel reminders"><PanelHead title="Потребує уваги" subtitle="Доплати й доступи" />{[...dueStudents, ...expiring].slice(0, 5).map((record) => <button key={record.id} onClick={() => record.type === "student" ? setDetail(record) : setModal({ type: "access", record })}><span className="warn">!</span><div><strong>{value(record.data, "name") || value(record.data, "studentName")}</strong><small>{record.type === "student" ? `Доплата ${value(record.data, "nextPaymentDate")}` : `Доступ до ${value(record.data, "expiresAt")}`}</small></div><b>{record.type === "student" ? money(num(record.data, "nextPaymentAmount")) : "$49"}</b></button>)}{!dueStudents.length && !expiring.length && <Empty mini text="Немає термінових нагадувань" />}</article></section>
  </>;
}

function Metric({ label, amount, note, color, icon }: { label: string; amount: string; note: string; color: string; icon: string }) { return <article className="metric"><div className={`metric-icon ${color}`}>{icon}</div><div><span>{label}</span><strong>{amount}</strong><small>{note}</small></div></article>; }
function PanelHead({ title, subtitle, action, onAction }: { title: string; subtitle: string; action?: string; onAction?: () => void }) { return <div className="panel-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{action && <button onClick={onAction}>{action} →</button>}</div>; }
function Funnel({ leads }: { leads: CrmRecord[] }) { const stages = ["Новий", "Контакт", "Думає", "Рахунок", "Оплачено"]; return <div className="funnel">{stages.map((stage, index) => { const count = leads.filter((record) => value(record.data, "status") === stage).length; const width = leads.length ? Math.max(9, count / leads.length * 100) : 8; return <div className="funnel-row" key={stage}><span>{stage}</span><div><i style={{ width: `${width}%` }} /></div><strong>{count}</strong><small>{index === 0 ? "100%" : leads.length ? `${Math.round(count / leads.length * 100)}%` : "0%"}</small></div>; })}</div>; }

function RecordsPage({ type, records, groups, search, onAdd, onEdit, onArchive, onConvert, onDetail }: { type: EditableType; records: CrmRecord[]; groups: Groups; search: string; onAdd: () => void; onEdit: (record: CrmRecord) => void; onArchive: (record: CrmRecord) => void; onConvert: (record: CrmRecord) => void; onDetail: (record: CrmRecord) => void }) {
  const filtered = records.filter((record) => JSON.stringify(record.data).toLowerCase().includes(search.toLowerCase()));
  return <><section className="page-intro"><div><span>{filtered.length} ЗАПИСІВ</span><h2>{NAV.find((item) => item.id === type)?.label}</h2><p>{DESCRIPTIONS[type]}</p></div><button onClick={onAdd}>＋ Додати {TITLES[type]}</button></section><article className="panel records-panel">{filtered.length ? <div className="table-wrap"><table><thead><tr>{headersFor(type).map((header) => <th key={header}>{header}</th>)}<th /></tr></thead><tbody>{filtered.map((record) => <RecordRow key={record.id} record={record} groups={groups} onEdit={onEdit} onArchive={onArchive} onConvert={onConvert} onDetail={onDetail} />)}</tbody></table></div> : <Empty text={search ? "За цим запитом нічого не знайдено" : "Поки немає записів"} action={onAdd} />}</article></>;
}

function headersFor(type: EditableType) {
  if (type === "lead") return ["Лід", "Джерело", "Потік", "Тариф", "Статус", "Менеджер"];
  if (type === "student") return ["Учень", "Потік", "Тариф", "Оплачено", "Залишок", "Статус"];
  if (type === "payment") return ["Учень", "Тип", "Сума", "Дата", "Метод"];
  if (type === "access") return ["Учень", "Оплата", "Початок", "Закінчення", "Статус"];
  if (type === "expense") return ["Категорія", "Джерело", "Сума", "Дата", "Потік"];
  if (type === "task") return ["Завдання", "Пов’язано", "Виконавець", "Дедлайн", "Статус"];
  if (type === "cohort") return ["Потік", "Учні", "Каса", "Витрати", "Результат", "Статус"];
  if (type === "team") return ["Учасник", "Email", "Роль", "Статус"];
  return ["Учасник", "Роль", "Частка"];
}

function RecordRow({ record, groups, onEdit, onArchive, onConvert, onDetail }: { record: CrmRecord; groups: Groups; onEdit: (record: CrmRecord) => void; onArchive: (record: CrmRecord) => void; onConvert: (record: CrmRecord) => void; onDetail: (record: CrmRecord) => void }) {
  const d = record.data;
  const paid = record.type === "student" ? groups.payment.filter((p) => value(p.data, "studentId") === record.id).reduce((sum, p) => sum + num(p.data, "amount"), 0) : 0;
  const person = (name: string, clickable = false) => <button className={`person ${clickable ? "person-link" : ""}`} onClick={() => clickable && onDetail(record)}><div className="person-avatar">{name.slice(0, 1) || "?"}</div><div><strong>{name || "Без імені"}</strong><small>{value(d, "telegram") || value(d, "phone") || "—"}</small></div></button>;
  return <tr>
    {record.type === "lead" && <><td>{person(value(d, "name"))}</td><td>{value(d, "source")}</td><td>{value(d, "cohortName") || "—"}</td><td><Plan text={value(d, "tariff")} /></td><td><Status text={value(d, "status")} /></td><td>{value(d, "manager") || "—"}</td></>}
    {record.type === "student" && <><td>{person(value(d, "name"), true)}</td><td>{value(d, "cohortName") || "—"}</td><td><Plan text={value(d, "tariff")} /></td><td className="money positive">{money(paid)}</td><td className="money negative">{money(Math.max(0, num(d, "totalPrice") - paid))}</td><td><Status text={value(d, "status")} /></td></>}
    {record.type === "payment" && <><td>{person(value(d, "studentName"))}</td><td>{value(d, "kind")}</td><td className="money positive">+{money(num(d, "amount"))}</td><td>{value(d, "date")}</td><td>{value(d, "method")}</td></>}
    {record.type === "access" && <><td>{person(value(d, "studentName"))}</td><td className="money positive">+{money(num(d, "amount"))}</td><td>{value(d, "purchasedAt")}</td><td>{value(d, "expiresAt")}</td><td><Status text={new Date(value(d, "expiresAt")).getTime() < nowMs ? "Закінчився" : value(d, "status")} /></td></>}
    {record.type === "expense" && <><td><Plan text={value(d, "category")} /></td><td>{value(d, "source") || "—"}</td><td className="money negative">−{money(num(d, "amount"))}</td><td>{value(d, "date")}</td><td>{value(d, "cohortName") || "—"}</td></>}
    {record.type === "task" && <><td><strong>{value(d, "title")}</strong></td><td>{value(d, "relatedName") || "—"}</td><td>{value(d, "assignee") || "—"}</td><td className={new Date(value(d, "dueDate")).getTime() < nowMs && value(d, "status") !== "Готово" ? "overdue" : ""}>{value(d, "dueDate")}</td><td><Status text={value(d, "status")} /></td></>}
    {record.type === "cohort" && (() => { const students = groups.student.filter((item) => value(item.data, "cohortId") === record.id); const ids = students.map((item) => item.id); const revenue = groups.payment.filter((item) => ids.includes(value(item.data, "studentId"))).reduce((sum, item) => sum + num(item.data, "amount"), 0); const expenses = groups.expense.filter((item) => value(item.data, "cohortId") === record.id).reduce((sum, item) => sum + num(item.data, "amount"), 0); return <><td><strong>{value(d, "name")}</strong><small className="table-sub">{value(d, "startDate")} → {value(d, "endDate")}</small></td><td>{students.length} / {num(d, "goal")}</td><td className="money positive">{money(revenue)}</td><td className="money negative">{money(expenses)}</td><td className="money">{money(revenue - expenses)}</td><td><Status text={value(d, "status")} /></td></>; })()}
    {record.type === "team" && <><td>{person(value(d, "name"))}</td><td>{value(d, "email") || "—"}</td><td>{value(d, "role")}</td><td><Status text={value(d, "status")} /></td></>}
    {record.type === "split" && <><td>{person(value(d, "name"))}</td><td>{value(d, "role")}</td><td className="money positive">{num(d, "percent")}%</td></>}
    <td><div className="row-actions">{record.type === "lead" && value(d, "status") !== "Оплачено" && <button title="Перевести в учні" onClick={() => onConvert(record)}>✓</button>}<button title="Редагувати" onClick={() => onEdit(record)}>✎</button><button className="delete" title="В архів" onClick={() => onArchive(record)}>□</button></div></td>
  </tr>;
}

function Status({ text }: { text: string }) { const slug = ["Оплачено", "Активний", "Готово", "Завершено"].includes(text) ? "success" : ["Прострочено", "Закінчився", "Втрачено", "Заблокований"].includes(text) ? "danger" : ["Думає", "Рахунок", "Пауза", "Високий"].includes(text) ? "warning" : "neutral"; return <span className={`status ${slug}`}><i />{text || "—"}</span>; }
function Plan({ text }: { text: string }) { return <span className={`plan ${text === "PRO" ? "gold" : text === "Індивідуальний" ? "violet" : ""}`}>{text || "—"}</span>; }
function Empty({ text, action, mini = false }: { text: string; action?: () => void; mini?: boolean }) { return <div className={`empty ${mini ? "mini" : ""}`}><div>＋</div><strong>{text}</strong>{action && <button onClick={action}>Додати перший запис</button>}</div>; }

function RecordModal({ modal, groups, saving, onClose, onSave }: { modal: ModalState; groups: Groups; saving: boolean; onClose: () => void; onSave: (type: EditableType, data: Data, id?: string) => void }) {
  const { type, record, draft } = modal;
  const [data, setData] = useState<Data>(record?.data ?? draft ?? initialData(type));
  const set = (key: string, next: string | number | boolean) => setData((current) => ({ ...current, [key]: next }));
  const pick = (key: string, id: string, items: CrmRecord[], nameKey = "name") => { const item = items.find((entry) => entry.id === id); setData((current) => ({ ...current, [key]: id, [`${key.replace("Id", "")}Name`]: item ? value(item.data, nameKey) : "" })); };
  const submit = (event: FormEvent) => { event.preventDefault(); onSave(type, data, record?.id); };
  const tariff = (next: string) => setData((current) => ({ ...current, tariff: next, ...(type === "student" ? { totalPrice: PRICES[next] } : {}) }));
  const studentSelect = <Field label="Учень *"><select required value={value(data, "studentId")} onChange={(e) => pick("studentId", e.target.value, groups.student)}><option value="">Оберіть учня</option>{groups.student.map((student) => <option key={student.id} value={student.id}>{value(student.data, "name")} · {value(student.data, "tariff")}</option>)}</select></Field>;
  const cohortSelect = <Field label="Потік"><select value={value(data, "cohortId")} onChange={(e) => pick("cohortId", e.target.value, groups.cohort)}><option value="">Без потоку</option>{groups.cohort.map((cohort) => <option key={cohort.id} value={cohort.id}>{value(cohort.data, "name")}</option>)}</select></Field>;
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="modal" onSubmit={submit}><div className="modal-head"><div><span>{record ? "РЕДАГУВАННЯ" : "НОВИЙ ЗАПИС"}</span><h2>{record ? "Редагувати" : "Додати"} {TITLES[type]}</h2></div><button type="button" onClick={onClose}>×</button></div><div className="form-grid">
    {type === "lead" && <><Field label="Ім’я та прізвище *"><input required value={value(data, "name")} onChange={(e) => set("name", e.target.value)} /></Field><Field label="Telegram"><input value={value(data, "telegram")} onChange={(e) => set("telegram", e.target.value)} placeholder="@username" /></Field><Field label="Телефон"><input value={value(data, "phone")} onChange={(e) => set("phone", e.target.value)} /></Field><Field label="Джерело"><Select value={value(data, "source")} onChange={(e) => set("source", e.target.value)} options={["Telegram", "Instagram", "Facebook", "Рекомендація", "YouTube", "Інше"]} /></Field><Field label="Тариф"><Select value={value(data, "tariff")} onChange={(e) => tariff(e.target.value)} options={Object.keys(PRICES)} /></Field><Field label="Етап продажу"><Select value={value(data, "status")} onChange={(e) => set("status", e.target.value)} options={["Новий", "Контакт", "Думає", "Рахунок", "Оплачено", "Втрачено"]} /></Field>{cohortSelect}<Field label="Наступний контакт"><input type="date" value={value(data, "nextContactDate")} onChange={(e) => set("nextContactDate", e.target.value)} /></Field><Field label="Менеджер"><input value={value(data, "manager")} onChange={(e) => set("manager", e.target.value)} /></Field></>}
    {type === "student" && <><Field label="Ім’я та прізвище *"><input required value={value(data, "name")} onChange={(e) => set("name", e.target.value)} /></Field><Field label="Telegram"><input value={value(data, "telegram")} onChange={(e) => set("telegram", e.target.value)} /></Field><Field label="Телефон"><input value={value(data, "phone")} onChange={(e) => set("phone", e.target.value)} /></Field><Field label="Джерело"><Select value={value(data, "source")} onChange={(e) => set("source", e.target.value)} options={["Telegram", "Instagram", "Facebook", "Рекомендація", "YouTube", "Інше"]} /></Field><Field label="Тариф"><Select value={value(data, "tariff")} onChange={(e) => tariff(e.target.value)} options={Object.keys(PRICES)} /></Field><Field label="Повна вартість, $"><input type="number" value={num(data, "totalPrice")} onChange={(e) => set("totalPrice", Number(e.target.value))} /></Field>{cohortSelect}<Field label="Дата старту"><input type="date" value={value(data, "startDate")} onChange={(e) => set("startDate", e.target.value)} /></Field><Field label="Кількість платежів"><input type="number" min="1" max="12" value={num(data, "installments")} onChange={(e) => set("installments", Number(e.target.value))} /></Field><Field label="Наступна оплата"><input type="date" value={value(data, "nextPaymentDate")} onChange={(e) => set("nextPaymentDate", e.target.value)} /></Field><Field label="Сума наступної оплати, $"><input type="number" min="0" value={num(data, "nextPaymentAmount")} onChange={(e) => set("nextPaymentAmount", Number(e.target.value))} /></Field><Field label="Статус"><Select value={value(data, "status")} onChange={(e) => set("status", e.target.value)} options={["Активний", "Завершив", "Пауза", "Повернення"]} /></Field><Field label="Менеджер"><input value={value(data, "manager")} onChange={(e) => set("manager", e.target.value)} /></Field></>}
    {type === "payment" && <>{studentSelect}<Field label="Тип оплати"><Select value={value(data, "kind")} onChange={(e) => set("kind", e.target.value)} options={["Навчання", "Часткова оплата", "Розстрочка", "Доплата", "Інше"]} /></Field><Field label="Сума, $ *"><input required type="number" value={num(data, "amount")} onChange={(e) => set("amount", Number(e.target.value))} /></Field><Field label="Дата"><input type="date" value={value(data, "date")} onChange={(e) => set("date", e.target.value)} /></Field><Field label="Метод"><Select value={value(data, "method")} onChange={(e) => set("method", e.target.value)} options={["USDT", "Карта", "Готівка", "Інше"]} /></Field></>}
    {type === "access" && <>{studentSelect}<Field label="Оплата, $"><input type="number" value={num(data, "amount")} onChange={(e) => set("amount", Number(e.target.value))} /></Field><Field label="Дата оплати"><input type="date" value={value(data, "purchasedAt")} onChange={(e) => set("purchasedAt", e.target.value)} /></Field><Field label="Доступ до"><input type="date" value={value(data, "expiresAt")} onChange={(e) => set("expiresAt", e.target.value)} /></Field><Field label="Статус"><Select value={value(data, "status")} onChange={(e) => set("status", e.target.value)} options={["Активний", "Очікує оплату", "Закінчився"]} /></Field></>}
    {type === "expense" && <><Field label="Категорія"><Select value={value(data, "category")} onChange={(e) => set("category", e.target.value)} options={["Реклама", "Зарплата", "Сервіси", "Повернення", "Комісії", "Інше"]} /></Field><Field label="Джерело"><Select value={value(data, "source")} onChange={(e) => set("source", e.target.value)} options={["Telegram", "Instagram", "Facebook", "YouTube", "Загальні", "Інше"]} /></Field><Field label="Сума, $ *"><input required type="number" value={num(data, "amount")} onChange={(e) => set("amount", Number(e.target.value))} /></Field><Field label="Дата"><input type="date" value={value(data, "date")} onChange={(e) => set("date", e.target.value)} /></Field>{cohortSelect}<Field label="Відповідальний"><input value={value(data, "manager")} onChange={(e) => set("manager", e.target.value)} /></Field></>}
    {type === "task" && <><Field label="Назва завдання *" full><input required value={value(data, "title")} onChange={(e) => set("title", e.target.value)} placeholder="Написати ліду / нагадати про оплату" /></Field><Field label="Пов’язано з"><Select value={value(data, "relatedType")} onChange={(e) => set("relatedType", e.target.value)} options={["Лід", "Учень", "Інше"]} /></Field><Field label="Ім’я / об’єкт"><input value={value(data, "relatedName")} onChange={(e) => set("relatedName", e.target.value)} /></Field><Field label="Виконавець"><input value={value(data, "assignee")} onChange={(e) => set("assignee", e.target.value)} /></Field><Field label="Дедлайн"><input type="date" value={value(data, "dueDate")} onChange={(e) => set("dueDate", e.target.value)} /></Field><Field label="Пріоритет"><Select value={value(data, "priority")} onChange={(e) => set("priority", e.target.value)} options={["Низький", "Середній", "Високий"]} /></Field><Field label="Статус"><Select value={value(data, "status")} onChange={(e) => set("status", e.target.value)} options={["Нове", "В роботі", "Готово"]} /></Field></>}
    {type === "cohort" && <><Field label="Назва потоку *"><input required value={value(data, "name")} onChange={(e) => set("name", e.target.value)} placeholder="Потік — вересень 2026" /></Field><Field label="Статус"><Select value={value(data, "status")} onChange={(e) => set("status", e.target.value)} options={["Планується", "Активний", "Завершено"]} /></Field><Field label="Дата старту"><input type="date" value={value(data, "startDate")} onChange={(e) => set("startDate", e.target.value)} /></Field><Field label="Дата завершення"><input type="date" value={value(data, "endDate")} onChange={(e) => set("endDate", e.target.value)} /></Field><Field label="Ціль учнів"><input type="number" value={num(data, "goal")} onChange={(e) => set("goal", Number(e.target.value))} /></Field><Field label="Бюджет, $"><input type="number" value={num(data, "budget")} onChange={(e) => set("budget", Number(e.target.value))} /></Field></>}
    {type === "team" && <><Field label="Ім’я *"><input required value={value(data, "name")} onChange={(e) => set("name", e.target.value)} /></Field><Field label="Email"><input type="email" value={value(data, "email")} onChange={(e) => set("email", e.target.value)} /></Field><Field label="Роль"><Select value={value(data, "role")} onChange={(e) => set("role", e.target.value)} options={["Власник", "Менеджер", "Куратор", "Фінансист"]} /></Field><Field label="Статус"><Select value={value(data, "status")} onChange={(e) => set("status", e.target.value)} options={["Активний", "Пауза", "Заблокований"]} /></Field></>}
    {type === "split" && <><Field label="Учасник *"><input required value={value(data, "name")} onChange={(e) => set("name", e.target.value)} /></Field><Field label="Роль"><input value={value(data, "role")} onChange={(e) => set("role", e.target.value)} /></Field><Field label="Частка, %"><input type="number" min="0" max="100" value={num(data, "percent")} onChange={(e) => set("percent", Number(e.target.value))} /></Field></>}
    <Field label="Коментар" full><textarea value={value(data, "comment")} onChange={(e) => set("comment", e.target.value)} /></Field>
  </div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Скасувати</button><button className="primary" disabled={saving}>{saving ? "Зберігаємо…" : "Зберегти запис"}</button></div></form></div>;
}

function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) { return <label className={`field ${full ? "full" : ""}`}><span>{label}</span>{children}</label>; }
function Select({ options, ...props }: { options: string[] } & SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props}>{options.map((option) => <option key={option}>{option}</option>)}</select>; }

function StudentCard({ student, groups, onClose, onEdit }: { student: CrmRecord; groups: Groups; onClose: () => void; onEdit: () => void }) {
  const payments = groups.payment.filter((record) => value(record.data, "studentId") === student.id);
  const accesses = groups.access.filter((record) => value(record.data, "studentId") === student.id);
  const tasks = groups.task.filter((record) => value(record.data, "relatedName") === value(student.data, "name"));
  const paid = payments.reduce((sum, record) => sum + num(record.data, "amount"), 0); const total = num(student.data, "totalPrice"); const progress = total ? Math.min(100, paid / total * 100) : 0;
  const installmentCount = Math.max(1, num(student.data, "installments"));
  const installmentAmount = total / installmentCount;
  const installments = Array.from({ length: installmentCount }, (_, index) => { const date = new Date(value(student.data, "startDate") || today()); date.setMonth(date.getMonth() + index); return { number: index + 1, date: date.toISOString().slice(0, 10), amount: installmentAmount, paid: paid >= installmentAmount * (index + 1) }; });
  return <div className="modal-backdrop"><div className="student-card"><div className="student-hero"><div className="student-avatar">{value(student.data, "name").slice(0, 1)}</div><div><span>КАРТКА УЧНЯ</span><h2>{value(student.data, "name")}</h2><p>{value(student.data, "telegram")} · {value(student.data, "phone")}</p></div><button onClick={onClose}>×</button></div><div className="student-card-body"><div className="student-summary"><div><span>Тариф</span><strong>{value(student.data, "tariff")}</strong></div><div><span>Потік</span><strong>{value(student.data, "cohortName") || "—"}</strong></div><div><span>Менеджер</span><strong>{value(student.data, "manager") || "—"}</strong></div><div><span>Статус</span><Status text={value(student.data, "status")} /></div></div><div className="payment-progress"><div><span>Оплачено {money(paid)} із {money(total)}</span><strong>{money(Math.max(0, total - paid))} залишок</strong></div><div><i style={{ width: `${progress}%` }} /></div><small>Наступна оплата: {value(student.data, "nextPaymentDate") || "не встановлено"} · {money(num(student.data, "nextPaymentAmount"))}</small></div><div className="installment-plan"><h3>Графік розстрочки</h3><div>{installments.map((item) => <p key={item.number} className={item.paid ? "paid" : ""}><span>{item.paid ? "✓" : item.number}</span><b>{item.date}</b><em>{money(item.amount)}</em><small>{item.paid ? "Оплачено" : "Очікується"}</small></p>)}</div></div><div className="student-columns"><section><h3>Історія оплат</h3>{payments.length ? payments.map((record) => <p key={record.id}><span>{value(record.data, "date")} · {value(record.data, "kind")}</span><b>+{money(num(record.data, "amount"))}</b></p>) : <small>Оплат ще немає</small>}</section><section><h3>Доступи й завдання</h3>{accesses.map((record) => <p key={record.id}><span>Доступ до {value(record.data, "expiresAt")}</span><b>$49</b></p>)}{tasks.map((record) => <p key={record.id}><span>{value(record.data, "title")}</span><Status text={value(record.data, "status")} /></p>)}{!accesses.length && !tasks.length && <small>Записів ще немає</small>}</section></div></div><div className="modal-actions"><button className="secondary" onClick={onClose}>Закрити</button><button className="primary" onClick={onEdit}>Редагувати учня</button></div></div></div>;
}

function TeamPage(props: RenderProps) {
  const managers = props.groups.team;
  return <><section className="page-intro"><div><span>КОМАНДА FRANKLIN</span><h2>Менеджери та результати</h2><p>Ліди, продажі, конверсія й дохід кожного.</p></div><button onClick={() => props.setModal({ type: "team" })}>＋ Додати учасника</button></section><section className="manager-grid">{managers.map((manager) => { const name = value(manager.data, "name"); const leads = props.groups.lead.filter((record) => value(record.data, "manager") === name); const students = props.groups.student.filter((record) => value(record.data, "manager") === name); const studentIds = students.map((record) => record.id); const revenue = props.groups.payment.filter((record) => studentIds.includes(value(record.data, "studentId"))).reduce((sum, record) => sum + num(record.data, "amount"), 0); return <article className="panel manager-card" key={manager.id}><div className="person-avatar">{name.slice(0, 1)}</div><div><h3>{name}</h3><span>{value(manager.data, "role")}</span></div><dl><div><dt>Лідів</dt><dd>{leads.length}</dd></div><div><dt>Продажів</dt><dd>{students.length}</dd></div><div><dt>Конверсія</dt><dd>{leads.length ? Math.round(students.length / leads.length * 100) : 0}%</dd></div><div><dt>Дохід</dt><dd>{money(revenue)}</dd></div></dl><button onClick={() => props.setModal({ type: "team", record: manager })}>Редагувати</button></article>; })}{!managers.length && <article className="panel"><Empty text="Додай учасників команди — статистика з’явиться автоматично" action={() => props.setModal({ type: "team" })} /></article>}</section></>;
}

function SplitPage(props: RenderProps) {
  const total = props.groups.split.reduce((sum, record) => sum + num(record.data, "percent"), 0);
  return <><section className="page-intro"><div><span>ФІНАНСИ КОМАНДИ</span><h2>Розподіл прибутку</h2><p>Чистий прибуток автоматично ділиться за встановленими частками.</p></div><button onClick={() => props.setModal({ type: "split" })}>＋ Додати частку</button></section><section className="split-layout"><article className="panel split-total"><span>Чистий прибуток</span><strong>{money(props.stats.profit)}</strong><small className={total === 100 ? "ok" : "bad"}>Сума часток: {total}% {total === 100 ? "✓" : "— потрібно 100%"}</small></article><article className="panel split-list">{props.groups.split.map((record) => <div key={record.id}><div className="person-avatar">{value(record.data, "name").slice(0, 1)}</div><p><strong>{value(record.data, "name")}</strong><span>{value(record.data, "role")}</span></p><b>{num(record.data, "percent")}%</b><em>{money(Math.max(0, props.stats.profit) * num(record.data, "percent") / 100)}</em><button onClick={() => props.setModal({ type: "split", record })}>✎</button></div>)}{!props.groups.split.length && <Empty mini text="Додай учасників та їхні відсотки" />}</article></section></>;
}

function Analytics({ groups, stats }: { groups: Groups; stats: Stats }) {
  const sources = ["Telegram", "Instagram", "Facebook", "Рекомендація", "YouTube", "Інше"];
  const sourceRows = sources.map((source) => { const students = groups.student.filter((record) => value(record.data, "source") === source); const ids = students.map((record) => record.id); const revenue = groups.payment.filter((record) => ids.includes(value(record.data, "studentId"))).reduce((sum, record) => sum + num(record.data, "amount"), 0); const spend = groups.expense.filter((record) => value(record.data, "source") === source).reduce((sum, record) => sum + num(record.data, "amount"), 0); const leads = groups.lead.filter((record) => value(record.data, "source") === source).length; return { source, leads, sales: students.length, revenue, spend, roi: spend ? Math.round((revenue - spend) / spend * 100) : revenue ? 100 : 0 }; }).filter((row) => row.leads || row.sales || row.spend);
  return <><section className="page-intro"><div><span>ФІНАНСОВИЙ ЗРІЗ</span><h2>Аналітика FRANKLIN</h2><p>Продажі, ROI джерел, конверсія та структура продукту.</p></div></section><section className="metric-grid"><Metric label="Отримано" amount={money(stats.revenue)} note={`План ${money(stats.expected)}`} color="green" icon="$" /><Metric label="Залишок оплат" amount={money(stats.balance)} note="Розстрочки й доплати" color="gold" icon="…" /><Metric label="Витрати" amount={money(stats.expenses)} note="Усі категорії" color="blue" icon="−" /><Metric label="Маржинальність" amount={stats.revenue ? `${Math.round(stats.profit / stats.revenue * 100)}%` : "0%"} note={`Чистими ${money(stats.profit)}`} color="violet" icon="↗" /></section><article className="panel roi-table"><PanelHead title="ROI за джерелами" subtitle="Який канал реально приносить гроші" />{sourceRows.length ? <div className="table-wrap"><table><thead><tr><th>Джерело</th><th>Ліди</th><th>Продажі</th><th>Дохід</th><th>Витрати</th><th>ROI</th></tr></thead><tbody>{sourceRows.map((row) => <tr key={row.source}><td><Plan text={row.source} /></td><td>{row.leads}</td><td>{row.sales}</td><td className="money positive">{money(row.revenue)}</td><td className="money negative">{money(row.spend)}</td><td><Status text={`${row.roi}%`} /></td></tr>)}</tbody></table></div> : <Empty mini text="Додай джерела лідів і рекламні витрати — ROI порахується автоматично" />}</article></>;
}

function ActivityPage({ records }: { records: CrmRecord[] }) { return <><section className="page-intro"><div><span>ПОВНИЙ КОНТРОЛЬ</span><h2>Журнал дій</h2><p>Хто, коли й що змінив у CRM.</p></div></section><article className="panel activity-list">{records.length ? records.map((record) => <div key={record.id}><span className="activity-dot" /><div><strong>{value(record.data, "action")}: {value(record.data, "label")}</strong><p>{value(record.data, "entityType")} · {new Date(record.createdAt).toLocaleString("uk-UA")}</p></div><small>{record.createdBy}</small></div>) : <Empty text="Дії з’являться після наступних змін у CRM" />}</article></>;
}

function ArchivePage({ records, onRestore }: { records: CrmRecord[]; onRestore: (record: CrmRecord) => void }) { return <><section className="page-intro"><div><span>БЕЗПЕЧНЕ ВИДАЛЕННЯ</span><h2>Архів</h2><p>Записи не губляться — їх можна повернути в один клік.</p></div></section><article className="panel archive-list">{records.length ? records.map((record) => <div key={record.id}><div className="person-avatar">□</div><p><strong>{value(record.data, "name") || value(record.data, "studentName") || value(record.data, "title") || value(record.data, "category")}</strong><span>{NAV.find((item) => item.id === record.type)?.label} · {String(record.data.archivedAt ?? "")}</span></p><button className="secondary" onClick={() => onRestore(record)}>↻ Відновити</button></div>) : <Empty text="Архів порожній" />}</article></>;
}

const APPS_SCRIPT = `function doPost(e){const p=JSON.parse(e.postData.contents),b=SpreadsheetApp.getActiveSpreadsheet(),n={lead:'Ліди',student:'Учні',payment:'Оплати',access:'Доступи $49',expense:'Витрати',task:'Завдання',cohort:'Потоки',team:'Команда',split:'Частки',activity:'Журнал'};const rows=p.action==='sync_all'?p.records:[p.record].filter(Boolean);if(p.action==='sync_all')Object.values(n).forEach(x=>{const s=b.getSheetByName(x);if(s)s.clear()});rows.forEach(r=>{const s=b.getSheetByName(n[r.type])||b.insertSheet(n[r.type]),f={ID:r.id,Створено:r.createdAt,Оновлено:r.updatedAt,...r.data};let h=s.getLastRow()?s.getRange(1,1,1,Math.max(1,s.getLastColumn())).getValues()[0]:[];Object.keys(f).forEach(k=>{if(!h.includes(k))h.push(k)});s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);const ids=s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,1).getValues().flat():[],i=ids.indexOf(r.id),row=i>=0?i+2:s.getLastRow()+1;s.getRange(row,1,1,h.length).setValues([h.map(k=>f[k]??'')])});return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON)}`;

function Settings({ settings, setSettings, notify }: { settings: Record<string, string>; setSettings: (settings: Record<string, string>) => void; notify: (message: string) => void }) {
  const [form, setForm] = useState({ googleSheetsUrl: settings.googleSheetsUrl ?? "", telegramBotToken: settings.telegramBotToken ?? "", telegramChatId: settings.telegramChatId ?? "", leadReminderHours: settings.leadReminderHours ?? "24", paymentReminderDays: settings.paymentReminderDays ?? "3", accessReminderDays: settings.accessReminderDays ?? "3" });
  const [saving, setSaving] = useState(false);
  const set = (key: string, next: string) => setForm((current) => ({ ...current, [key]: next }));
  async function save() { setSaving(true); const next = { ...settings, ...form }; window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next)); setSettings(next); setSaving(false); notify("Налаштування збережено"); }
  async function testTelegram() { const response = await fetch("/api/telegram", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "test" }) }); notify(response.ok ? "Тестове повідомлення надіслано" : "Перевір токен і Chat ID"); }
  async function reminders() { const response = await fetch("/api/telegram", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reminders" }) }); const result = await response.json(); notify(response.ok ? result.count ? `Надіслано ${result.count} нагадувань` : "Термінових нагадувань немає" : "Telegram не підключено"); }
  async function sync() { const response = await fetch("/api/sync", { method: "POST" }); notify(response.ok ? "Google Таблицю синхронізовано" : "Помилка синхронізації"); }
  async function copyScript() { await navigator.clipboard.writeText(APPS_SCRIPT); notify("Код скопійовано"); }
  return <><section className="page-intro"><div><span>КЕРУВАННЯ CRM</span><h2>Налаштування</h2><p>Інтеграції та правила нагадувань змінюються без програміста.</p></div><button onClick={save}>{saving ? "Зберігаємо…" : "Зберегти все"}</button></section><section className="settings-grid advanced"><article className="panel settings-card"><div className="settings-icon green">▦</div><h3>Google Таблиця</h3><p>Автоматична резервна копія всіх розділів CRM.</p><button className="code-button" onClick={copyScript}>▣ Скопіювати Apps Script</button><Field label="URL вебзастосунку" full><input value={form.googleSheetsUrl} onChange={(e) => set("googleSheetsUrl", e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" /></Field><div className="settings-actions"><button className="secondary" onClick={sync} disabled={!form.googleSheetsUrl}>Синхронізувати все</button></div></article><article className="panel settings-card"><div className="settings-icon violet">➤</div><h3>Telegram-сповіщення</h3><p>Нові ліди, оплати й термінові нагадування прямо в Telegram.</p><Field label="Bot Token" full><input type="password" value={form.telegramBotToken} onChange={(e) => set("telegramBotToken", e.target.value)} placeholder="Токен від @BotFather" /></Field><Field label="Chat ID" full><input value={form.telegramChatId} onChange={(e) => set("telegramChatId", e.target.value)} placeholder="Наприклад: -100123456789" /></Field><div className="settings-actions"><button className="secondary" onClick={testTelegram}>Тест повідомлення</button><button className="secondary" onClick={reminders}>Надіслати нагадування</button></div></article><article className="panel settings-card reminder-settings"><div className="settings-icon green">!</div><h3>Правила нагадувань</h3><p>Ти можеш змінити строки будь-коли.</p><Field label="Лід без відповіді, год"><input type="number" value={form.leadReminderHours} onChange={(e) => set("leadReminderHours", e.target.value)} /></Field><Field label="Нагадати про оплату за, днів"><input type="number" value={form.paymentReminderDays} onChange={(e) => set("paymentReminderDays", e.target.value)} /></Field><Field label="Доступ закінчується за, днів"><input type="number" value={form.accessReminderDays} onChange={(e) => set("accessReminderDays", e.target.value)} /></Field></article><article className="panel settings-card"><div className="settings-icon violet">♙</div><h3>Доступ команди</h3><p>CRM закрита від сторонніх. Менеджерів додамо пізніше за їхніми email.</p><div className="access-note"><span>✓</span><div><strong>Журнал дій</strong><small>Видно автора кожної зміни</small></div></div><div className="access-note"><span>✓</span><div><strong>Безпечний архів</strong><small>Видалене можна відновити</small></div></div></article></section></>;
}
