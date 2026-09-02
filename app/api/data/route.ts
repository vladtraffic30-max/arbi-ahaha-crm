export async function GET() {
  return Response.json({ records: [], storage: "browser" });
}

export async function POST() {
  return Response.json({ error: "Дані цієї версії зберігаються у браузері" }, { status: 409 });
}

export const PATCH = POST;
export const DELETE = POST;
