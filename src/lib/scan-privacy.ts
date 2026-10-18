/** Best-effort redaction for opt-in cloud explanations; users review before sending. */
export function redactScanUrl(raw: string): string {
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw.replace(/^hxxp/i, "http") : `https://${raw}`);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    return `${url.protocol}//${url.username || url.password ? 'redacted@' : ''}${url.host}/`;
  } catch { return ''; }
}

export function redactScanText(text: string): string {
  const urls: string[] = [];
  return text.slice(0, 15_000)
    .replace(/\b(?:(?:https?:\/\/|hxxps?:\/\/|www\.)[^\s<>"']+|(?:[a-z0-9-]+\.)+[a-z]{2,24}\/[^\s<>"']*)/gi, (url) => {
      const index = urls.push(redactScanUrl(url)) - 1;
      return `⟦url${index}⟧`;
    })
    .replace(/\bsk[-_][a-z0-9_-]{12,}\b/gi, '[redacted key]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
    .replace(/\b(password|passcode|pin|api[_ -]?key|token|secret)\s*[:=]\s*\S+/gi, '$1: [redacted]')
    .replace(/\b\d(?:[\d -]{2,}\d)\b/g, '[redacted number]')
    .replace(/⟦url(\d+)⟧/g, (_match, index: string) => urls[Number(index)] ?? '');
}

export interface CloudScanInput { text: string; url: string; links: { text: string; href: string }[] }
export function prepareCloudScan(input: CloudScanInput): CloudScanInput {
  return {
    text: redactScanText(input.text), url: redactScanUrl(input.url),
    links: input.links.slice(0, 50).map((l) => ({ text: redactScanText(l.text).slice(0, 200), href: redactScanUrl(l.href) })).filter((l) => l.href),
  };
}
