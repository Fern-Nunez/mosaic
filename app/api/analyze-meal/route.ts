import { NextResponse } from "next/server"

import { decryptSecret } from "@/lib/crypto"
import { createClient } from "@/lib/supabase/server"

// gpt-4o-mini: cheap vision model, plenty for food estimates.
const OPENAI_MODEL = "gpt-4o-mini"

const RESPONSE_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "meal_estimate",
    strict: true,
    schema: {
      type: "object",
      properties: {
        food_name: {
          type: "string",
          description: "Short name for the meal, e.g. 'Chicken alfredo'",
        },
        calories: { type: "integer" },
        protein: { type: "number", description: "grams" },
        carbs: { type: "number", description: "grams" },
        fat: { type: "number", description: "grams" },
        portion_size: {
          type: "string",
          description: "Estimated portion, e.g. '1 plate, ~350g'",
        },
        notes: {
          type: "string",
          description: "One short sentence on what the estimate assumed",
        },
      },
      required: [
        "food_name",
        "calories",
        "protein",
        "carbs",
        "fat",
        "portion_size",
        "notes",
      ],
      additionalProperties: false,
    },
  },
} as const

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  // Each user brings their own OpenAI key (saved in Settings, stored
  // encrypted). The server env key is a fallback for the app owner.
  let apiKey: string | null = null
  const { data: settings } = await supabase
    .from("user_settings")
    .select("openai_api_key")
    .maybeSingle()
  if (settings?.openai_api_key) {
    try {
      apiKey = decryptSecret(settings.openai_api_key)
    } catch {
      apiKey = null
    }
  }
  apiKey ??= process.env.OPENAI_API_KEY || null

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "No OpenAI API key found. Add yours under Settings in the sidebar.",
      },
      { status: 400 }
    )
  }

  const form = await request.formData()
  const image = form.get("image")
  const name = String(form.get("name") ?? "").trim()
  const details = String(form.get("details") ?? "").trim()

  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "No photo provided." }, { status: 400 })
  }

  const bytes = Buffer.from(await image.arrayBuffer())
  const dataUrl = `data:${image.type || "image/jpeg"};base64,${bytes.toString("base64")}`

  const prompt = [
    "Estimate the nutrition of the food in this photo (total for everything visible).",
    name && `The user calls it: "${name}".`,
    details && `The user says it contains: ${details}.`,
    "Whenever a range of values is plausible, choose the LOW end of the range",
    "for calories, protein, carbs, and fat — never the midpoint or high end.",
  ]
    .filter(Boolean)
    .join(" ")

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 400,
      response_format: RESPONSE_SCHEMA,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message =
      body?.error?.message ?? `OpenAI request failed (${res.status}).`
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const completion = await res.json()
  const content = completion.choices?.[0]?.message?.content

  try {
    return NextResponse.json(JSON.parse(content))
  } catch {
    return NextResponse.json(
      { error: "The model returned an unreadable response. Try again." },
      { status: 502 }
    )
  }
}
