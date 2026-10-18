import { createServerFn } from "@tanstack/react-start";
import { VoiceInput, narration } from "./voice";

// Bounded per-instance cache and generation budget; configure provider spending
// limits too, since serverless replicas do not share this in-memory budget.
const cache = new Map<string, string>();
let windowStart = 0;
let requests = 0;

export const speakGuidance = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => VoiceInput.parse(data))
  .handler(async ({ data }): Promise<{ audio?: string; error?: string }> => {
    const key = process.env["ELEVENLABS_API_KEY"];
    const voice = process.env["ELEVENLABS_VOICE_ID"];
    if (!key || !voice) return { error: "Voice isn't connected yet. You can still follow every step on screen." };
    let text: string;
    try { text = narration(data); } catch { return { error: "This step has changed. Please reopen it and try again." }; }
    const cacheKey = `${voice}:${text}`;
    const cached = cache.get(cacheKey);
    if (cached) return { audio: cached };
    if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); requests = 0; }
    if (requests >= 20) return { error: "Voice is busy. Please try again in a minute." };
    requests++;
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true } }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) return { error: "Voice is temporarily unavailable. Please follow the written steps or try again shortly." };
      const audio = Buffer.from(await response.arrayBuffer()).toString("base64");
      if (cache.size >= 40) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, audio);
      return { audio };
    } catch {
      return { error: "Couldn't load the voice. Check your connection and try again." };
    }
  });
