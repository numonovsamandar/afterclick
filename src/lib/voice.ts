import { z } from "zod";
import { INCIDENTS, activeQuestions, buildResponsePlan, type Facts } from "./engine";

// Accept selectors, never arbitrary text or a client-authored recovery plan.
export const VoiceInput = z.object({
  incident: z.enum(["password", "code", "payment", "link", "remote"]),
  facts: z.record(z.string().max(20), z.string().max(40)).refine((facts) => Object.keys(facts).length <= 20),
  provider: z.enum(["google", "microsoft", "paypal", "apple", "amazon"]).optional(),
  section: z.enum(["aid", "questions", "step"]),
  index: z.number().int().min(0).max(50),
}).strict();
export type VoiceRequest = z.infer<typeof VoiceInput>;

export function narration(input: VoiceRequest): string {
  const meta = INCIDENTS[input.incident];
  const facts: Facts = {};
  for (const q of meta.questions) {
    const value = input.facts[q.id];
    if (value !== undefined) {
      if (!q.options.some((o) => o.value === value)) throw new Error("Invalid answer");
      facts[q.id] = value;
    }
  }
  if (Object.keys(facts).length !== Object.keys(input.facts).length) throw new Error("Invalid answer");
  if (input.section === "aid") return [meta.label, ...meta.firstAid].join(". ");
  if (input.section === "questions") {
    const q = activeQuestions(input.incident, facts)[input.index];
    if (!q) throw new Error("Question unavailable");
    return [q.prompt, q.hint, ...q.options.map((o) => o.label)].filter(Boolean).join(". ");
  }
  const action = buildResponsePlan({ incident: input.incident, facts, provider: input.provider }).actions[input.index];
  if (!action) throw new Error("Step unavailable");
  return [action.title, action.instruction, "Why it matters.", action.why,
    ...action.how, "How to verify.", action.verify, "Done means.", action.completionMeans].join(" ");
}
