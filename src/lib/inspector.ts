/**
 * AfterClick Scam Inspector — deterministic, explainable message & URL analysis.
 * Never fetches, opens or resolves submitted links. Every finding cites the
 * exact text that triggered it. No confidence percentages, no "safe" verdicts.
 */
import { parse } from "tldts";
import type { IncidentType, ProviderId } from "./engine";

export type Severity = "high" | "medium" | "low";

export interface Evidence {
  text: string;
  start: number;
  end: number;
}

export interface Finding {
  id: string;
  kind: "urgency" | "credentials" | "code" | "payment" | "sensitive" | "threat" | "url" | "brand";
  severity: Severity;
  title: string;
  explanation: string;
  evidence: Evidence[];
}

export interface DomainAnalysis {
  raw: string;
  start: number;
  end: number;
  hostname: string | null;
  registrableDomain: string | null;
  subdomain: string | null;
  publicSuffix: string | null;
  isIp: boolean;
  protocol: string | null;
  officialFor: ProviderBrand | null;
  issues: { id: string; severity: Severity; message: string }[];
}

export interface Analysis {
  input: string;
  urls: DomainAnalysis[];
  findings: Finding[];
  brands: ProviderBrand[];
  provider: ProviderId | undefined;
  level: "warning-signs" | "some-signs" | "no-known-signs";
  headline: string;
  needsVerification: string[];
  suggested: IncidentType | null;
}

/* ---------------- Brands ---------------- */
export interface ProviderBrand {
  id: string;
  name: string;
  /** Registrable domains (eTLD+1) the brand actually operates. */
  domains: string[];
  /** Words in text that mean the message claims to be this brand. */
  keywords: RegExp;
  provider?: ProviderId;
}

