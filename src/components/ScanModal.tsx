import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, ExternalLink, FileText, ImagePlus, Link2, Loader2, ScanSearch, ShieldAlert, Sparkles, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyzeMessage as aiExplain, type ScanResult } from "@/lib/scan.functions";
import { analyzeMessage, highlightSegments, SAMPLE_PHISH, type Analysis, type Severity } from "@/lib/inspector";
import { INCIDENTS, INTERACTIONS, PRIORITY_LABEL, noInteractionPlan, type Facts, type IncidentType } from "@/lib/engine";
import { cn } from "@/lib/utils";

export interface CaseContext { analysis: Analysis }

const SEV_MARK: Record<Severity, string> = {
  high: "bg-now/20 text-foreground underline decoration-now decoration-2 underline-offset-2",
  medium: "bg-next/20 underline decoration-next decoration-2 underline-offset-2",
  low: "bg-verify/15 underline decoration-verify/60 underline-offset-2",
};
const SEV_BADGE: Record<Severity, string> = {
  high: "border-now/40 bg-now/10 text-now", medium: "border-next/40 bg-next/10 text-next", low: "border-verify/40 bg-verify/10 text-verify",
};

export function ScanModal({ open, onOpenChange, onOpenPlan }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  onOpenPlan: (t: IncidentType, facts: Facts | undefined, ctx: CaseContext | undefined) => void;
}) {
  const explain = useServerFn(aiExplain);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [noInteraction, setNoInteraction] = useState(false);
  const [ai, setAi] = useState<ScanResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return setError("Please choose a PNG, JPG, WEBP or GIF screenshot.");
    if (f.size > 5 * 1024 * 1024) return setError("That image is over 5 MB — try a smaller screenshot.");
    const r = new FileReader();
    r.onload = () => { setImage(r.result as string); setError(null); };
    r.readAsDataURL(f);
  }

  function run() { setError(null); setAi(null); setNoInteraction(false); setAnalysis(analyzeMessage(text)); }

  async function runAi() {
    setAiLoading(true); setError(null);
    try {
      const res = await explain({ data: { text, ...(image ? { image } : {}) } });
      if (res.ok) setAi(res.result); else setError(res.error);
    } catch { setError("We couldn't reach the AI explainer. The checks above still apply."); }
    finally { setAiLoading(false); }
  }

  function reset() { setText(""); setImage(null); setAnalysis(null); setAi(null); setError(null); setNoInteraction(false); }

  const segs = useMemo(() => (analysis ? highlightSegments(analysis.input, analysis.findings) : []), [analysis]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content aria-describedby={undefined}
          onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); pickFile(f); } }}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-paper outline-none md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(820px,94vh)] md:w-[min(960px,95vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:shadow-[var(--shadow-card)] data-[state=open]:animate-in data-[state=open]:fade-in-0 md:data-[state=open]:zoom-in-95">
          <div className="flex items-center gap-3 border-b px-5 py-4 md:px-7">
            <span className="grid size-9 place-items-center rounded-lg border bg-secondary"><ScanSearch className="size-4" /></span>
            <div className="flex-1">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Scam inspector · links are never opened</p>
              <Dialog.Title className="text-base font-semibold tracking-tight md:text-lg">Inspect a suspicious message</Dialog.Title>
            </div>
            <Dialog.Close className="nav-pill !px-2.5" aria-label="Close"><X className="size-4" /></Dialog.Close>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6 md:px-7">
            {!analysis && <>
              <label className="block">
                <span className="flex items-center justify-between text-sm font-medium">Paste the email, text message or link
                  <button type="button" onClick={() => setText(SAMPLE_PHISH)} className="nav-pill !h-8 text-xs"><FileText className="mr-1 size-3.5" />Load sample phishing email</button>
                </span>
                <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={8000} rows={10} aria-label="Suspicious message"
                  placeholder="Paste the full message, or just a link like https://example-login.top/verify"
                  className="mt-2 w-full resize-y rounded-lg border bg-card p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-foreground/60" />
              </label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Analysis runs in your browser using fixed, explainable rules. Remove passwords, codes and account numbers first. Nothing is stored on a server.
              </p>
            </>}

            {error && <p role="alert" className="rounded-lg border border-now/40 bg-now/8 p-3 text-sm text-now">{error}</p>}

            {analysis && !noInteraction && (
              <div className="step-in space-y-5">
                <div className={cn("rounded-xl border-2 p-4", analysis.level === "warning-signs" ? "border-now/50 bg-now/8" : analysis.level === "some-signs" ? "border-next/50 bg-next/8" : "border-verify/40 bg-verify/8")}>
                  <p className="text-lg font-semibold">{analysis.headline}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {analysis.findings.length} finding{analysis.findings.length === 1 ? "" : "s"} · {analysis.urls.length} link{analysis.urls.length === 1 ? "" : "s"} extracted
                    {analysis.brands.length > 0 && <> · claims to be {analysis.brands.map((b) => b.name).join(", ")}</>}
                  </p>
                </div>

                <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message with highlights</p>
                    <pre data-testid="highlighted" className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-card p-3 font-mono text-[12.5px] leading-relaxed">
                      {segs.map((s, i) => s.severity ? <mark key={i} className={cn("rounded-sm px-0.5", SEV_MARK[s.severity])}>{s.text}</mark> : <span key={i}>{s.text}</span>)}
                    </pre>
                    {analysis.urls.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Links — where they really go</p>
                        <ul className="mt-2 space-y-2">
                          {analysis.urls.map((u) => (
                            <li key={u.start} className="rounded-lg border bg-card p-3 text-sm">
                              <p className="flex items-start gap-2 break-all font-mono text-xs text-muted-foreground"><Link2 className="mt-0.5 size-3.5 shrink-0" />{u.raw}</p>
                              <p className="mt-1.5">Real domain: <span className={cn("font-mono font-semibold", u.officialFor ? "text-safe" : u.issues.length ? "text-now" : "")}>{u.registrableDomain ?? u.hostname ?? "unparsable"}</span>
                                {u.officialFor && <span className="ml-1.5 text-xs text-muted-foreground">(a domain {u.officialFor.name} uses — still check before signing in)</span>}</p>
                              {u.subdomain && <p className="text-xs text-muted-foreground">Subdomain (controlled by the domain owner): <span className="font-mono">{u.subdomain}</span></p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Findings & evidence</p>
                    {analysis.findings.length === 0 && <p className="mt-2 rounded-lg border border-dashed p-3 text-sm">No rule matched. Scams change constantly — this is not a sign the message is safe.</p>}
                    <ul className="mt-2 space-y-2">
                      {analysis.findings.map((f) => (
                        <li key={f.id} className="rounded-lg border bg-card p-3 text-sm">
                          <p className="flex items-center gap-2 font-medium"><span className={cn("rounded border px-1.5 font-mono text-[10px] uppercase", SEV_BADGE[f.severity])}>{f.severity}</span>{f.title}</p>
                          <p className="mt-1 text-muted-foreground">{f.explanation}</p>
                          <p className="mt-1.5 flex flex-wrap gap-1">{f.evidence.map((e, i) => <code key={i} className="break-all rounded bg-secondary px-1.5 py-0.5 text-xs">"{e.text}"</code>)}</p>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 rounded-lg border border-verify/30 bg-verify/8 p-3 text-sm">
                      <p className="font-semibold">Needs independent verification</p>
                      <ul className="mt-1 space-y-1">{analysis.needsVerification.map((v) => <li key={v}>• {v}</li>)}</ul>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border-2 border-foreground/80 bg-card p-4">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Emergency action center</p>
                  <p className="mt-1 text-lg font-semibold">What actually happened?</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label="What actually happened">
                    {INTERACTIONS.map((x) => (
                      <button key={x.id} onClick={() => x.incident ? onOpenPlan(x.incident, Object.keys(x.facts).length ? x.facts : undefined, { analysis }) : setNoInteraction(true)}
                        className={cn("flex items-center justify-between rounded-lg border bg-paper px-3.5 py-3 text-left text-sm transition-all hover:border-foreground/60",
                          x.incident && x.incident === analysis.suggested && "border-foreground")}>
                        <span>{x.label}{x.incident === "payment" && <span className="ml-2 rounded bg-now/12 px-1.5 font-mono text-[10px] uppercase text-now">urgent</span>}</span>
                        <ArrowRight className="size-4 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-dashed p-4 text-sm">
                  <p className="flex items-center gap-2 font-semibold"><Sparkles className="size-4" />Optional: AI plain-language explanation</p>
                  <p className="mt-1 text-xs text-muted-foreground">An AI model can explain the message in plain words (and read a screenshot). It can be wrong; the findings above come from fixed rules, and the plan always comes from AfterClick's rules.</p>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-paper !h-9 text-sm" disabled={aiLoading} onClick={runAi}>{aiLoading ? <><Loader2 className="size-4 animate-spin" />Explaining…</> : "Explain with AI"}</button>
                    <button className="nav-pill" onClick={() => fileRef.current?.click()}><ImagePlus className="mr-1.5 size-4" />{image ? "Screenshot attached" : "Add screenshot"}</button>
                  </div>
                  {ai && (
                    <div className="mt-3 space-y-2 rounded-lg bg-card p-3">
                      <p className="font-mono text-[10px] uppercase text-muted-foreground">AI explanation — may be wrong</p>
                      <p>{ai.summary}</p>
                      {ai.signs.length > 0 && <ul className="space-y-1 text-muted-foreground">{ai.signs.map((s, i) => <li key={i} className="flex gap-2"><ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-now" />{s.sign}{s.evidence && <> — "{s.evidence}"</>}</li>)}</ul>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {analysis && noInteraction && <NoInteraction analysis={analysis} onBack={() => setNoInteraction(false)} />}
          </div>

          <div className="flex items-center gap-2 border-t bg-background/60 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] md:px-7">
            {analysis ? <button className="nav-pill" onClick={reset}>Inspect another message</button> : <div />}
            <div className="flex-1" />
            {!analysis && <button className="btn-ink" disabled={!text.trim()} onClick={run}>Analyze<ArrowRight className="size-4" /></button>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NoInteraction({ analysis, onBack }: { analysis: Analysis; onBack: () => void }) {
  const plan = noInteractionPlan(analysis.provider);
  return (
    <div className="step-in mx-auto max-w-xl space-y-4">
      <button className="nav-pill" onClick={onBack}><ArrowLeft className="mr-1.5 size-4" />Back to findings</button>
      <h3 className="font-display text-3xl">Good — nothing has happened yet.</h3>
      <ol className="space-y-3">
        {plan.actions.map((x, i) => (
          <li key={x.id} className="rounded-lg border bg-card p-4">
            <p className="font-mono text-[11px] uppercase text-muted-foreground">{i + 1} · {PRIORITY_LABEL[x.priority]}</p>
            <p className="mt-1 font-medium">{x.title}</p>
            <p className="mt-1 text-sm">{x.instruction}</p>
            <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">{x.how.map((h) => <li key={h}>• {h}</li>)}</ul>
            {x.resource && <a href={x.resource.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm underline underline-offset-4">{x.resource.label}<ExternalLink className="size-3" /></a>}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">If you later realize you did click, sign in, or pay — go back and choose that option. {INCIDENTS.link.firstAid[0]}</p>
    </div>
  );
}
