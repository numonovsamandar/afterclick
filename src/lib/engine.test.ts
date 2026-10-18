import { describe, expect, it } from "vitest";
import { INCIDENT_ORDER, INCIDENTS, activeQuestions, computePlan, diffPlans } from "./engine";

const ids = (p: ReturnType<typeof computePlan>) => p.actions.map((a) => a.id);

describe("password phishing", () => {
  it("access retained → change password first", () => {
    expect(computePlan("password", { access: "yes", reuse: "no", mfa: "yes" }).actions[0]!.id).toBe("change-password");
  });
  it("lost access → official recovery replaces password change", () => {
    const p = computePlan("password", { access: "no", reuse: "no", mfa: "yes" });
    expect(p.actions[0]!.id).toBe("recovery");
    expect(ids(p)).not.toContain("change-password");
  });
  it("confirmed reuse adds reused-accounts action", () => {
    const before = computePlan("password", { access: "yes", reuse: "no" });
    const after = computePlan("password", { access: "yes", reuse: "yes" });
    expect(diffPlans(before, after).added.map((a) => a.id)).toContain("reused-accounts");
  });
  it("unknown reuse yields a verify step, not an assumption", () => {
    const p = computePlan("password", { access: "yes", reuse: "unknown" });
    expect(ids(p)).toContain("check-reuse");
    expect(ids(p)).not.toContain("reused-accounts");
    expect(p.actions.find((a) => a.id === "check-reuse")!.priority).toBe("verify");
  });
  it("switching access yes → no changes the first action", () => {
    const d = diffPlans(computePlan("password", { access: "yes" }), computePlan("password", { access: "no" }));
    expect(d.firstChanged).toBe(true);
  });
});

describe("verification code", () => {
  it("does not treat sharing a code as confirmed access", () => {
    const p = computePlan("code", { access: "yes" });
    expect(p.status).toMatch(/not confirmed/i);
    expect(p.unknowns).toContain("Whether the code was actually used");
  });
  it("settings question only appears when access is retained", () => {
    expect(activeQuestions("code", { access: "no" }).map((q) => q.id)).not.toContain("settings");
    expect(activeQuestions("code", { access: "yes" }).map((q) => q.id)).toContain("settings");
  });
});

describe("payment", () => {
  it("is urgent and always leads with contacting the provider, even with no answers", () => {
    expect(INCIDENTS.payment.urgent).toBe(true);
    expect(computePlan("payment", {}).actions[0]!.id).toBe("contact-provider");
  });
  it("card and transfer give different provider instructions", () => {
    const card = computePlan("payment", { method: "card" }).actions[0]!.instruction;
    const transfer = computePlan("payment", { method: "transfer" }).actions[0]!.instruction;
    expect(card).not.toBe(transfer);
  });
  it("never promises recovery", () => {
    const txt = JSON.stringify(computePlan("payment", { method: "card" }));
    expect(txt).not.toMatch(/will be (returned|recovered|refunded)/i);
  });
});

describe("suspicious link", () => {
  it("only viewing is not classified as compromise", () => {
    const p = computePlan("link", { after: "viewed" });
    expect(p.status).toBe("Not confirmed compromise");
    expect(p.actions.some((a) => a.priority === "now")).toBe(false);
  });
  it("opened download escalates", () => {
    expect(computePlan("link", { after: "downloaded", opened: "yes" }).actions[0]!.id).toBe("disconnect");
  });
  it("prunes answers for questions that no longer apply", () => {
    const p = computePlan("link", { after: "viewed", opened: "yes" });
    expect(ids(p)).not.toContain("disconnect");
  });
});

describe("every incident is distinct", () => {
  it("each category yields its own first action set", () => {
    const sets = INCIDENT_ORDER.map((t) => ids(computePlan(t, {})).join(","));
    expect(new Set(sets).size).toBe(INCIDENT_ORDER.length);
  });
});