export const BRANDS: ProviderBrand[] = [
  { id: "google", name: "Google", provider: "google", domains: ["google.com", "gmail.com", "youtube.com", "goo.gl", "g.co"], keywords: /\b(google|gmail)\b/gi },
  { id: "microsoft", name: "Microsoft", provider: "microsoft", domains: ["microsoft.com", "live.com", "outlook.com", "office.com", "microsoftonline.com", "office365.com", "aka.ms"], keywords: /\b(microsoft|outlook|office\s?365|hotmail|onedrive)\b/gi },
  { id: "paypal", name: "PayPal", provider: "paypal", domains: ["paypal.com", "paypal.me"], keywords: /\bpay\s?pal\b/gi },
  { id: "apple", name: "Apple", provider: "apple", domains: ["apple.com", "icloud.com"], keywords: /\b(apple(\s?id)?|icloud)\b/gi },
  { id: "amazon", name: "Amazon", provider: "amazon", domains: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.ca", "amazon.in"], keywords: /\bamazon\b/gi },
  { id: "netflix", name: "Netflix", domains: ["netflix.com"], keywords: /\bnetflix\b/gi },
  { id: "usps", name: "USPS", domains: ["usps.com"], keywords: /\b(usps|postal service)\b/gi },
  { id: "fedex", name: "FedEx", domains: ["fedex.com"], keywords: /\bfedex\b/gi },
  { id: "dhl", name: "DHL", domains: ["dhl.com"], keywords: /\bdhl\b/gi },
  { id: "chase", name: "Chase", domains: ["chase.com"], keywords: /\bchase\b/gi },
  { id: "wellsfargo", name: "Wells Fargo", domains: ["wellsfargo.com"], keywords: /\bwells\s?fargo\b/gi },
];

const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rb.gy", "shorturl.at", "tiny.cc", "rebrand.ly", "t.ly", "s.id", "lnkd.in"]);
const RISKY_TLDS = new Set(["zip", "mov", "top", "xyz", "click", "link", "rest", "country", "gq", "tk", "ml", "cf", "ga", "work", "support", "live", "icu", "cfd", "sbs"]);

/* ---------------- URL extraction ---------------- */
// Full URLs, www. hosts, and bare domains with a known-looking TLD.
const URL_RE = /\b((?:https?:\/\/|hxxps?:\/\/)[^\s<>"'`]+|www\.[^\s<>"'`]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?:\/[^\s<>"'`]*)?)/gi;

export function extractURLs(input: string): { raw: string; start: number; end: number }[] {
  const out: { raw: string; start: number; end: number }[] = [];
  for (const m of input.matchAll(URL_RE)) {
    let raw = m[0];
    const start = m.index ?? 0;
    raw = raw.replace(/[),.;:!?\]]+$/, ""); // trailing punctuation
    if (!raw.includes("/") && !/^www\./i.test(raw)) {
      // Bare domain: require a real public suffix and avoid emails ("me@x.com").
      if (input[start - 1] === "@") continue;
      const p = parse(raw);
      if (!p.domain || !p.isIcann) continue;
    }
    out.push({ raw, start, end: start + raw.length });
  }
  return out;
}

/* ---------------- Domain analysis ---------------- */
const HOMOGLYPH: [RegExp, string][] = [[/0/g, "o"], [/1/g, "l"], [/3/g, "e"], [/5/g, "s"], [/rn/g, "m"], [/vv/g, "w"]];
function normalizeLookalike(s: string) {
  let x = s.toLowerCase();
  for (const [re, r] of HOMOGLYPH) x = x.replace(re, r);
  return x.replace(/[-_.]/g, "");
}

function brandForDomain(domain: string | null): ProviderBrand | null {
  if (!domain) return null;
  return BRANDS.find((b) => b.domains.includes(domain)) ?? null;
}

export function analyzeDomain(raw: string, pos = { start: 0, end: raw.length }): DomainAnalysis {
  const issues: DomainAnalysis["issues"] = [];
  let href = raw.replace(/^hxxp/i, "http");
  if (!/^[a-z]+:\/\//i.test(href)) href = "http://" + href;
  let url: URL | null = null;
  try { url = new URL(href); } catch { /* unparsable */ }
  const p = parse(href, { allowPrivateDomains: true });
  const hostname = url?.hostname ?? p.hostname ?? null;
  const protocol = /^[a-z]+:\/\//i.test(raw) ? (url?.protocol.replace(":", "") ?? null) : null;
  const domain = p.domain ?? null;
  const base: DomainAnalysis = {
    raw, start: pos.start, end: pos.end, hostname, registrableDomain: domain, subdomain: p.subdomain || null,
    publicSuffix: p.publicSuffix ?? null, isIp: !!p.isIp, protocol, officialFor: brandForDomain(domain), issues,
  };
  if (!hostname) { issues.push({ id: "unparsable", severity: "medium", message: "This link couldn't be parsed — treat it with caution." }); return base; }

  if (p.isIp) issues.push({ id: "ip", severity: "high", message: `Uses a raw IP address (${hostname}) instead of a name. Legitimate companies almost never do this.` });
  if (/(^|\.)xn--/i.test(hostname)) issues.push({ id: "punycode", severity: "high", message: "Contains encoded international characters (xn--) that can imitate familiar letters." });
  if (url && url.username) issues.push({ id: "userinfo", severity: "high", message: `Contains "@": the real destination is ${hostname}, not "${url.username}".` });
  if (protocol === "http") issues.push({ id: "http", severity: "low", message: "Uses unencrypted http:// — real sign-in pages use https." });
  if (domain && SHORTENERS.has(domain)) issues.push({ id: "shortener", severity: "medium", message: `${domain} is a link shortener — it hides the real destination. AfterClick does not open it to find out.` });
  if (p.publicSuffix && RISKY_TLDS.has(p.publicSuffix.split(".").pop()!)) issues.push({ id: "tld", severity: "medium", message: `Ends in ".${p.publicSuffix}", an ending often used by throwaway scam sites.` });
  if (hostname.split(".").length >= 5) issues.push({ id: "deep-subdomain", severity: "medium", message: "Has an unusually long chain of subdomains, a common way to bury the real domain." });

  if (!base.officialFor && domain) {
    const label = domain.slice(0, domain.length - (p.publicSuffix?.length ?? 0) - 1);
    const sub = (p.subdomain ?? "").toLowerCase();
    for (const b of BRANDS) {
      const names = b.domains.map((d) => d.split(".")[0]!);
      const norm = normalizeLookalike(label);
      const inLabel = names.some((n) => n.length >= 4 && (norm.includes(n) || label.toLowerCase().includes(n)));
      const inSub = names.some((n) => n.length >= 4 && sub.split(/[.-]/).includes(n));
      if (inLabel) {
        issues.push({ id: "lookalike", severity: "high", message: `"${domain}" imitates ${b.name}, but it isn't a domain ${b.name} uses (${b.domains[0]}).` });
        break;
      }
      if (inSub) {
        issues.push({ id: "brand-subdomain", severity: "high", message: `"${b.name.toLowerCase()}" appears only in the subdomain. The site actually belongs to ${domain}, which anyone can register.` });
        break;
      }
    }
  }
  return base;
}

