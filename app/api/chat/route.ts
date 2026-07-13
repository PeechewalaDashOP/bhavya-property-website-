import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are a helpful property assistant for Prop100, a property listing website in Kota, Rajasthan, India.

You help users find hostels, PGs, rooms, flats, houses, shops, and plots in Kota. Kota is famous for its coaching institutes (Allen, Resonance, FIITJEE, Vibrant, Motion) and attracts thousands of students every year.

Available areas: Talwandi, Rajeev Gandhi Nagar, Mahaveer Nagar, Vigyan Nagar, Dadabadi, Borkhera, Shreenathpuram, Rangbari, R.K. Puram, Keshavpura, Kunhadi, Coral Park, Nayapura, Jawahar Nagar.

Property types: Hostel, PG, Room, Flat, House, Shop, Plot.

Coaching institutes: Allen, Resonance, FIITJEE, Vibrant, Motion.

Price ranges: Hostels Rs.3,000-10,000/month. PG Rs.3,500-9,000/month. Rooms Rs.2,500-8,000/month. 1BHK flats Rs.5,000-12,000/month. 2BHK flats Rs.8,000-18,000/month.

RULES:
- Respond in the same language the user writes in. Hindi means reply in Hindi. English means reply in English.
- Keep responses short (2-3 sentences max).
- Be warm and helpful.
- For property searches, set showCards to true and populate the filter.
- Only include filter fields clearly specified by the user.
- Do not make up property details.

ALWAYS respond with valid JSON only (no markdown, no code blocks, just raw JSON):
{
  "text": "Response text. May use <b>bold</b> or <i>italic</i>.",
  "showCards": false,
  "filter": {
    "type": "rent",
    "loc": "Talwandi",
    "bhk": 2,
    "ptype": "Flat",
    "coaching": false
  },
  "quickReplies": ["Option 1", "Option 2"]
}

The filter object and its fields are all optional. Only include fields the user mentioned.
quickReplies should be 2-4 short actionable options.`;

type ConvMsg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";

  try {
    const { messages }: { messages: ConvMsg[] } = await req.json();
    if (!messages?.length) return NextResponse.json({ error: "No messages" }, { status: 400 });

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        text: "I'm here to help you find properties in Kota! Try asking: <i>\"hostel near Allen\"</i> or <i>\"2 BHK flat in Talwandi\"</i>.",
        showCards: false,
        quickReplies: ["🏠 Homes to buy", "🔑 Homes for rent", "🎓 Near coaching", "📞 Talk to a dealer"],
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-lite",
      systemInstruction: SYSTEM_PROMPT,
    });

    // Build Gemini chat history (all except the last message)
    // Gemini requires history to start with "user" and alternate user/model
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });
    const lastMsg = messages[messages.length - 1].content;
    const result = await chat.sendMessage(lastMsg);
    const raw = result.response.text().trim();

    let parsed: Record<string, unknown>;
    try {
      // Strip markdown code fences if Gemini wraps in them
      const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { text: raw, showCards: false };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        text: isDev
          ? `[Dev error] ${msg}`
          : "Sorry, something went wrong. Please try again.",
        showCards: false,
      },
      { status: 500 }
    );
  }
}
