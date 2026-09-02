export async function POST() {
  return Response.json({ error: "Google Sheets буде доступний після підключення серверної бази" }, { status: 503 });
}
