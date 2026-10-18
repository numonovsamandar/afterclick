import { describe, expect, it } from "vitest";
import { analyzeDomain, analyzeMessage, extractURLs, SAMPLE_PHISH } from "./inspector";
import { buildResponsePlan, noInteractionPlan } from "./engine";
import { createIncidentReport, createSupportInquiry } from "./report";

describe("extractURLs", () => {
  it("finds full, www and bare-domain links, trimming punctuation", () => {
    const u = extractURLs("Go to https://a.example.com/x?y=1. Or www.test.org, or bit.ly/abc!").map((x) => x.raw);
    expect(u).toEqual(["https://a.example.com/x?y=1", "www.test.org", "bit.ly/abc"]);
  });
  it("ignores email addresses", () => {
    expect(extractURLs("write to help@paypal.com")).toEqual([]);
  });
});

describe("analyzeDomain", () => {
  it("brand in subdomain is not the official site", () => {
    const d = analyzeDomain("https://paypal.com.secure-login.account-verify.top/signin");
    expect(d.registrableDomain).toBe("account-verify.top");
    expect(d.officialFor).toBeNull();
    expect(d.issues.map((i) => i.id)).toEqual(expect.arrayContaining(["brand-subdomain", "tld"]));
  });
  it("recognizes official domains with public-suffix awareness", () => {
    expect(analyzeDomain("https://www.paypal.com/signin").officialFor?.id).toBe("paypal");
    expect(analyzeDomain("https://accounts.google.co.uk").registrableDomain).toBe("google.co.uk");
  });
  it("flags lookalikes, shorteners and IPs", () => {
    expect(analyzeDomain("http://paypa1-support.com").issues.map((i) => i.id)).toContain("lookalike");
    expect(analyzeDomain("bit.ly/x").issues.map((i) => i.id)).toContain("shortener");
    expect(analyzeDomain("http://192.168.4.20/login").issues.map((i) => i.id)).toContain("ip");
  });
});

describe("analyzeMessage", () => {
  it("sample phishing: brand mismatch, urgency, credential request, evidence spans match text", () => {
    const a = analyzeMessage(SAMPLE_PHISH);
    const ids = a.findings.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["brand-paypal", "urgency", "credentials", "threat"]));
    expect(a.provider).toBe("paypal");
    expect(a.level).toBe("warning-signs");
    for (const f of a.findings) for (const e of f.evidence) expect(SAMPLE_PHISH.slice(e.start, e.end)).toBe(e.text);
  });
  it("clean text is never called safe", () => {
    const a = analyzeMessage("See you at lunch tomorrow");
    expect(a.level).toBe("no-known-signs");
    expect(a.headline.toLowerCase()).toContain("doesn't mean it's safe");
  });
});

describe("plans & reports", () => {
  it("access available vs lost changes the first step, with provider recovery link", () => {
    const ok = buildResponsePlan({ incident: "password", facts: { access: "yes" }, provider: "paypal" });
    const lost = buildResponsePlan({ incident: "password", facts: { access: "no" }, provider: "paypal" });
    expect(ok.actions[0]!.id).toBe("change-password");
    expect(lost.actions[0]!.id).toBe("recovery");
    expect(lost.actions[0]!.resource?.url).toBe("https://www.paypal.com/disputes/");
  });
  it("no interaction is not treated as compromise", () => {
    expect(noInteractionPlan().status).toBe("No interaction reported");
  });
  it("report reflects real state: message, domain, done/remaining, disclaimer", () => {
    const analysis = analyzeMessage(SAMPLE_PHISH);
    const plan = buildResponsePlan({ incident: "password", facts: { access: "no" }, provider: "paypal" });
    const r = createIncidentReport({ incident: "password", facts: { access: "no" }, plan, done: ["recovery"], analysis, provider: "paypal", createdAt: new Date("2026-01-01") });
    expect(r).toContain("account-verify.top");
    expect(r).toContain("No, I'm locked out");
    expect(r).toContain("1. [x]");
    expect(r).toContain("not independent verification");
    expect(createSupportInquiry({ incident: "password", facts: {}, plan, done: [], provider: "paypal", createdAt: new Date() })).toContain("PayPal Support");
  });
});
