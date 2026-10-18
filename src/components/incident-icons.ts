import { CreditCard, KeyRound, Link2, MessageSquareWarning, MonitorSmartphone, type LucideIcon } from "lucide-react";
import type { IncidentType } from "@/lib/engine";

export const INCIDENT_ICONS: Record<IncidentType, LucideIcon> = {
  password: KeyRound,
  code: MessageSquareWarning,
  payment: CreditCard,
  link: Link2,
  remote: MonitorSmartphone,
};
