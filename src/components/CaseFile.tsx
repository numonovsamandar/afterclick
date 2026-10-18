import { Check, ClipboardCopy, Download, FileText, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { createIncidentReport, createIncidentSummary, createSupportInquiry, type IncidentState } from "@/lib/report";

export function CaseFile({ state }: { state: IncidentState }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [inquiry, setInquiry] = useState(() => createSupportInquiry(state));
  const [showInquiry, setShowInquiry] = useState(false);
  const key = `${state.incident}|${JSON.stringify(state.facts)}`;
  useEffect(() => { setInquiry(createSupportInquiry(state)); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function copy(id: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1800); } catch { setCopied("fail"); }
  }
  function download() {
    const blob = new Blob([createIncidentReport(state)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `afterclick-case-${state.incident}-${state.createdAt.toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section aria-label="Incident case file" className="mt-6 rounded-xl border-2 border-foreground/70 bg-card p-4">
      <p className="flex items-center gap-2 font-semibold"><FileText className="size-4" />Incident case file</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Built from your current answers{state.analysis ? ", the inspected message and its links" : ""}. It stays on this device. Steps you mark done are self-reported — not proof anything is recovered.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-paper !h-9 text-sm" onClick={() => copy("summary", createIncidentSummary(state))}>
          {copied === "summary" ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}{copied === "summary" ? "Copied" : "Copy summary"}
        </button>
        <button className="btn-ink !h-9 text-sm" onClick={download}><Download className="size-4" />Download report</button>
        <button className="btn-paper !h-9 text-sm" onClick={() => setShowInquiry((v) => !v)} aria-expanded={showInquiry}><Mail className="size-4" />Support inquiry</button>
      </div>
      {showInquiry && (
        <div className="mt-3">
          <textarea value={inquiry} onChange={(e) => setInquiry(e.target.value)} rows={12} aria-label="Editable support inquiry"
            className="w-full resize-y rounded-lg border bg-paper p-3 font-mono text-[12.5px] leading-relaxed outline-none focus:border-foreground/60" />
          <button className="nav-pill mt-1" onClick={() => copy("inquiry", inquiry)}>{copied === "inquiry" ? "Copied" : "Copy inquiry"}</button>
        </div>
      )}
      {copied === "fail" && <p className="mt-2 text-xs text-now">Couldn't copy automatically — use Download instead.</p>}
    </section>
  );
}
