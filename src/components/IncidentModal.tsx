import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ExternalLink, HelpCircle,
  ListChecks, Phone, RotateCcw, Sparkles, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  INCIDENTS, INCIDENT_ORDER, PRIORITY_LABEL, activeQuestions, buildResponsePlan, diffPlans, pruneFacts,
  type FactKey, type Facts, type IncidentType, type Plan, type PlanDiff, type Priority,
} from "@/lib/engine";
import { INCIDENT_ICONS } from "@/components/incident-icons";
import { cn } from "@/lib/utils";
import { clearPlan, loadPlan, savePlan } from "@/lib/saved-plans";
import type { CaseContext } from "@/components/ScanModal";
import { CaseFile } from "@/components/CaseFile";
import { VoiceGuide } from "@/components/VoiceGuide";

type Phase = "choose" | "aid" | "questions" | "step" | "full";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  incident: IncidentType | null;
  initialFacts?: Facts | undefined;
  caseContext?: CaseContext | undefined;
}

const PRI_STYLE: Record<Priority, string> = {
  now: "bg-now/12 text-now border-now/30",
  next: "bg-next/12 text-next border-next/30",
  verify: "bg-verify/12 text-verify border-verify/30",
};

export function IncidentModal({ open, onOpenChange, incident: initial, initialFacts, caseContext }: Props) {
  const [incident, setIncident] = useState<IncidentType | null>(initial);
  const [facts, setFacts] = useState<Facts>({});
  const [phase, setPhase] = useState<Phase>("choose");
  const [qIndex, setQIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [diff, setDiff] = useState<PlanDiff | null>(null);
  const planSeen = useRef(false);
  const persist = useRef(false);
  const [restored, setRestored] = useState<number | null>(null);

  function startIncident(t: IncidentType | null, demo?: Facts) {
    setIncident(t); setQIndex(0); setStepIndex(0); setDiff(null); setRestored(null);
    persist.current = !!t && !demo;
    const saved = t && !demo ? loadPlan(t) : undefined;
    if (saved) {
      setFacts(saved.facts); setDone(new Set(saved.done)); setPhase("full");
      planSeen.current = true; setRestored(saved.updatedAt);
      return;
    }
    setFacts(demo ?? {}); setDone(new Set());
    setPhase(t ? (demo ? "full" : "aid") : "choose");
    planSeen.current = !!demo;
  }

  useEffect(() => {
    if (open) startIncident(initial, initialFacts);
  }, [open, initial, initialFacts]);

  // Save answers and completed steps locally whenever they change.
  useEffect(() => {
    if (!open || !incident || !persist.current) return;
    if (Object.keys(facts).length === 0 && done.size === 0) return;
    savePlan(incident, { facts, done: [...done] });
  }, [open, incident, facts, done]);

  const provider = caseContext?.analysis.provider;
  const computePlan = (t: IncidentType, f: Facts) => buildResponsePlan({ incident: t, facts: f, provider });
  const plan = useMemo<Plan | null>(() => (incident ? computePlan(incident, facts) : null), [incident, facts, provider]);
  const questions = incident ? activeQuestions(incident, facts) : [];
  const meta = incident ? INCIDENTS[incident] : null;

  function answer(id: FactKey, value: string) {
    if (!incident) return;
    const next = pruneFacts(incident, { ...facts, [id]: value });
    if (planSeen.current) {
      const d = diffPlans(computePlan(incident, facts), computePlan(incident, next));
      setDiff(d.added.length || d.removed.length || d.reprioritized.length || d.firstChanged ? d : null);
      setStepIndex(0);
    }
    setFacts(next);
  }

  function choose(t: IncidentType) {
    startIncident(t);
  }

  function showPlan(to: Phase = "step") {
    planSeen.current = true; setPhase(to);
  }

  function toggleDone(id: string) {
    setDone((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const actions = plan?.actions ?? [];
  const current = actions[Math.min(stepIndex, actions.length - 1)];
  const completed = actions.filter((x) => done.has(x.id)).length;

  // Keyboard: arrows move between steps
  function onKey(e: React.KeyboardEvent) {
    if (phase !== "step" || (e.target as HTMLElement).tagName === "BUTTON" && e.key === " ") return;
    if (e.key === "ArrowRight") setStepIndex((i) => Math.min(i + 1, actions.length - 1));
    if (e.key === "ArrowLeft") setStepIndex((i) => Math.max(i - 1, 0));
  }

  const progress = phase === "questions" ? (qIndex + 1) / Math.max(questions.length, 1)
    : phase === "step" || phase === "full" ? completed / Math.max(actions.length, 1) : 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          onKeyDown={onKey}
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-paper text-foreground outline-none",
            "inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
            "md:h-[min(760px,92vh)] md:w-[min(880px,94vw)] md:rounded-2xl md:border md:shadow-[var(--shadow-card)]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-6 md:data-[state=open]:zoom-in-95 md:data-[state=open]:slide-in-from-bottom-0",
          )}
        >
          {/* Header */}
          <div className="relative flex items-center gap-3 border-b px-5 py-4 md:px-7">
            {meta ? (() => { const Icon = INCIDENT_ICONS[meta.type]; return (
              <span className={cn("grid size-9 place-items-center rounded-lg border", meta.urgent ? "border-now/40 bg-now/10 text-now" : "bg-secondary")}>
                <Icon className="size-4" />
              </span>); })() : <span className="grid size-9 place-items-center rounded-lg border bg-secondary"><Sparkles className="size-4" /></span>}
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {meta ? (plan?.status ?? meta.short) : "AfterClick"}
              </p>
              <Dialog.Title className="truncate text-base font-semibold tracking-tight md:text-lg">
                {meta ? meta.label : "What happened?"}
              </Dialog.Title>
            </div>
            {meta && (phase === "step" || phase === "full") && (
              <button className="nav-pill hidden sm:inline-flex" onClick={() => setPhase(phase === "full" ? "step" : "full")}>
                {phase === "full" ? "Guided view" : <><ListChecks className="mr-1.5 size-4" />View full plan</>}
              </button>
            )}
            <Dialog.Close className="nav-pill !px-2.5" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-transparent">
              <div className="h-full bg-foreground transition-all duration-500" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-6 md:px-7">
            {open && incident && (phase === "aid" || phase === "questions" || phase === "step") && (
              <div className="mx-auto max-w-xl"><VoiceGuide request={{ incident, facts, ...(provider ? { provider } : {}), section: phase, index: phase === "questions" ? qIndex : phase === "step" ? stepIndex : 0 }} /></div>
            )}
            {phase === "choose" && <Chooser onPick={choose} />}

            {phase === "aid" && meta && (
              <div className="step-in mx-auto max-w-xl space-y-6">
                {meta.urgent && <UrgentBank />}
                <div>
                  <h3 className="font-display text-3xl leading-tight md:text-4xl">
                    {meta.urgent ? "Then, a few details." : "First, take a breath."}
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {meta.firstAid.map((t, i) => (
                      <li key={i} className="flex gap-3 rounded-lg border bg-card p-3.5 text-[15px] leading-relaxed">
                        <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  {questions.length} quick question{questions.length > 1 ? "s" : ""} will tailor your plan. We never ask for passwords, codes, or card numbers.
                </p>
              </div>
            )}

            {phase === "questions" && meta && questions[qIndex] && (
              <div key={questions[qIndex]!.id} className="step-in mx-auto max-w-xl">
                {meta.urgent && qIndex === 0 && <div className="mb-5"><UrgentBank compact /></div>}
                <p className="font-mono text-xs text-muted-foreground">Question {qIndex + 1} of {questions.length}</p>
                <h3 className="mt-2 font-display text-3xl leading-tight md:text-4xl">{questions[qIndex]!.prompt}</h3>
                {questions[qIndex]!.hint && <p className="mt-2 text-sm text-muted-foreground">{questions[qIndex]!.hint}</p>}
                <div role="radiogroup" aria-label={questions[qIndex]!.prompt} className="mt-6 grid gap-2.5">
                  {questions[qIndex]!.options.map((o) => {
                    const sel = facts[questions[qIndex]!.id] === o.value;
                    return (
                      <button key={o.value} role="radio" aria-checked={sel}
                        onClick={() => answer(questions[qIndex]!.id, o.value)}
                        className={cn("flex items-center justify-between rounded-lg border bg-card px-4 py-3.5 text-left text-[15px] transition-all hover:border-foreground/50 focus-visible:outline-2 focus-visible:outline-ring",
                          sel && "border-foreground bg-foreground text-primary-foreground")}>
                        {o.label}{sel && <Check className="size-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {phase === "step" && plan && current && (
              <div className="mx-auto max-w-xl">
                {diff && <DiffBanner diff={diff} onClose={() => setDiff(null)} />}
                <StepDots count={actions.length} index={stepIndex} done={actions.map((x) => done.has(x.id))} onGo={setStepIndex} />
                <article key={current.id + stepIndex} className="step-in mt-5">
                  <div className="flex items-center gap-2">
                    <PriBadge p={current.priority} />
                    <span className="font-mono text-xs text-muted-foreground">Step {stepIndex + 1} of {actions.length}</span>
                  </div>
                  <h3 className={cn("mt-3 font-display text-3xl leading-tight md:text-4xl", done.has(current.id) && "line-through decoration-2 opacity-60")}>{current.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed">{current.instruction}</p>
                  <div className="mt-5 rounded-lg border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why it matters</p>
                    <p className="mt-1.5 text-sm leading-relaxed">{current.why}</p>
                  </div>
                  <div className="mt-3 rounded-lg border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How to do it</p>
                    <ol className="mt-2 space-y-1.5 text-sm">
                      {current.how.map((h, i) => <li key={i} className="flex gap-2.5"><span className="font-mono text-muted-foreground">{i + 1}.</span>{h}</li>)}
                    </ol>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-dashed p-3.5 text-sm"><span className="font-semibold">How to verify: </span>{current.verify}</div>
                    <div className="rounded-lg border border-dashed p-3.5 text-sm"><span className="font-semibold">Done means: </span>{current.completionMeans}</div>
                  </div>
                  <p className="mt-3 font-mono text-[11px] text-muted-foreground">Triggered by: {current.triggeredBy.join(" · ")}</p>
                  {current.resource && (
                    <a href={current.resource.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4">
                      {current.resource.label}<ExternalLink className="size-3.5" />
                    </a>
                  )}
                </article>
              </div>
            )}

            {phase === "full" && restored && (
              <p className="mb-4 rounded-lg border border-safe/30 bg-safe/8 px-3.5 py-2.5 text-sm">
                Welcome back — we restored your saved answers and progress from {new Date(restored).toLocaleString()}. They're stored only on this device.
              </p>
            )}
            {phase === "full" && plan && (
              <FullPlan plan={plan} facts={facts} incident={incident!} done={done} diff={diff}
                onAnswer={answer} onToggle={toggleDone} onCloseDiff={() => setDiff(null)}
                onOpenStep={(i) => { setStepIndex(i); setPhase("step"); }} />
            )}
            {phase === "full" && plan && incident && (
              <CaseFile state={{ incident, facts, plan, done: [...done], analysis: caseContext?.analysis, provider, createdAt: new Date() }} />
            )}
          </div>

          {/* Footer controls */}
          {phase !== "choose" && meta && (
            <div className="flex items-center gap-2 border-t bg-background/60 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] md:px-7">
              {phase === "aid" && <>
                <button className="nav-pill" onClick={() => setPhase("choose")}><ArrowLeft className="mr-1.5 size-4" />Back</button>
                <div className="flex-1" />
                <button className="btn-paper hidden sm:inline-flex" onClick={() => showPlan()}>Skip to plan</button>
                <button className="btn-ink" onClick={() => setPhase("questions")}>Continue<ArrowRight className="size-4" /></button>
              </>}
              {phase === "questions" && <>
                <button className="nav-pill" onClick={() => (qIndex === 0 ? setPhase("aid") : setQIndex(qIndex - 1))}><ArrowLeft className="mr-1.5 size-4" />Back</button>
                <div className="flex-1" />
                <button className="btn-paper hidden sm:inline-flex" onClick={() => (qIndex + 1 < questions.length ? setQIndex(qIndex + 1) : showPlan())}>I'm not sure</button>
                <button className="btn-ink" disabled={!questions[qIndex] || !facts[questions[qIndex]!.id]}
                  onClick={() => (qIndex + 1 < questions.length ? setQIndex(qIndex + 1) : showPlan())}>
                  {qIndex + 1 < questions.length ? "Next" : "See my plan"}<ArrowRight className="size-4" />
                </button>
              </>}
              {phase === "step" && current && <>
                <button className="nav-pill" aria-label="Previous step" onClick={() => (stepIndex === 0 ? (setQIndex(Math.max(questions.length - 1, 0)), setPhase("questions")) : setStepIndex(stepIndex - 1))}>
                  <ArrowLeft className="size-4 sm:mr-1.5" /><span className="hidden sm:inline">Back</span>
                </button>
                <button className="nav-pill sm:hidden" onClick={() => setPhase("full")} aria-label="View full plan"><ListChecks className="size-4" /></button>
                <div className="flex-1" />
                <button className={cn("btn-paper", done.has(current.id) && "border-safe text-safe")} onClick={() => toggleDone(current.id)} aria-pressed={done.has(current.id)}>
                  {done.has(current.id) ? <><CheckCircle2 className="size-4" />Done</> : <><Check className="size-4" />Mark as done</>}
                </button>
                <button className="btn-ink" onClick={() => (stepIndex + 1 < actions.length ? setStepIndex(stepIndex + 1) : setPhase("full"))}>
                  {stepIndex + 1 < actions.length ? "Next" : "Summary"}<ArrowRight className="size-4" />
                </button>
              </>}
              {phase === "full" && <>
                <button className="nav-pill" onClick={() => { if (incident) clearPlan(incident); setRestored(null); setFacts({}); setDone(new Set()); setDiff(null); setQIndex(0); planSeen.current = false; setPhase("aid"); }}>
                  <RotateCcw className="mr-1.5 size-4" />Start over
                </button>
                <div className="flex-1" />
                <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{completed}/{actions.length} done · {plan?.unknowns.length} unverified</span>
                <button className="btn-ink" onClick={() => setPhase("step")}>Guided steps<ArrowRight className="size-4" /></button>
              </>}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Chooser({ onPick }: { onPick: (t: IncidentType) => void }) {
  return (
    <div className="step-in mx-auto max-w-2xl">
      <h3 className="font-display text-3xl md:text-4xl">Tell us what happened.</h3>
      <p className="mt-2 text-sm text-muted-foreground">Pick the closest match. You can change answers later.</p>
      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
        {INCIDENT_ORDER.map((t) => { const Icon = INCIDENT_ICONS[t]; const m = INCIDENTS[t]; return (
          <button key={t} onClick={() => onPick(t)} className="group flex items-start gap-3 rounded-lg border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/50">
            <Icon className={cn("mt-0.5 size-5", m.urgent && "text-now")} />
            <span><span className="block font-medium">{m.label}</span>{m.urgent && <span className="font-mono text-[11px] uppercase text-now">Urgent</span>}</span>
          </button>); })}
      </div>
    </div>
  );
}

function UrgentBank({ compact }: { compact?: boolean }) {
  return (
    <div role="alert" className="rounded-xl border-2 border-now/50 bg-now/8 p-4">
      <div className="flex items-center gap-2 text-now"><Phone className="size-4" /><p className="text-sm font-semibold">Call your bank or payment provider now</p></div>
      {!compact && <ul className="mt-2 space-y-1 text-sm leading-relaxed">
        <li>• Use the number on the back of your card, your statement, or the official app.</li>
        <li>• Never use a number, link, or "agent" the scammer gave you.</li>
        <li>• Ask them to stop, reverse or flag the payment. Recovery isn't guaranteed — speed helps.</li>
      </ul>}
    </div>
  );
}

function PriBadge({ p }: { p: Priority }) {
  return <span className={cn("rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide", PRI_STYLE[p])}>{PRIORITY_LABEL[p]}</span>;
}

function StepDots({ count, index, done, onGo }: { count: number; index: number; done: boolean[]; onGo: (i: number) => void }) {
  return (
    <div className="flex gap-1.5" role="tablist" aria-label="Plan steps">
      {Array.from({ length: count }).map((_, i) => (
        <button key={i} role="tab" aria-selected={i === index} aria-label={`Step ${i + 1}${done[i] ? " (done)" : ""}`} onClick={() => onGo(i)}
          className={cn("h-1.5 flex-1 rounded-full transition-all", done[i] ? "bg-safe" : i === index ? "bg-foreground" : "bg-foreground/15")} />
      ))}
    </div>
  );
}

function DiffBanner({ diff, onClose }: { diff: PlanDiff; onClose: () => void }) {
  return (
    <div className="step-in mb-5 rounded-lg border border-verify/30 bg-verify/8 p-3.5 text-sm">
      <div className="flex items-center justify-between"><p className="font-semibold">What changed</p>
        <button onClick={onClose} aria-label="Dismiss changes" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button></div>
      <ul className="mt-1.5 space-y-0.5">
        {diff.added.map((a) => <li key={"a" + a.id}><span className="font-mono text-safe">+ </span>{a.title} <span className="text-muted-foreground">({a.triggeredBy.join(", ")})</span></li>)}
        {diff.removed.map((a) => <li key={"r" + a.id} className="text-muted-foreground"><span className="font-mono text-now">− </span><span className="line-through">{a.title}</span></li>)}
        {diff.reprioritized.map((r) => <li key={"p" + r.action.id}><span className="font-mono">↕ </span>{r.action.title}: {PRIORITY_LABEL[r.from]} → {PRIORITY_LABEL[r.to]}</li>)}
        {diff.firstChanged && !diff.added.length && !diff.removed.length && <li>Your first step changed.</li>}
      </ul>
    </div>
  );
}

function FullPlan({ plan, facts, incident, done, diff, onAnswer, onToggle, onCloseDiff, onOpenStep }: {
  plan: Plan; facts: Facts; incident: IncidentType; done: Set<string>; diff: PlanDiff | null;
  onAnswer: (id: FactKey, v: string) => void; onToggle: (id: string) => void; onCloseDiff: () => void; onOpenStep: (i: number) => void;
}) {
  const qs = activeQuestions(incident, facts);
  const remaining = plan.actions.filter((a) => !done.has(a.id));
  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your answers</p>
        {qs.map((q) => (
          <div key={q.id}>
            <p className="text-sm font-medium leading-snug">{q.prompt}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {q.options.map((o) => (
                <button key={o.value} onClick={() => onAnswer(q.id, o.value)} aria-pressed={facts[q.id] === o.value}
                  className={cn("rounded-md border px-2.5 py-1 text-xs transition-colors hover:border-foreground/50", facts[q.id] === o.value && "border-foreground bg-foreground text-primary-foreground")}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2 border-t pt-4 text-center">
          <Stat n={done.size && plan.actions.filter((a) => done.has(a.id)).length} l="Done" />
          <Stat n={remaining.length} l="Left" />
          <Stat n={plan.unknowns.length} l="Unverified" />
        </div>
      </aside>
      <div className="min-w-0 space-y-5">
        {INCIDENTS[incident].urgent && <UrgentBank compact />}
        {diff && <DiffBanner diff={diff} onClose={onCloseDiff} />}
        <ol className="relative space-y-3 border-l border-foreground/20 pl-5">
          {plan.actions.map((a, i) => (
            <li key={a.id} className="relative">
              <span className={cn("absolute -left-[27px] top-4 grid size-3.5 place-items-center rounded-full border-2 bg-paper", done.has(a.id) ? "border-safe bg-safe" : "border-foreground")} />
              <div className="rounded-lg border bg-card p-3.5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <PriBadge p={a.priority} />
                    <button onClick={() => onOpenStep(i)} className={cn("mt-1.5 block text-left font-medium hover:underline", done.has(a.id) && "text-muted-foreground line-through")}>{a.title}</button>
                    <p className="mt-0.5 text-sm text-muted-foreground">{a.instruction}</p>
                  </div>
                  <button onClick={() => onToggle(a.id)} aria-pressed={done.has(a.id)} aria-label={`Mark "${a.title}" as done`}
                    className={cn("grid size-8 shrink-0 place-items-center rounded-md border transition-colors", done.has(a.id) ? "border-safe bg-safe text-primary-foreground" : "hover:border-foreground")}>
                    <Check className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div className="grid gap-3 sm:grid-cols-2">
          <Box icon={<AlertTriangle className="size-4 text-now" />} title="Unresolved risks" items={plan.risks} />
          <Box icon={<HelpCircle className="size-4 text-verify" />} title="Not yet verified" items={plan.unknowns.length ? plan.unknowns : ["Nothing pending from your answers."]} />
        </div>
        <p className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
          Marking a step done records your progress only. AfterClick can't see your accounts and can't confirm that anything is secure or recovered — only your provider can.
        </p>
        {plan.resources.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Official resources</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {plan.resources.map((r) => (
                <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm hover:border-foreground/50">{r.label}<ExternalLink className="size-3" /></a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return <div><p className="font-mono text-lg font-medium">{n}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>;
}

function Box({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="rounded-lg border bg-card p-3.5">
      <p className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{items.map((t) => <li key={t}>• {t}</li>)}</ul>
    </div>
  );
}
