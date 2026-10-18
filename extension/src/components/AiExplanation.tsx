import { useEffect, useRef, useState } from 'react';
import { prepareCloudScan, type CloudScanInput } from '../../../src/lib/scan-privacy';

declare const __AFTERCLICK_API_ORIGIN__: string;
interface Result { message: string; findings: { id: string; title: string; evidence: string; aiExplanation: string }[] }

export function AiExplanation({ input }: { input: CloudScanInput }) {
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [approved, setApproved] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const identity = JSON.stringify(input);
  const clean = prepareCloudScan(input);
  useEffect(() => {
    setReview(false); setResult(null); setError(''); setBusy(false); setApproved(false);
    return () => { controller.current?.abort(); controller.current = null; };
  }, [identity]);

  async function explain() {
    const abort = new AbortController(); controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 55_000);
    setBusy(true); setError('');
    try {
      const response = await fetch(`${__AFTERCLICK_API_ORIGIN__}/api/extension/explain`, {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clean), signal: abort.signal,
      });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The AI server is not available yet. Local inspection still works.');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI explanation unavailable.');
      if (!Array.isArray(data.findings) || typeof data.message !== 'string') throw new Error('Invalid AI response.');
      if (!abort.signal.aborted) { setResult(data); setReview(false); }
    } catch (e) {
      if (controller.current === abort) setError(abort.signal.aborted ? 'Request stopped or timed out. Try again.' : e instanceof Error ? e.message : 'Could not connect to AI. Local inspection still works.');
    } finally { clearTimeout(timer); if (controller.current === abort) setBusy(false); }
  }

  return <section className="rounded-xl border border-foreground/15 bg-paper/60 p-3 space-y-2">
    <h3 className="text-sm font-semibold">Understand this scan</h3>
    <p className="text-xs text-muted-foreground">Optional OpenAI explanations connect the observed warning signs. They do not change the local findings or verify that a page is safe.</p>
    {!review && !result && <button className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold" onClick={() => setReview(true)}>Review AI scan</button>}
    {review && <>
      <p className="text-xs text-muted-foreground">The preview below goes to AfterClick’s server. Only findings and their evidence go to OpenAI. Common secrets and URL paths are removed, but redaction can miss personal information. Nothing is sent until you choose Send.</p>
      <details className="text-xs"><summary className="cursor-pointer font-medium">Preview exactly what will be sent</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2">{JSON.stringify(clean, null, 2)}</pre></details>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={approved} disabled={busy} onChange={(e) => setApproved(e.target.checked)} />I reviewed the preview and want to share it for an AI explanation.</label>
      <div className="flex gap-2"><button disabled={!approved || busy} className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold disabled:opacity-40" onClick={() => void explain()}>{busy ? 'Explaining…' : 'Send to OpenAI'}</button><button className="text-xs underline" onClick={() => { controller.current?.abort(); controller.current = null; setBusy(false); setReview(false); setApproved(false); }}>Cancel</button></div>
    </>}
    {error && <p role="alert" className="text-xs text-now">{error}</p>}
    {result && <div className="space-y-3" aria-live="polite">
      <p className="text-xs text-muted-foreground">{result.message}</p>
      {result.findings.map((f) => <article key={f.id} className="border-t border-foreground/10 pt-2 space-y-1"><h4 className="text-xs font-semibold">{f.title}</h4><p className="text-xs">{f.aiExplanation}</p><p className="text-[11px] font-mono break-all text-muted-foreground">Evidence: {f.evidence}</p></article>)}
    </div>}
  </section>;
}
