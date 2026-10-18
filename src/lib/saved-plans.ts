import type { Facts, IncidentType } from "./engine";

export interface SavedPlan {
  facts: Facts;
  done: string[];
  updatedAt: number;
}

const KEY = "afterclick:plans:v1";

function readAll(): Partial<Record<IncidentType, SavedPlan>> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function loadPlan(t: IncidentType): SavedPlan | undefined {
  return readAll()[t];
}

export function listPlans() {
  return readAll();
}

export function savePlan(t: IncidentType, p: Omit<SavedPlan, "updatedAt">) {
  const all = readAll();
  all[t] = { ...p, updatedAt: Date.now() };
  window.localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("afterclick:plans"));
}

export function clearPlan(t: IncidentType) {
  const all = readAll();
  delete all[t];
  window.localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("afterclick:plans"));
}
