import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export async function getDb() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS crm_records (
      id TEXT PRIMARY KEY NOT NULL,
      record_type TEXT NOT NULL,
      data TEXT DEFAULT '{}' NOT NULL,
      created_by TEXT DEFAULT 'system' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS crm_records_type_idx ON crm_records (record_type)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS crm_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT DEFAULT '' NOT NULL,
      updated_by TEXT DEFAULT 'system' NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
  ]);

  return drizzle(env.DB, { schema });
}
