import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { settings } from "../../../db/schema";
import { actorFrom, routeError } from "../crm-utils";

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.select().from(settings);
    return Response.json({ settings: Object.fromEntries(rows.map((row) => [row.key, row.key === "telegramBotToken" && row.value ? "__configured__" : row.value])) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { key?: string; value?: string };
    if (!payload.key || typeof payload.value !== "string") {
      return Response.json({ error: "Некоректне налаштування" }, { status: 400 });
    }
    const db = await getDb();
    const existing = await db.select().from(settings).where(eq(settings.key, payload.key)).limit(1);
    if (payload.key === "telegramBotToken" && payload.value === "__configured__") return Response.json({ ok: true });
    const values = {
      key: payload.key,
      value: payload.value.trim(),
      updatedBy: actorFrom(request),
      updatedAt: new Date().toISOString(),
    };
    if (existing.length) await db.update(settings).set(values).where(eq(settings.key, payload.key));
    else await db.insert(settings).values(values);
    return Response.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