/* ---------------- Text rules ---------------- */
interface Rule { id: string; kind: Finding["kind"]; severity: Severity; title: string; explanation: string; re: RegExp }

const RULES: Rule[] = [
  { id: "urgency", kind: "urgency", severity: "medium", title: "Pressure to act fast",
    explanation: "Deadlines and urgency are used to stop you from pausing to check.",
    re: /\b(urgent(ly)?|immediately|right away|act now|within\s+\d+\s*(hours?|hrs?|minutes?|days?)|(24|48)\s*hours?|today only|final (notice|warning|reminder)|last chance|expires? (today|soon)|as soon as possible|asap)\b/gi },
  { id: "threat", kind: "threat", severity: "medium", title: "Threat of loss or penalty",
    explanation: "Scams threaten suspension, closure or legal trouble to create fear.",
    re: /\b(suspend(ed|ion)?|locked|disabled|terminat(e|ed|ion)|clos(e|ed|ure) your account|legal action|arrest|penalt(y|ies)|unusual (sign-?in|activity)|unauthori[sz]ed (access|activity|login))\b/gi },
  { id: "credentials", kind: "credentials", severity: "high", title: "Asks you to sign in or confirm your password",
    explanation: "Real companies don't ask you to confirm passwords through a link in a message.",
    re: /\b(verify your (account|identity|information|details)|confirm your (password|account|identity|details)|(log|sign)[\s-]?in (here|now|below|to (verify|confirm|restore))|update your (password|account|login)|(?:re-?enter|enter|share|send|verify) your password)\b/gi },
  { id: "code", kind: "code", severity: "high", title: "Asks for a verification code",
    explanation: "One-time codes let someone sign in as you. No real support agent needs yours.",
    re: /\b(verification code|security code|one[-\s]?time (code|password|passcode)|otp|6[-\s]?digit code|send (me|us) the code|code (we|that was) sent)\b/gi },
  { id: "payment", kind: "payment", severity: "high", title: "Requests a payment",
    explanation: "Unexpected payment requests — especially small 'fees' — are a common scam pattern.",
    re: /\b(pay(ment)? (now|required|due|of)|(redelivery|customs|shipping|processing|unpaid|outstanding) fee|gift cards?|wire transfer|bitcoin|crypto(currency)?|zelle|venmo|cash ?app|refund)\b|[$€£]\s?\d+(?:[.,]\d{2})?/gi },
  { id: "sensitive", kind: "sensitive", severity: "high", title: "Asks for sensitive personal or financial details",
    explanation: "Card numbers, SSNs and bank details should never be sent in reply to a message.",
    re: /\b(card (number|details)|cvv|cvc|social security|ssn|bank (account|details|login)|routing number|date of birth|mother'?s maiden name|pin\b)/gi },
  { id: "remote", kind: "sensitive", severity: "high", title: "Asks you to install software or allow remote access",
    explanation: "Scammers install remote-control tools to take over your computer.",
    re: /\b(anydesk|teamviewer|remote (access|support|desktop)|ultraviewer|install (this|the) (app|software|program)|download (this|the) (app|software))\b/gi },
  { id: "generic-greeting", kind: "urgency", severity: "low", title: "Generic greeting",
    explanation: "Real account messages usually use your name. Generic greetings suggest a mass message.",
    re: /\b(dear (customer|user|client|member|valued customer|account holder|sir\/madam))\b/gi },
];

function findAll(input: string, re: RegExp): Evidence[] {
  const out: Evidence[] = [];
  for (const m of input.matchAll(new RegExp(re.source, re.flags))) {
    out.push({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
    if (out.length >= 6) break;
  }
  return out;
}

const SEV: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function analyzeMessage(input: string): Analysis {
  const text = input.slice(0, 20000);
  const findings: Finding[] = [];
  const urls = extractURLs(text).map((u) => analyzeDomain(u.raw, u));

  for (const r of RULES) {
    const ev = findAll(text, r.re).filter((e) => {
      // A security reminder is not a request to disclose a secret. Scope the
      // negation to the same clause; a later request must still be detected.
      if (!["credentials", "code", "sensitive", "payment", "remote"].includes(r.id)) return true;
      const before = text.slice(Math.max(0, e.start - 100), e.start).split(/[.!?;\n]/).pop() ?? "";
      return !/\b(?:never|do not|don['’]t)\s+(?:\w+\s+){0,5}(?:share|send|give|disclose|enter|pay|install|allow)\b[^,]{0,45}$/i.test(before)
        && !/\b(?:never|do not|don['’]t)\s*$/i.test(before);
    });
    if (ev.length) {
      // Mentions alone (receipts, help articles, settings labels) are not requests.
      const isRequest = /\b(?:send|share|give|enter|provide|confirm|verify|pay|buy|purchase|transfer|install|download|allow|grant|call)\b/i.test(text);
      const mentionOnly = ["code", "payment", "sensitive", "remote"].includes(r.id) && !isRequest;
      findings.push({ id: r.id, kind: r.kind, severity: mentionOnly ? "low" : r.severity,
        title: mentionOnly ? `Mentions ${r.id === "code" ? "verification codes" : r.id === "payment" ? "payments" : r.id === "remote" ? "remote access" : "sensitive information"}` : r.title,
        explanation: mentionOnly ? "A mention alone does not establish a request or a scam. The surrounding context needs independent verification." : r.explanation, evidence: ev });
    }
  }

  // Brands claimed in the text (ignoring mentions that are inside URLs).
  const inUrl = (i: number) => urls.some((u) => i >= u.start && i < u.end);
  const brands: ProviderBrand[] = [];
  const brandEvidence = new Map<string, Evidence[]>();
  for (const b of BRANDS) {
    const ev = findAll(text, b.keywords).filter((e) => !inUrl(e.start));
    if (ev.length) { brands.push(b); brandEvidence.set(b.id, ev); }
  }

  for (const u of urls) {
    for (const iss of u.issues) {
      findings.push({ id: `url-${iss.id}-${u.start}`, kind: "url", severity: iss.severity, title: urlTitle(iss.id), explanation: iss.message,
        evidence: [{ text: u.raw, start: u.start, end: u.end }] });
    }
  }

  // Claimed brand but links go elsewhere.
  for (const b of brands) {
    const off = urls.filter((u) => u.registrableDomain && !b.domains.includes(u.registrableDomain));
    const nonOfficial = off.filter((u) => !u.officialFor);
    if (nonOfficial.length) {
      findings.push({ id: `brand-${b.id}`, kind: "brand", severity: "high", title: `Claims to be ${b.name}, but links elsewhere`,
        explanation: `The message mentions ${b.name}, but its link${nonOfficial.length > 1 ? "s go" : " goes"} to ${nonOfficial.map((u) => u.registrableDomain).join(", ")} — not a domain ${b.name} uses.`,
        evidence: [...(brandEvidence.get(b.id) ?? []).slice(0, 2), ...nonOfficial.map((u) => ({ text: u.raw, start: u.start, end: u.end }))] });
    }
  }

  findings.sort((x, y) => SEV[x.severity] - SEV[y.severity]);
  const high = findings.filter((f) => f.severity === "high").length;
  const level: Analysis["level"] = high > 0 || findings.length >= 3 ? "warning-signs" : findings.length > 0 ? "some-signs" : "no-known-signs";
  const headline = level === "warning-signs" ? "Strong warning signs found"
    : level === "some-signs" ? "Some warning signs found"
    : "No known warning signs detected — that doesn't mean it's safe";

  const needsVerification: string[] = [];
  const claimed = brands[0];
  if (claimed) needsVerification.push(`Whether ${claimed.name} actually sent this — check inside the official app or by typing ${claimed.domains[0]} yourself.`);
  else needsVerification.push("Who actually sent this message — sender names and numbers can be faked.");
  if (urls.some((u) => u.issues.some((i) => i.id === "shortener"))) needsVerification.push("Where the shortened link really leads — AfterClick deliberately doesn't open it.");
  if (urls.length) needsVerification.push("Whether any link is safe — AfterClick only reads the address text and never visits it.");
  if (findings.some((f) => f.kind === "payment")) needsVerification.push("Whether you really owe anything — check your account or bill through official channels.");
  if (findings.some((f) => f.kind === "threat")) needsVerification.push("Whether your account is really restricted — sign in through the official app to see.");

  const has = (k: Finding["kind"]) => findings.some((f) => f.kind === k);
  const suggested: IncidentType | null = findings.some((f) => f.id === "remote") ? "remote"
    : has("code") ? "code" : has("credentials") ? "password" : has("payment") ? "payment" : urls.length ? "link" : null;

  const provider = (brands.find((b) => b.provider) ?? urls.find((u) => u.officialFor?.provider)?.officialFor)?.provider;
  return { input: text, urls, findings, brands, provider, level, headline, needsVerification, suggested };
}

function urlTitle(id: string) {
  return ({
    ip: "Link uses a raw IP address", punycode: "Link uses disguised characters", userinfo: "Link hides its real destination",
    http: "Link isn't encrypted", shortener: "Shortened link hides destination", tld: "Unusual domain ending",
    "deep-subdomain": "Long subdomain chain", lookalike: "Lookalike domain", "brand-subdomain": "Brand name only in subdomain",
    unparsable: "Malformed link",
  } as Record<string, string>)[id] ?? "Suspicious link";
}

/** Merge evidence spans into non-overlapping highlight segments. */
export function highlightSegments(input: string, findings: Finding[]) {
  const spans = findings.flatMap((f) => f.evidence.map((e) => ({ ...e, severity: f.severity })))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const segs: { text: string; severity?: Severity }[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start < pos) continue;
    if (s.start > pos) segs.push({ text: input.slice(pos, s.start) });
    segs.push({ text: input.slice(s.start, s.end), severity: s.severity });
    pos = s.end;
  }
  if (pos < input.length) segs.push({ text: input.slice(pos) });
  return segs;
}

export const SAMPLE_PHISH = `From: PayPal Security <service@paypa1-support.com>
Subject: Your account has been limited

Dear Customer,

We noticed unusual sign-in activity on your PayPal account. To avoid permanent suspension, you must verify your account within 24 hours.

Sign in here to confirm your identity:
https://paypal.com.secure-login.account-verify.top/signin

If you do not act immediately, your account will be closed and a $49.99 processing fee will apply.

PayPal Security Team`;
