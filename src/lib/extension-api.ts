import { CloudScanSchema, explainScan } from './extension-explanation';

let windowStart = 0;
let count = 0;

export async function handleExtensionApi(request: Request): Promise<Response> {
  const origin = request.headers.get('origin') || '';
  const allowed = /^chrome-extension:\/\/[a-p]{32}$/.test(origin) || origin === new URL(request.url).origin;
  if (!allowed) return Response.json({ error: 'Origin not allowed.' }, { status: 403 });
  const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin', 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return Response.json({ error: 'Use POST.' }, { status: 405, headers });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: 'JSON required.' }, { status: 415, headers });
  // Stream with a hard limit instead of trusting Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: 'Missing scan.' }, { status: 400, headers });
  let body = ''; let bytes = 0; const decoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.length;
      if (bytes > 150_000) { await reader.cancel(); return Response.json({ error: 'Scan is too large.' }, { status: 413, headers }); }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    const parsed = CloudScanSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return Response.json({ error: 'Invalid scan.' }, { status: 400, headers });
    if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); count = 0; }
    if (count >= 12) return Response.json({ error: 'AI is busy. Please wait a minute; local scans still work.' }, { status: 429, headers });
    count++;
    try { return Response.json(await explainScan(parsed.data), { headers }); }
    catch (error) { return Response.json({ error: error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'AI timed out. Please retry.' }, { status: 503, headers }); }
  } catch { return Response.json({ error: 'Invalid scan request.' }, { status: 400, headers }); }
}
