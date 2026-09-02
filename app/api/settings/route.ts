export async function GET() {
  return Response.json({ settings: {}, storage: "browser" });
}

export async function POST() {
  return Response.json({ error: "Налаштування цієї версії зберігаються у браузері" }, { status: 409 });
}
