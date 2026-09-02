import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { records } from "../../../db/schema";
import { routeError, syncGoogle, toRecord } from "../crm-utils";

export async function POST() {
  try {
    const db = await getDb();
    const rows = await db.select().from(records).orderBy(desc(records.createdAt));
    await syncGoogle({ action: "sync_all", records: rows.map(toRecord) });
    return Response.json({ ok: true, count: rows.length });
  } catch (error) {
    return routeError(error);
  }
}
