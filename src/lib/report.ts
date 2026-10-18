import { INCIDENTS, PRIORITY_LABEL, PROVIDERS, activeQuestions, type Facts, type IncidentType, type Plan, type ProviderId } from "./engine";
import type { Analysis } from "./inspector";

export interface IncidentState {
  incident: IncidentType;
  facts: Facts;
  plan: Plan;
  done: string[];
  analysis?: Analysis | undefined;
  provider?: ProviderId | undefined;
  createdAt: Date;
}

function answered(s: IncidentState) {
  return activeQuestions(s.incident, s.facts)
    .filter((q) => s.facts[q.id])
    .map((q) => `${q.prompt} — ${q.options.find((o) => o.value === s.facts[q.id])?.label ?? s.facts[q.id]}`);
}

function unanswered(s: IncidentState) {
  return activeQuestions(s.incident, s.facts).filter((q) => !s.facts[q.id] || s.facts[q.id] === "unknown").map((q) => q.prompt);
}

/** Full case file as plain-text Markdown, built only from current app state. */
export function createIncidentReport(s: IncidentState): string {
  const L: string[] = [];
  const done = new Set(s.done);
  L.push("# AfterClick incident case file", "");
  L.push(`Generated: ${s.createdAt.toISOString()}`);
  L.push(`Incident: ${INCIDENTS[s.incident].label}`);
  L.push(`Status: ${s.plan.status}`);
  if (s.provider) L.push(`Service involved: ${PROVIDERS[s.provider].name}`);
  L.push("");

  if (s.analysis) {
    L.push("## Suspicious message (as provided)", "", "```", s.analysis.input.trim(), "```", "");
    L.push(`Inspector result: ${s.analysis.headline}`, "");
    if (s.analysis.urls.length) {
      L.push("### Links found (not visited)");
      for (const u of s.analysis.urls) {
        L.push(`- ${u.raw.replace(/^http/i, "hxxp")} → real domain: ${u.registrableDomain ?? u.hostname ?? "unparsable"}${u.issues.length ? ` — ${u.issues.map((i) => i.message).join(" ")}` : ""}`);
      }
      L.push("");
    }
    if (s.analysis.findings.length) {
      L.push("### Warning signs");
      for (const f of s.analysis.findings) L.push(`- [${f.severity}] ${f.title}: ${f.explanation} Evidence: ${f.evidence.map((e) => `"${e.text}"`).join(", ")}`);
      L.push("");
    }
  }

  L.push("## Facts confirmed by the user");
  const a = answered(s);
  L.push(...(a.length ? a.map((x) => `- ${x}`) : ["- None yet"]), "");

  L.push("## Unknown or unverified");
  const unk = [...new Set([...s.plan.unknowns, ...unanswered(s), ...(s.analysis?.needsVerification ?? [])])];
  L.push(...(unk.length ? unk.map((x) => `- ${x}`) : ["- Nothing pending from the answers given"]), "");

  if (s.plan.risks.length) { L.push("## Unresolved risks", ...s.plan.risks.map((r) => `- ${r}`), ""); }

  L.push("## Response actions (in order)");
  s.plan.actions.forEach((x, i) => {
    L.push(`${i + 1}. [${done.has(x.id) ? "x" : " "}] ${x.title} (${PRIORITY_LABEL[x.priority]}) — ${x.instruction}${x.resource ? ` Official: ${x.resource.url}` : ""}`);
  });
  L.push("");
  const completed = s.plan.actions.filter((x) => done.has(x.id));
  const remaining = s.plan.actions.filter((x) => !done.has(x.id));
  L.push(`Marked completed by user: ${completed.length ? completed.map((x) => x.title).join("; ") : "none"}`);
  L.push(`Remaining: ${remaining.length ? remaining.map((x) => x.title).join("; ") : "none"}`, "");

  if (s.plan.resources.length) { L.push("## Official references", ...s.plan.resources.map((r) => `- ${r.label}: ${r.url}`), ""); }

  L.push("---", "Steps marked completed are self-reported. This report is not independent verification that any account, device or payment is secure or recovered. Only the provider involved can confirm that.");
  return L.join("\n");
}

/** Short summary for copy/paste to a helper. */
export function createIncidentSummary(s: IncidentState): string {
  const done = new Set(s.done);
  const remaining = s.plan.actions.filter((x) => !done.has(x.id));
  return [
    `AfterClick — ${INCIDENTS[s.incident].label} (${s.plan.status})`,
    ...answered(s).map((x) => `• ${x}`),
    `Done (${s.plan.actions.length - remaining.length}/${s.plan.actions.length}). Still to do:`,
    ...(remaining.length ? remaining.map((x) => `  - ${x.title}`) : ["  - nothing"]),
    "Completion is self-reported, not verified.",
  ].join("\n");
}

/** Editable draft to send to the bank / provider / IT. Never includes secrets. */
export function createSupportInquiry(s: IncidentState): string {
  const who = s.incident === "payment" ? "Fraud department" : s.provider ? `${PROVIDERS[s.provider].name} Support` : "Support team";
  const ask: Record<IncidentType, string> = {
    payment: "I believe I sent a payment to a scammer. Please help me stop, reverse or flag the transaction, and tell me what else I should do. Please give me a case/reference number.",
    password: "I entered my password on what I believe was a phishing site. Please help me secure my account, review recent sign-ins and remove any unrecognized sessions or devices.",
    code: "I shared a verification code with someone I now believe was a scammer. Please help me check for unauthorized access and secure my account.",
    link: "I clicked a link in a suspicious message. Please let me know if you see any unusual activity on my account and how to report the message.",
    remote: "I allowed someone posing as tech support to remotely access my computer. Please help me check for unauthorized activity and secure my account.",
  };
  const facts = answered(s);
  return [
    `To: ${who}`,
    `Subject: Possible ${INCIDENTS[s.incident].short.toLowerCase()} — request for help`,
    "",
    "Hello,",
    "",
    ask[s.incident],
    "",
    `When it happened: [date and time]`,
    s.incident === "payment" ? "Amount and method: [amount] via [card/transfer/app]" : "Account: [your account email or username — never your password]",
    ...(facts.length ? ["", "What I know so far:", ...facts.map((f) => `- ${f}`)] : []),
    ...(s.analysis?.urls.length ? ["", "Suspicious link(s) in the message (not visited by me again):", ...s.analysis.urls.map((u) => `- ${u.raw.replace(/^http/i, "hxxp")} (domain: ${u.registrableDomain ?? u.hostname})`)] : []),
    "",
    "I have not shared my password or codes in this message.",
    "",
    "Thank you,",
    "[Your name]",
  ].join("\n");
}
