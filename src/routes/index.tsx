import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, ScanSearch, X } from "lucide-react";
import { ScanModal, type CaseContext } from "@/components/ScanModal";
import { listPlans } from "@/lib/saved-plans";
import hero from "@/assets/hero-halftone.jpg";
import { IncidentModal } from "@/components/IncidentModal";
import { INCIDENT_ICONS } from "@/components/incident-icons";
import { INCIDENTS, INCIDENT_ORDER, type Facts, type IncidentType } from "@/lib/engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AfterClick — What you do next matters" },
      { name: "description", content: "Clicked something suspicious, shared a password or sent money? Get a calm, personalized response plan in minutes." },
      { property: "og:title", content: "AfterClick — Cybersecurity first aid" },
      { property: "og:description", content: "Tell us what happened. We'll help you understand what to do next." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const DEMO: Facts = { access: "yes", reuse: "unknown", mfa: "no" };

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M9.5 14.5 7.8 16.2a3.2 3.2 0 0 1-4.5-4.5L6 9" />
      <path d="M14.5 9.5l1.7-1.7a3.2 3.2 0 0 1 4.5 4.5L18 15" />
      <path d="M10 3.5v2.2M3.5 10h2.2M14 20.5v-2.2M20.5 14h-2.2" strokeWidth="1.8" />
    </svg>
  );
}

