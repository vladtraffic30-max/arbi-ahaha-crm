import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { records } from "../../../db/schema";
import {
  actorFrom,
  recordTypes,
  routeError,
  sendTelegram,
  syncGoogle,
  toRecord,
  type RecordType,
} from "../crm-utils";

const entityNames: Record<string, string> = {
  lead: "Лід", student: "Учень", payment: "Оплата", access: "Доступ",
  expense: "Витрата", task: "Завдання", cohort: "Потік", team: "Учасник", split: "Частка",
};

async function addActivity(db: Awaited<ReturnType<typeof getDb>>, actor: string, action: string, entityType: string, entityId: string, label: string) {
  const now = new Date().toISOString();
  await db.insert(records).values({
    id: crypto.randomUUID(),
    recordType: "activity",
    data: JSON.stringify({ action, entityType, entityId, label }),
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
  });
}

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.select().from(records).orderBy(desc(records.createdAt));
    return Response.json({ records: rows.map(toRecord) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { type?: RecordType; data?: Record<string, unknown> };
    if (!payload.type || !recordTypes.includes(payload.type) || !payload.data) {
      return Response.json({ error: "Некоректний тип або дані" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const actor = actorFrom(request);
    const row = {
      id: crypto.randomUUID(),
      recordType: payload.type,
      data: JSON.stringify(payload.data),
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };
    const db = await getDb();
    await db.insert(records).values(row);
    const record = toRecord(row);
    if (payload.type !== "activity") {
      const label = String(payload.data.name ?? payload.data.studentName ?? payload.data.title ?? payload.data.category ?? entityNames[payload.type]);
      await addActivity(db, actor, "Створено", payload.type, row.id, label);
      if (payload.type === "lead") await sendTelegram(`🟢 <b>Новий лід FRANKLIN</b>\n${label}\nТариф: ${String(payload.data.tariff ?? "—")}\nДжерело: ${String(payload.data.source ?? "—")}`);
      if (payload.type === "payment") await sendTelegram(`💵 <b>Нова оплата FRANKLIN</b>\n${label}: $${String(payload.data.amount ?? 0)}`);
    }
    await syncGoogle({ action: "upsert", record });
    return Response.json({ record }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as { id?: string; data?: Record<string, unknown> };
    if (!payload.id || !payload.data) {
      return Response.json({ error: "ID і дані обов’язкові" }, { status: 400 });
    }
    const db = await getDb();
    const [before] = await db.select().from(records).where(eq(records.id, payload.id)).limit(1);
    await db
      .update(records)
      .set({ data: JSON.stringify(payload.data), updatedAt: new Date().toISOString() })
      .where(eq(records.id, payload.id));
    const [updated] = await db.select().from(records).where(eq(records.id, payload.id)).limit(1);
    if (!updated) return Response.json({ error: "Запис не знайдено" }, { status: 404 });
    const record = toRecord(updated);
    const parsed = record.data as Record<string, unknown>;
    const label = String(parsed.name ?? parsed.studentName ?? parsed.title ?? parsed.category ?? entityNames[record.type]);
    const wasArchived = before ? Boolean((toRecord(before).data as Record<string, unknown>).archived) : false;
    const isArchived = Boolean(parsed.archived);
    await addActivity(db, actorFrom(request), wasArchived && !isArchived ? "Відновлено" : "Оновлено", record.type, record.id, label);
    await syncGoogle({ action: "upsert", record });
    return Response.json({ record });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const type = url.searchParams.get("type") as RecordType | null;
    if (!id || !type || !recordTypes.includes(type)) {
      return Response.json({ error: "Некоректний запис" }, { status: 400 });
    }
    const db = await getDb();
    const [existing] = await db.select().from(records).where(and(eq(records.id, id), eq(records.recordType, type))).limit(1);
    if (!existing) return Response.json({ error: "Запис не знайдено" }, { status: 404 });
    const record = toRecord(existing);
    const data = { ...(record.data as Record<string, unknown>), archived: true, archivedAt: new Date().toISOString(), archivedBy: actorFrom(request) };
    await db.update(records).set({ data: JSON.stringify(data), updatedAt: new Date().toISOString() }).where(eq(records.id, id));
    const label = String(data.name ?? data.studentName ?? data.title ?? data.category ?? entityNames[type]);
    await addActivity(db, actorFrom(request), "Архівовано", type, id, label);
    const archived = { ...record, data };
    await syncGoogle({ action: "upsert", record: archived });
    return Response.json({ ok: true, record: archived });
  } catch (error) {
    return routeError(error);
  }
}
