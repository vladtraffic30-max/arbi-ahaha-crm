import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { records } from "../../../db/schema";
import { getSetting, routeError, sendTelegram, toRecord } from "../crm-utils";

function text(data: Record<string, unknown>, key: string) { return String(data[key] ?? ""); }

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { action?: string };
    if (payload.action === "test") {
      const ok = await sendTelegram("✅ <b>FRANKLIN P2P CRM підключена</b>\nTelegram-сповіщення працюють.");
      return Response.json({ ok }, { status: ok ? 200 : 400 });
    }
    const db = await getDb();
    const rows = (await db.select().from(records).orderBy(desc(records.createdAt))).map(toRecord);
    const now = Date.now();
    const [leadHoursRaw, paymentDaysRaw, accessDaysRaw] = await Promise.all([
      getSetting("leadReminderHours"), getSetting("paymentReminderDays"), getSetting("accessReminderDays"),
    ]);
    const leadHours = Number(leadHoursRaw || 24);
    const paymentDays = Number(paymentDaysRaw || 3);
    const accessDays = Number(accessDaysRaw || 3);
    const dueTasks = rows.filter((row) => row.type === "task" && !row.data.archived && text(row.data, "status") !== "Готово" && new Date(text(row.data, "dueDate")).getTime() <= now);
    const leads = rows.filter((row) => row.type === "lead" && !row.data.archived && !["Оплачено", "Втрачено"].includes(text(row.data, "status")) && now - new Date(row.updatedAt).getTime() >= leadHours * 3600000);
    const students = rows.filter((row) => row.type === "student" && !row.data.archived && text(row.data, "nextPaymentDate") && new Date(text(row.data, "nextPaymentDate")).getTime() - now <= paymentDays * 86400000);
    const access = rows.filter((row) => row.type === "access" && !row.data.archived && new Date(text(row.data, "expiresAt")).getTime() - now <= accessDays * 86400000 && new Date(text(row.data, "expiresAt")).getTime() >= now);
    if (!dueTasks.length && !leads.length && !students.length && !access.length) return Response.json({ ok: true, count: 0 });
    const lines = ["⚠️ <b>Нагадування FRANKLIN CRM</b>", ...dueTasks.slice(0, 6).map((row) => `• Завдання: ${text(row.data, "title")} — до ${text(row.data, "dueDate")}`), ...leads.slice(0, 6).map((row) => `• Лід без відповіді: ${text(row.data, "name")}`), ...students.slice(0, 6).map((row) => `• Доплата ${text(row.data, "name")}: $${text(row.data, "nextPaymentAmount")} до ${text(row.data, "nextPaymentDate")}`), ...access.slice(0, 6).map((row) => `• Доступ ${text(row.data, "studentName")} — до ${text(row.data, "expiresAt")}`)];
    const ok = await sendTelegram(lines.join("\n"));
    return Response.json({ ok, count: dueTasks.length + leads.length + students.length + access.length }, { status: ok ? 200 : 400 });
  } catch (error) {
    return routeError(error);
  }
}
