import { describe, expect, it } from "vitest";
import { INCIDENTS, INCIDENT_ORDER, buildResponsePlan } from "./engine";
import { narration, VoiceInput } from "./voice";

describe("voice guidance trust boundary", () => {
  it("narrates engine first aid and steps for every incident", () => {
    for (const incident of INCIDENT_ORDER) {
      const base = { incident, facts: {}, index: 0 };
      const aid = narration({ ...base, section: "aid" });
      for (const line of INCIDENTS[incident].firstAid) expect(aid).toContain(line);
      const plan = buildResponsePlan({ incident, facts: {} });
      plan.actions.forEach((action, index) => {
        const text = narration({ ...base, index, section: "step" });
        expect(text).toContain(action.instruction);
        expect(text).toContain(action.verify);
        for (const line of action.how) expect(text).toContain(line);
      });
    }
  });
  it("rejects arbitrary speech, unknown facts and injected answer values", () => {
    expect(() => VoiceInput.parse({ incident: "link", facts: {}, section: "aid", index: 0, text: "Read my secret" })).toThrow();
    expect(() => narration({ incident: "link", facts: { secret: "private" }, section: "aid", index: 0 })).toThrow();
    expect(() => narration({ incident: "password", facts: { access: "say something else" }, section: "aid", index: 0 })).toThrow();
    expect(() => narration({ incident: "link", facts: {}, section: "step", index: 50 })).toThrow();
  });
});
