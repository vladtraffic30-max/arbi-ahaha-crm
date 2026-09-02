import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { settings } from "../../db/schema";

export const recordTypes = ["lead", "student", "payment", "access", "expense", "task", "cohort", "team", "split", "activity"] as const;
export type RecordType = (typeof recordTypes)[number];

export function actorFrom(request: Request) {
  return request.headers.get("oai-authenticated-user-email") ?? "owner@franklin.local";
}

export function parseData(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function toRecord(row: {
  id: string;
  recordType: string;
  data: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}) {
  return { ...row, type: row.recordType, data: parseData(row.data) };
}

export async function syncGoogle(payload: Record<string, unknown>) {
  try {
    const db = await getDb();
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "googleSheetsUrl"))
      .limit(1);
    if (!setting?.value) return;
    await fetch(setting.value, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "FRANKLIN P2P CRM", ...payload }),
    });
  } catch {
    // CRM writes remain authoritative if Google Sheets is temporarily unavailable.
  }
}

export async function getSetting(key: string) {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value ?? "";
}

export async function sendTelegram(message: string) {
  try {
    const [token, chatId] = await Promise.all([
      getSetting("telegramBotToken"),
      getSetting("telegramChatId"),
    ]);
    if (!token || !chatId) return false;
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Невідома помилка";
  return Response.json({ error: message }, { status: 500 });
}