function Index() {
  const [open, setOpen] = useState(false);
  const [incident, setIncident] = useState<IncidentType | null>(null);
  const [facts, setFacts] = useState<Facts | undefined>();
  const [menu, setMenu] = useState(false);
  const [scan, setScan] = useState(false);
  const [ctx, setCtx] = useState<CaseContext | undefined>();
  const [saved, setSaved] = useState<IncidentType[]>([]);
  useEffect(() => {
    const read = () => setSaved(Object.keys(listPlans()) as IncidentType[]);
    read();
    window.addEventListener("afterclick:plans", read);

    // Safe handoff from AfterClick Companion extension
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const inc = p.get("incident");
      if (inc && INCIDENT_ORDER.includes(inc as IncidentType)) {
        launch(inc as IncidentType);
      }
    }

    return () => window.removeEventListener("afterclick:plans", read);
  }, []);

  const launch = (t: IncidentType | null, f?: Facts, c?: CaseContext) => { setIncident(t); setFacts(f); setCtx(c); setOpen(true); setMenu(false); };

  return (
    <div className="relative">
      <div className="relative min-h-dvh overflow-hidden md:h-dvh">
      <img src={hero} alt="" width={1920} height={1088} className="hero-zoom pointer-events-none absolute inset-0 h-full w-full object-cover object-[75%_center]" />
      <div className="halftone pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />

      <div className="relative z-10 grid min-h-dvh grid-rows-[auto_1fr_auto] md:h-dvh">
        {/* Header */}
        <header className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-4 pt-5 md:grid-cols-[1fr_auto_1fr] md:px-10">
          <a href="/" className="appear-scale inline-flex items-center gap-2 text-[17px] font-semibold tracking-tight" aria-label="AfterClick">
            <Logo />After<span className="font-normal">Click</span>
          </a>
          <nav aria-label="Incidents" className={cn(
            "md:flex md:items-center md:gap-1",
            menu ? "fixed inset-0 z-40 flex flex-col items-stretch justify-center gap-2 bg-background/90 px-6 backdrop-blur-xl" : "hidden",
          )}>
            {INCIDENT_ORDER.slice(0, 4).map((t, i) => (
              <button key={t} onClick={() => launch(t)} style={{ "--d": `${0.1 + i * 0.1}s` } as React.CSSProperties}
                className="nav-pill appear justify-center max-md:h-14 max-md:text-lg">{INCIDENTS[t].short}</button>
            ))}
          </nav>
          <div className="flex items-center gap-2 justify-self-end">
            <button onClick={() => launch(null)} className="btn-paper appear-scale !h-10 !px-4 text-sm" style={{ "--d": "0.3s" } as React.CSSProperties}>Get help now</button>
            <button onClick={() => setMenu(!menu)} className="nav-pill relative z-50 border-foreground/20 !px-2.5 md:hidden" aria-expanded={menu} aria-label={menu ? "Close menu" : "Open menu"}>
              {menu ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </header>

        {/* Hero — bottom-anchored */}
        <main className="flex items-end px-5 pb-8 pt-14 md:px-10 md:pb-10">
          <div className="max-w-3xl">
            <span className="appear inline-flex items-center gap-2 rounded-md border border-foreground/20 bg-paper/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider backdrop-blur" style={{ "--d": "0.2s" } as React.CSSProperties}>
              <span className="size-1.5 rounded-full bg-safe" />Cybersecurity first aid
            </span>
            <h1 className="mt-5 font-display text-[44px] leading-[0.98] tracking-tight sm:text-6xl lg:text-[76px]">
              <span className="block overflow-hidden pb-1"><span className="appear-mask block" style={{ "--d": "0.4s" } as React.CSSProperties}>What you do next</span></span>
              <span className="block overflow-hidden pb-2"><span className="appear-mask block text-muted-foreground" style={{ "--d": "0.55s" } as React.CSSProperties}>
                matters<span className="font-serif text-[1.05em] italic">, calmly.</span></span></span>
            </h1>
            <p className="appear mt-4 max-w-md text-[16px] leading-relaxed text-foreground/75" style={{ "--d": "0.75s" } as React.CSSProperties}>
              Clicked something suspicious? Shared a password? Sent money to the wrong person? Pick what happened and follow a plan built for your situation.
            </p>

            <div className="appear mt-6 flex flex-col gap-2.5 sm:flex-row" style={{ "--d": "0.9s" } as React.CSSProperties}>
              <button onClick={() => launch(null)} className="btn-ink">Start a response plan<ArrowRight className="size-4" /></button>
              <button onClick={() => setScan(true)} className="btn-paper"><ScanSearch className="size-4" />Check a suspicious message</button>
              <button onClick={() => launch("password", DEMO)} className="btn-paper">Try demo</button>
            </div>

            <div className="mt-7">
              <p className="appear font-mono text-[11px] uppercase tracking-wider text-muted-foreground" style={{ "--d": "1s" } as React.CSSProperties}>What happened?</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {INCIDENT_ORDER.map((t, i) => { const Icon = INCIDENT_ICONS[t]; const m = INCIDENTS[t]; return (
                  <button key={t} onClick={() => launch(t)} style={{ "--d": `${1.05 + i * 0.07}s` } as React.CSSProperties}
                    className={cn("appear inline-flex items-center gap-2 rounded-lg border bg-paper/85 px-3.5 py-2.5 text-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-foreground/60",
                      m.urgent ? "border-now/50" : "border-foreground/20")}>
                    <Icon className={cn("size-4", m.urgent && "text-now")} />{m.label}
                    {saved.includes(t) && <span className="rounded bg-safe/15 px-1.5 font-mono text-[10px] uppercase text-safe">resume</span>}
                    {m.urgent && <span className="rounded bg-now/12 px-1.5 font-mono text-[10px] uppercase text-now">urgent</span>}
                  </button>); })}
              </div>
            </div>
          </div>
        </main>

        {/* Stats / process footer */}
        <footer className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-foreground/15 bg-paper/60 px-5 py-4 text-sm backdrop-blur md:flex md:justify-between md:px-10">
          {["Tell us what happened", "See what needs attention", "Follow your plan", "Track what's unresolved"].map((s, i) => (
            <div key={s} className="appear flex items-center gap-3" style={{ "--d": `${1.3 + i * 0.12}s` } as React.CSSProperties}>
              <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>{s}
            </div>
          ))}
        </footer>
      </div>
      </div>

      {/* First moves — pulled straight from the rules engine */}
      <section aria-labelledby="first-moves" className="relative border-t border-foreground/15 px-5 py-20 md:px-10 md:py-28">
        <div className="halftone pointer-events-none absolute inset-0 opacity-30 [mask-image:linear-gradient(to_bottom,transparent,black_30%,transparent)]" />
        <div className="relative mx-auto max-w-6xl">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">The first few minutes</p>
          <h2 id="first-moves" className="mt-3 max-w-2xl font-display text-4xl leading-[1.02] tracking-tight md:text-6xl">
            Your first move, <span className="font-serif italic text-muted-foreground">for each situation.</span>
          </h2>
          <p className="mt-4 max-w-lg text-foreground/75">Every situation starts differently. Here's what to do first — then open the full plan to get steps tailored to you.</p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INCIDENT_ORDER.map((t, i) => { const Icon = INCIDENT_ICONS[t]; const m = INCIDENTS[t]; return (
              <article key={t} className={cn("group flex flex-col rounded-xl border bg-paper/90 p-6 shadow-[var(--shadow-card)] backdrop-blur transition-transform hover:-translate-y-1",
                m.urgent ? "border-now/50" : "border-foreground/15")}>
                <div className="flex items-center justify-between">
                  <span className={cn("grid size-10 place-items-center rounded-lg border", m.urgent ? "border-now/40 text-now" : "border-foreground/20")}><Icon className="size-5" /></span>
                  <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{m.label}</h3>
                {m.urgent && <span className="mt-2 w-fit rounded bg-now/12 px-1.5 font-mono text-[10px] uppercase text-now">Act now</span>}
                <ul className="mt-4 flex-1 space-y-2 text-sm leading-relaxed text-foreground/80">
                  {m.firstAid.slice(0, 2).map((a) => (
                    <li key={a} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/50" />{a}</li>
                  ))}
                </ul>
                <button onClick={() => launch(t)} className="btn-paper mt-6 w-full">
                  {saved.includes(t) ? "Resume my plan" : "Open full plan"}<ArrowRight className="size-4" />
                </button>
              </article>); })}
            <article className="flex flex-col justify-between rounded-xl border border-foreground bg-primary p-6 text-primary-foreground">
              <div>
                <ScanSearch className="size-6" />
                <h3 className="mt-5 text-lg font-semibold tracking-tight">Not sure what happened?</h3>
                <p className="mt-2 text-sm leading-relaxed opacity-80">Paste the message or a screenshot and we'll point out warning signs and suggest the right plan.</p>
              </div>
              <button onClick={() => setScan(true)} className="btn-paper mt-6 w-full">Check a message</button>
            </article>
          </div>

          <p className="mt-10 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            AfterClick gives general guidance and can't confirm whether an account or device is safe. Only your bank, provider or the service itself can do that.
          </p>
        </div>
      </section>

      <ScanModal open={scan} onOpenChange={setScan} onOpenPlan={(t, f, c) => { setScan(false); launch(t, f, c); }} />
      <IncidentModal open={open} onOpenChange={setOpen} incident={incident} initialFacts={facts} caseContext={ctx} />
    </div>
  );
}
