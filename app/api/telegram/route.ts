export async function POST() {
  return Response.json({ error: "Telegram буде доступний після підключення серверної бази" }, { status: 503 });
}
