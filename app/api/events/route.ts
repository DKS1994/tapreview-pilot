import { sql } from "@/lib/db";

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const { sessionId, name, props } = body;
  if (!sessionId || !name) return new Response("bad request", { status: 400 });

  try {
    await sql`
      insert into events (session_id, name, props)
      values (${sessionId}, ${name}, ${props ? sql.json(props) : null})
    `;
  } catch {
    // Analytics is best-effort — never let a DB hiccup surface as a broken UI.
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
