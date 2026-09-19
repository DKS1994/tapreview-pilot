import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export async function POST(req: Request) {
  let body: {
    rating?: number;
    aspects?: string[];
    items?: string[];
    tone?: string;
    length?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const rating = body.rating;
  const aspects = Array.isArray(body.aspects) ? body.aspects : [];
  const items = Array.isArray(body.items) ? body.items : [];
  const tone = body.tone ?? "warm";
  const length = body.length ?? "short";

  const chips = [
    ...aspects,
    ...items.map((i: string) => `item: ${i}`),
  ].join(", ");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 250,
      system:
        "Write a first-person Google review that asserts ONLY the experiences named by the " +
        "provided chips. Weave them into varied, natural prose. You MUST NOT add any claim, " +
        "detail, dish, name, quality judgment, or sentiment the chips do not state — this " +
        "includes descriptive adjectives (e.g. 'cozy', 'quick', 'friendly') unless that exact " +
        "quality is one of the chips. A chip written as 'item: X' means the customer ordered " +
        "menu item X — mention neutrally that they had it; do NOT invent any opinion, " +
        "complaint, or quality judgment about that item (e.g. temperature, taste, freshness) " +
        "unless a separate chip explicitly states one. Do NOT characterize the venue's " +
        "atmosphere, vibe, or character (e.g. 'cozy', 'unpretentious', 'lively', 'charming') " +
        "unless a chip explicitly states that quality. If the chips are sparse, keep the review " +
        "short and plain rather than padding it with invented color. Do not invent staff names " +
        "or specific interactions. Match the requested tone and length. Vary sentence structure " +
        "so repeated generations differ. Return plain text only, no quotes or preamble.",
      messages: [
        {
          role: "user",
          content: `Chips: ${chips}\nRating: ${rating}/5\nTone: ${tone}\nLength: ${length}`,
        },
      ],
    });

    const text = msg.content.find((b) => b.type === "text")?.text ?? "";
    return Response.json({ text });
  } catch (e) {
    console.error("generate failed:", e);
    return Response.json({ error: "generation failed" }, { status: 502 });
  }
}
