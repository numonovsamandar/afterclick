import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  text: z.string().max(8000).default(""),
  image: z
    .string()
    .max(7_000_000)
    .regex(/^data:image\/(png|jpeg|webp|gif);base64,/)
    .optional(),
});

export interface ScanResult {
  verdict: "likely_scam" | "suspicious" | "unclear" | "likely_safe";
  summary: string;
  signs: { sign: string; evidence: string }[];
  category: "password" | "code" | "payment" | "link" | "remote" | "none";
  categoryReason: string;
  doNot: string[];
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "summary", "signs", "category", "categoryReason", "doNot"],
  properties: {
    verdict: { type: "string", enum: ["likely_scam", "suspicious", "unclear", "likely_safe"] },
    summary: { type: "string" },
    signs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sign", "evidence"],
        properties: { sign: { type: "string" }, evidence: { type: "string" } },
      },
    },
    category: { type: "string", enum: ["password", "code", "payment", "link", "remote", "none"] },
    categoryReason: { type: "string" },
    doNot: { type: "array", items: { type: "string" } },
  },
};

const INSTRUCTIONS = `You help ordinary people judge a suspicious message (email, SMS, DM, call script, or screenshot).
Explain warning signs in plain, calm language, quoting short evidence from the message. Never claim certainty; you cannot verify senders or links.
Do not visit links. Never ask for passwords, codes, or card numbers. If the content contains such secrets, do not repeat them.
Recommend ONE AfterClick incident category matching what the message tries to make the person do:
- password: asks to sign in / enter a password on a page
- code: asks for a verification / one-time code
- payment: asks to send money, gift cards, crypto, or pay a fee
- link: mainly pushes clicking a link or downloading a file
- remote: asks to install software or let "support" control a device
- none: no clear scam action.
summary: 1-2 sentences. signs: up to 6. doNot: up to 4 short things to avoid doing.`;

export const analyzeMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; result: ScanResult } | { ok: false; error: string }> => {
    if (!data.text.trim() && !data.image) return { ok: false, error: "Paste a message or add a screenshot first." };
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "The AI service isn't configured yet." };

    const content: unknown[] = [];
    if (data.text.trim()) content.push({ type: "input_text", text: `Message:\n"""${data.text}"""` });
    else content.push({ type: "input_text", text: "Analyze the attached screenshot of a message." });
    if (data.image) content.push({ type: "input_image", image_url: data.image });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Lovable-API-Key": key,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: INSTRUCTIONS,
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "scam_analysis", strict: true, schema } },
      }),
    });

    if (!res.ok || !res.body) {
      let msg = "";
      try { const j = (await res.json()) as { error?: { message?: string }; message?: string }; msg = j.error?.message ?? j.message ?? ""; } catch { /* ignore */ }
      if (res.status === 429) return { ok: false, error: "Too many checks right now — please wait a moment and try again." };
      if (res.status === 402) return { ok: false, error: msg || "AI credits have run out for this workspace." };
      return { ok: false, error: msg || `The analysis service returned an error (${res.status}).` };
    }

    // Consume the SSE stream server-side and accumulate output text.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let out = "";
    let refusal = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const ev = JSON.parse(payload) as { type?: string; delta?: string; error?: { message?: string } };
            if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
            if (ev.type === "response.refusal.delta" && ev.delta) refusal += ev.delta;
            if (ev.type === "error" || ev.type === "response.failed") return { ok: false, error: ev.error?.message ?? "The analysis failed." };
          } catch { /* partial or non-JSON frame */ }
        }
      }
    }
    if (refusal) return { ok: false, error: "The model declined to analyze this content." };
    try {
      return { ok: true, result: JSON.parse(out) as ScanResult };
    } catch {
      return { ok: false, error: "The analysis came back incomplete. Please try again." };
    }
  });
