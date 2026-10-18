import { useState, useEffect, useCallback } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, ShieldQuestion,
  ExternalLink, Copy, RotateCcw, CheckCircle2,
  KeyRound, MessageSquareWarning, DollarSign, MousePointerClick, MonitorSmartphone,
  ChevronDown, ChevronUp, Link as LinkIcon
} from 'lucide-react';
import { analyzeMessage, highlightSegments, type Analysis, type Finding } from '@/lib/inspector';
import { getIncidentUrl, WEBSITE_URL } from '@/lib/constants';
import { AiExplanation } from '@/components/AiExplanation';

export function InspectPage() {
  const [text, setText] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Read selected text passed from background service worker
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      chrome.storage.session.get(['selectedText', 'selectedFrom'], (result) => {
        const selected = result.selectedText as string | undefined;
        const from = result.selectedFrom as string | undefined;
        if (selected) {
          setText(selected);
          setSourceUrl(from || '');
          setAnalysis(analyzeMessage(selected));
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const handleManualAnalyze = (newText: string) => {
    setText(newText);
    setAnalysis(null);
  };

  const copyFindings = useCallback(() => {
    if (!analysis) return;
    const lines: string[] = ['AfterClick Companion — Selected Text Analysis', ''];
    if (sourceUrl) {
      lines.push(`Source page: ${sourceUrl}`, '');
    }
    lines.push(`Result: ${analysis.headline}`);
    lines.push(`Level: ${analysis.level}`);
    lines.push('');

    if (analysis.findings.length) {
      lines.push('Observed warning signs:');
      for (const f of analysis.findings) {
        lines.push(`- [${f.severity.toUpperCase()}] ${f.title}: ${f.explanation}`);
        if (f.evidence.length) {
          lines.push(`  Evidence: ${f.evidence.map((e) => `"${e.text}"`).join(', ')}`);
        }
      }
      lines.push('');
    }

    if (analysis.urls.length) {
      lines.push('Extracted links (not visited):');
      for (const u of analysis.urls) {
        lines.push(`- ${u.raw} → Real registered domain: ${u.registrableDomain ?? u.hostname ?? 'unparsable'}`);
        if (u.issues.length) {
          lines.push(`  Issues: ${u.issues.map((i) => i.message).join(' ')}`);
        }
      }
      lines.push('');
    }

    if (analysis.needsVerification.length) {
      lines.push('Needs independent verification:');
      for (const n of analysis.needsVerification) {
        lines.push(`- ${n}`);
      }
      lines.push('');
    }

    lines.push('---', 'These findings come from local rules. Optional AI explanations are separate. Findings are informational and do not guarantee safety.');
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [analysis, sourceUrl]);

  const openWebsite = (url: string) => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  };

  const clearSelection = () => {
    setText('');
    setAnalysis(null);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      chrome.storage.session.remove(['selectedText', 'selectedFrom']);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-foreground/10 bg-paper/80 backdrop-blur sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center font-bold">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              After<span className="font-normal">Click</span>
              <span className="ml-2 text-xs font-mono font-normal text-muted-foreground uppercase tracking-wider">
                Scam Analysis
              </span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openWebsite(WEBSITE_URL)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-paper px-3 py-1.5 text-xs font-medium hover:border-foreground/50 transition-colors"
          >
            <span>Open AfterClick Home</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 space-y-6">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground text-sm">
            Loading selection...
          </div>
        ) : (
          <>
            {/* Header / Intro */}
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Selected Text & Message Inspector</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Deterministic, safe analysis performed locally in your browser. Links are never visited.
              </p>
              {sourceUrl && (
                <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                  Source: {sourceUrl}
                </p>
              )}
            </div>

            {/* Input / Highlighted Box */}
            <div className="rounded-xl border border-foreground/15 bg-paper/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Analyzed Text
                </span>
                <div className="flex items-center gap-2">
                  {analysis && <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setAnalysis(null)}>Edit text</button>}
                  <button
                    onClick={clearSelection}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Clear / Reset
                  </button>
                </div>
              </div>

              {analysis && text ? (
                <div className="p-4 rounded-lg bg-background border border-foreground/10 font-mono text-sm leading-relaxed whitespace-pre-wrap select-text break-words">
                  {highlightSegments(text, analysis.findings).map((seg, idx) => {
                    if (!seg.severity) return <span key={idx}>{seg.text}</span>;
                    const bg =
                      seg.severity === 'high'
                        ? 'bg-now/20 text-now underline decoration-now/50'
                        : seg.severity === 'medium'
                        ? 'bg-caution/25 text-caution underline decoration-caution/50'
                        : 'bg-foreground/10 text-foreground';
                    return (
                      <mark key={idx} className={`${bg} rounded px-1 py-0.5 mx-0.5 font-semibold`}>
                        {seg.text}
                      </mark>
                    );
                  })}
                </div>
              ) : (
                <>
                <textarea
                  aria-label="Message to inspect"
                  value={text}
                  onChange={(e) => handleManualAnalyze(e.target.value)}
                  placeholder="Highlight text on any page and right-click 'Analyze with AfterClick', or paste text here to inspect..."
                  rows={4}
                  className="w-full p-3 rounded-lg bg-background border border-foreground/10 font-mono text-sm leading-relaxed focus:outline-none focus:border-foreground/40"
                />
                <button disabled={!text.trim()} onClick={() => setAnalysis(analyzeMessage(text))} className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold disabled:opacity-40">Inspect message</button>
                </>
              )}
            </div>

            {/* Analysis Findings */}
            {analysis && (
              <div className="space-y-6">
                {/* Headline Banner */}
                <div
                  className={`rounded-xl p-4 flex items-start gap-3 border ${
                    analysis.level === 'warning-signs'
                      ? 'bg-now/10 border-now/30'
                      : analysis.level === 'some-signs'
                      ? 'bg-caution/10 border-caution/30'
                      : 'bg-foreground/5 border-foreground/15'
                  }`}
                >
                  {analysis.level === 'warning-signs' ? (
                    <ShieldAlert className="w-6 h-6 text-now shrink-0 mt-0.5" />
                  ) : analysis.level === 'some-signs' ? (
                    <ShieldQuestion className="w-6 h-6 text-caution shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className="w-6 h-6 text-foreground/60 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base">{analysis.headline}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {analysis.level === 'warning-signs'
                        ? 'This text contains strong indicators typically associated with phishing, credential harvesting, or extortion attempts.'
                        : analysis.level === 'some-signs'
                        ? 'Some concerning patterns were detected. Do not click links or provide credentials before verifying.'
                        : "No known automated red flags were spotted, but this does NOT mean the message is guaranteed authentic. Always verify unexpected requests independently."}
                    </p>
                  </div>
                </div>

                <AiExplanation input={{ text, url: sourceUrl, links: [] }} />
                {/* Warning Signs Grid */}
                {analysis.findings.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      Specific Warning Signs ({analysis.findings.length})
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {analysis.findings.map((f, i) => (
                        <FindingCard key={i} finding={f} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted URLs */}
                {analysis.urls.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      Extracted Links ({analysis.urls.length}) — Safely Dissected
                    </h4>
                    <div className="space-y-2">
                      {analysis.urls.map((u, i) => (
                        <div key={i} className="rounded-lg border border-foreground/10 bg-paper/60 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="font-mono text-xs break-all font-medium">{u.raw}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-foreground/5">
                            <div>
                              <span className="text-muted-foreground">Hostname: </span>
                              <span className="font-mono">{u.hostname ?? 'none'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Registered Domain: </span>
                              <span className="font-mono font-semibold">{u.registrableDomain ?? 'unregistered/raw'}</span>
                            </div>
                          </div>
                          {u.issues.length > 0 && (
                            <div className="space-y-1 pt-1">
                              {u.issues.map((iss, j) => (
                                <p key={j} className="text-xs text-now flex items-start gap-1">
                                  <span>•</span>
                                  <span>{iss.message}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unknowns & Things to verify */}
                {analysis.needsVerification.length > 0 && (
                  <div className="rounded-xl border border-foreground/10 bg-paper/60 p-4 space-y-2">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      What Needs Independent Verification
                    </h4>
                    <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                      {analysis.needsVerification.map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions Bar */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-foreground/10">
                  <button
                    onClick={copyFindings}
                    className="inline-flex items-center gap-2 rounded-lg border border-foreground/20 bg-paper px-4 py-2.5 text-xs font-semibold hover:border-foreground/50 transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-safe" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied to Clipboard' : 'Copy Sanitized Findings'}
                  </button>

                  {analysis.suggested && (
                    <button
                      onClick={() => openWebsite(getIncidentUrl(analysis.suggested!))}
                      className="inline-flex items-center gap-2 rounded-lg bg-now text-white px-4 py-2.5 text-xs font-semibold hover:bg-now/90 transition-colors"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>Start Emergency Guide ({analysis.suggested})</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Immediate response picker */}
                <div className="rounded-xl border border-now/25 bg-now/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-now" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-now">
                      Did you interact with this message?
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    If you clicked links, entered a password, sent money, or ran files, launch AfterClick's step-by-step first-aid checklist immediately:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                    {[
                      { type: 'password', label: 'Entered password', icon: KeyRound },
                      { type: 'code', label: 'Shared 2FA code', icon: MessageSquareWarning },
                      { type: 'payment', label: 'Sent money / fee', icon: DollarSign },
                      { type: 'link', label: 'Clicked suspicious link', icon: MousePointerClick },
                      { type: 'remote', label: 'Granted remote control', icon: MonitorSmartphone },
                    ].map(({ type, label, icon: Icon }) => (
                      <button
                        key={type}
                        onClick={() => openWebsite(getIncidentUrl(type))}
                        className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-background px-3 py-2 text-xs font-medium hover:border-foreground/40 transition-colors text-left"
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{label}</span>
                        <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-foreground/10 bg-paper/50 py-4 px-6 text-center text-xs text-muted-foreground">
        AfterClick Companion is an open-source cybersecurity first-aid companion. Never gives false safety guarantees.
      </footer>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div
      className={`rounded-lg p-3 border transition-all ${
        finding.severity === 'high'
          ? 'bg-now/5 border-now/20'
          : finding.severity === 'medium'
          ? 'bg-caution/5 border-caution/20'
          : 'bg-foreground/3 border-foreground/10'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span
            className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
              finding.severity === 'high'
                ? 'text-now'
                : finding.severity === 'medium'
                ? 'text-caution'
                : 'text-muted-foreground'
            }`}
          >
            {finding.severity} priority
          </span>
          <h5 className="text-xs font-semibold mt-0.5">{finding.title}</h5>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground mt-0.5"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <p>{finding.explanation}</p>
          {finding.evidence.length > 0 && (
            <div className="pt-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                Detected Phrases:
              </span>
              <div className="flex flex-wrap gap-1">
                {finding.evidence.map((e, idx) => (
                  <span
                    key={idx}
                    className="font-mono text-[10px] bg-background border border-foreground/10 rounded px-1.5 py-0.5 font-medium text-foreground"
                  >
                    "{e.text}"
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
