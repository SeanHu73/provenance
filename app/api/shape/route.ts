import { NextResponse } from "next/server";

interface PointInput {
  index: number;
  note: string;
  connection?: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { points, title, description } = (await request.json()) as {
    points: PointInput[];
    title?: string;
    description?: string;
  };

  if (!points || points.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 described points" },
      { status: 400 }
    );
  }

  const notesBlock = points
    .map(
      (p, i) =>
        `Point ${i + 1}: "${p.note}"${p.connection ? ` (connection to previous: "${p.connection}")` : ""}`
    )
    .join("\n");

  const prompt = `You are helping a storyteller turn their raw notes about a place into a guided exploration experience. The storyteller has placed annotation points on a photo and described what's there and why it matters.

Here are the storyteller's notes:
${title ? `Title: "${title}"` : ""}
${description ? `Description: "${description}"` : ""}

${notesBlock}

Generate the following as JSON (no markdown, just the JSON object):

{
  "questions": ["A question for explorers at each point that makes them look carefully before reading the answer. One per point, in order."],
  "insights": ["The key insight revealed after each question. Should build on the storyteller's note but be more polished. One per point, in order."],
  "bigPicture": "A single connecting statement that ties all points together — what the explorer should understand after seeing everything.",
  "sequenceRationale": "A brief explanation of why the current order works (or suggest a better one).",
  "connections": [{"from": 0, "to": 1, "thread": "How these points relate to each other"}]
}

Rules:
- Questions should make the explorer LOOK at the real thing before reading
- Insights should reward looking with something surprising or meaningful
- The big picture should reframe how the explorer sees the whole place
- Keep language conversational, not academic
- Generate exactly ${points.length} questions and ${points.length} insights`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: `Claude API error: ${response.status}`, detail: err },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse AI response", raw: text },
        { status: 502 }
      );
    }

    const suggestions = JSON.parse(jsonMatch[0]);
    return NextResponse.json(suggestions);
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
