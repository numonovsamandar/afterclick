/**
 * AfterClick incident-response engine.
 * Pure, deterministic: same incident + facts always yields the same plan.
 * No scores, no guarantees — only rule-derived actions, risks and unknowns.
 */

export type IncidentType = "password" | "code" | "payment" | "link" | "remote";
export type Priority = "now" | "next" | "verify";
export type FactKey = "access" | "reuse" | "mfa" | "settings" | "financial" | "method" | "creds" | "ongoing" | "after" | "info" | "opened" | "banking" | "installed";
export type Facts = Partial<Record<FactKey, string>>;

export interface Resource {
  label: string;
  url: string;
}

export interface Option {
  value: string;
  label: string;
}

export interface Question {
  id: FactKey;
  prompt: string;
  hint?: string;
  options: Option[];
  /** Only ask when this returns true for the current facts. */
  showIf?: (f: Facts) => boolean;
}

export interface Action {
  id: string;
  title: string;
  instruction: string;
  why: string;
  how: string[];
  verify: string;
  completionMeans: string;
  priority: Priority;
  triggeredBy: string[];
  prerequisites?: string[];
  resource?: Resource;
}

export interface Plan {
  incident: IncidentType;
  status: string;
  actions: Action[];
  risks: string[];
  unknowns: string[];
  resources: Resource[];
}

export interface Incident {
  type: IncidentType;
  label: string;
  short: string;
  urgent: boolean;
  /** Calm, immediately relevant guidance shown before any questions. */
  firstAid: string[];
  questions: Question[];
}

export const RESOURCES = {
  ftcScam: { label: "FTC — What to do if you were scammed", url: "https://consumer.ftc.gov/articles/what-do-if-you-were-scammed" },
  ftcReport: { label: "ReportFraud.ftc.gov", url: "https://reportfraud.ftc.gov/" },
  identityTheft: { label: "IdentityTheft.gov", url: "https://www.identitytheft.gov/" },
  cisa: { label: "CISA — Secure Our World", url: "https://www.cisa.gov/secure-our-world" },
  ic3: { label: "FBI IC3 — Report internet crime", url: "https://www.ic3.gov/" },
  ftcHacked: { label: "FTC — Recover a hacked account", url: "https://consumer.ftc.gov/articles/how-recover-your-hacked-email-or-social-media-account" },
  ftcMalware: { label: "FTC — Malware & remote access scams", url: "https://consumer.ftc.gov/articles/how-spot-avoid-and-report-tech-support-scams" },
} satisfies Record<string, Resource>;

const YNU: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "I'm not sure" },
];

export const INCIDENTS: Record<IncidentType, Incident> = {
  password: {
    type: "password",
    label: "I entered my password on a fake site",
    short: "Password exposed",
    urgent: false,
    firstAid: [
      "Close the suspicious page. Don't click anything else in that message.",
      "Open the real service by typing its address yourself or using its official app.",
      "Never share your password with anyone — AfterClick will never ask for it.",
    ],
    questions: [
      { id: "access", prompt: "Can you still sign in to that account?", options: [
        { value: "yes", label: "Yes, I can sign in" },
        { value: "no", label: "No, I'm locked out" },
        { value: "unknown", label: "I haven't checked" },
      ] },
      { id: "reuse", prompt: "Do you use that same password anywhere else?", options: YNU },
      { id: "mfa", prompt: "Was 2-step verification turned on for this account?", hint: "A code by text or app when you sign in.", options: YNU },
    ],
  },
  code: {
    type: "code",
    label: "I shared a verification code",
    short: "Code disclosed",
    urgent: false,
    firstAid: [
      "Stop replying to the person who asked for the code — real support never needs it.",
      "Sharing a code doesn't prove anyone got in. Let's check calmly.",
      "Go to the service directly, not through any link they sent.",
    ],
    questions: [
      { id: "access", prompt: "Can you still sign in to the service that sent the code?", options: [
        { value: "yes", label: "Yes, I can sign in" },
        { value: "no", label: "No, I'm locked out" },
        { value: "unknown", label: "I haven't checked" },
      ] },
      { id: "settings", prompt: "Do you see changed recovery email, phone, or settings?", showIf: (f) => f.access === "yes", options: YNU },
      { id: "financial", prompt: "Was it a bank or payment-app code?", options: [
        { value: "yes", label: "Yes, banking or payments" },
        { value: "no", label: "No, another service" },
      ] },
    ],
  },
  payment: {
    type: "payment",
    label: "I sent money to a scammer",
    short: "Suspicious payment",
    urgent: true,
    firstAid: [
      "Don't send any more money, even if they promise a refund or threaten you.",
      "Keep the messages and receipts — don't delete anything yet.",
    ],
    questions: [
      { id: "method", prompt: "How did you pay?", options: [
        { value: "card", label: "Debit or credit card" },
        { value: "transfer", label: "Bank transfer / wire" },
        { value: "app", label: "Payment app (Zelle, Venmo, Cash App…)" },
        { value: "crypto", label: "Gift card or crypto" },
      ] },
      { id: "creds", prompt: "Did you also share a password, code, or login details?", options: YNU },
      { id: "ongoing", prompt: "Is the scammer still contacting you?", options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ] },
    ],
  },
  link: {
    type: "link",
    label: "I clicked a suspicious link",
    short: "Suspicious link",
    urgent: false,
    firstAid: [
      "Close the tab. Clicking alone usually isn't enough to compromise you.",
      "What you did after the click matters more than the click itself.",
    ],
    questions: [
      { id: "after", prompt: "What happened after you clicked?", options: [
        { value: "viewed", label: "I only looked at the page" },
        { value: "entered", label: "I typed in some information" },
        { value: "downloaded", label: "A file downloaded" },
        { value: "permission", label: "I allowed a pop-up, notification or extension" },
      ] },
      { id: "info", prompt: "What kind of information did you enter?", showIf: (f) => f.after === "entered", options: [
        { value: "password", label: "A password" },
        { value: "payment", label: "Card or bank details" },
        { value: "personal", label: "Personal details (address, birthday, ID)" },
      ] },
      { id: "opened", prompt: "Did you open or run the downloaded file?", showIf: (f) => f.after === "downloaded", options: YNU },
    ],
  },
  remote: {
    type: "remote",
    label: "I let a 'support' caller control my computer",
    short: "Remote access",
    urgent: false,
    firstAid: [
      "Hang up and disconnect this computer from Wi-Fi or unplug its network cable.",
      "Don't call back the number they gave you.",
    ],
    questions: [
      { id: "banking", prompt: "Did you open banking or payment sites while they were connected?", options: YNU },
      { id: "installed", prompt: "Did they ask you to install a program?", options: YNU },
    ],
  },
};

export const INCIDENT_ORDER: IncidentType[] = ["password", "code", "payment", "link", "remote"];

/** Questions currently applicable given the answers so far. */
export function activeQuestions(type: IncidentType, facts: Facts): Question[] {
  return INCIDENTS[type].questions.filter((q) => !q.showIf || q.showIf(facts));
}

/** Drop answers to questions that no longer apply (e.g. after a branch change). */
export function pruneFacts(type: IncidentType, facts: Facts): Facts {
  const ids = new Set(activeQuestions(type, facts).map((q) => q.id));
  return Object.fromEntries(Object.entries(facts).filter(([k]) => ids.has(k as FactKey))) as Facts;
}

const ORDER: Record<Priority, number> = { now: 0, next: 1, verify: 2 };

function a(x: Action): Action {
  return x;
}

function bankAction(method: string | undefined, trig: string[]): Action {
  const by: Record<string, { how: string[]; instr: string }> = {
    card: {
      instr: "Call the number on the back of your card and report the charge as fraud.",
      how: ["Call the number printed on your card or use the bank's official app.", "Say the charge was fraudulent and ask about a dispute or chargeback.", "Ask whether to freeze or replace the card."],
    },
    transfer: {
      instr: "Call your bank and ask them to recall or stop the transfer.",
      how: ["Use the number on your statement or bank's official website.", "Ask for a recall or fraud report on the transfer — the sooner the better.", "Write down the reference number they give you."],
    },
    app: {
      instr: "Report the payment in the app and contact the bank linked to it.",
      how: ["Open the official app → find the payment → report it as fraud/scam.", "Also call the bank or card linked to the app.", "Ask both what options exist; they vary by provider."],
    },
    crypto: {
      instr: "Contact the gift-card company or crypto exchange you used, right away.",
      how: ["For gift cards: call the card company on the number on the back and keep the card and receipt.", "For crypto: report the transaction to the exchange you sent from.", "Then call your bank if the money came from your account."],
    },
  };
  const m = by[method ?? ""] ?? {
    instr: "Contact your bank or payment provider using contact details you find yourself.",
    how: ["Use the number on your card, statement, or official website.", "Report the payment as fraud and ask what can be done.", "Note the time, the person you spoke with, and any reference number."],
  };
  return a({
    id: "contact-provider",
    title: "Contact your bank or payment provider",
    instruction: m.instr,
    why: "Providers can sometimes stop, reverse, or flag a payment, but often only within a short window. Recovery isn't guaranteed — but asking quickly gives you the best chance.",
    how: m.how,
    verify: "You have a case or reference number from the provider.",
    completionMeans: "You reported it. Getting money back is not guaranteed.",
    priority: "now",
    triggeredBy: trig,
    resource: RESOURCES.ftcScam,
  });
}

export function computePlan(type: IncidentType, raw: Facts): Plan {
  const f = pruneFacts(type, raw);
  const actions: Action[] = [];
  const risks: string[] = [];
  const unknowns: string[] = [];
  const resources: Resource[] = [];
  let status = "";

  if (type === "password") {
    status = "Password possibly exposed";
    if (f.access === "yes") {
      actions.push(a({
        id: "change-password",
        title: "Change the exposed password",
        instruction: "Open the real site yourself and set a new, unique password.",
        why: "Whoever ran the fake page may have your password. Changing it makes the stolen copy useless.",
        how: ["Type the site's address or open its official app.", "Go to Security → Change password.", "Use a long password you've never used anywhere else."],
        verify: "Sign out, then sign back in with the new password.",
        completionMeans: "The old password no longer works for this account.",
        priority: "now",
        triggeredBy: ["access: yes"],
      }));
      actions.push(a({
        id: "sessions",
        title: "Sign out devices you don't recognize",
        instruction: "Review active sessions and remove anything unfamiliar.",
        why: "If someone already signed in, changing the password may not kick them out on its own.",
        how: ["Security settings → Devices or Where you're signed in.", "Remove sessions you don't recognize.", "Choose 'Sign out everywhere' if available."],
        verify: "Only your own devices remain listed.",
        completionMeans: "Unfamiliar sessions were removed where the provider supports it.",
        priority: "next",
        triggeredBy: ["access: yes"],
        prerequisites: ["change-password"],
      }));
    } else {
      actions.push(a({
        id: "recovery",
        title: f.access === "no" ? "Start official account recovery" : "Check whether you can still sign in",
        instruction: f.access === "no"
          ? "Use the service's official 'Forgot password' or account-recovery page."
          : "Open the real service yourself and try to sign in.",
        why: f.access === "no"
          ? "Being locked out may mean someone changed your password. Official recovery is the only safe route back in."
          : "Whether you still have access decides your next step — this answer is still unknown.",
        how: f.access === "no"
          ? ["Go to the official site and choose 'Forgot password' or 'Can't sign in'.", "Use your original recovery email or phone.", "Ignore anyone offering 'recovery help' by message — that's a common follow-up scam."]
          : ["Type the address yourself — don't use the link from the message.", "If it works, come back and choose 'Yes, I can sign in'.", "If it fails, choose 'No, I'm locked out'."],
        verify: f.access === "no" ? "You can sign in again and see your normal account." : "You know whether you still have access.",
        completionMeans: f.access === "no" ? "You regained access. Then change the password immediately." : "You answered the access question.",
        priority: f.access === "no" ? "now" : "verify",
        triggeredBy: [`access: ${f.access ?? "unanswered"}`],
        resource: RESOURCES.ftcHacked,
      }));
      if (f.access === "no") resources.push(RESOURCES.ftcHacked);
      else unknowns.push("Whether you can still sign in");
    }
    actions.push(a({
      id: "recovery-info",
      title: "Check your recovery email and phone",
      instruction: "Make sure the recovery contacts on the account are still yours.",
      why: "Attackers often swap these so they can take the account back later.",
      how: ["Security settings → Recovery email / phone.", "Remove anything that isn't yours.", "Add a backup method you control."],
      verify: "Every recovery method listed belongs to you.",
      completionMeans: "Recovery details reviewed — not a guarantee nobody else has access.",
      priority: "next",
      triggeredBy: ["password exposed"],
    }));
    if (f.reuse === "yes") {
      actions.push(a({
        id: "reused-accounts",
        title: "Change the password on every account that shared it",
        instruction: "Any account using the same password is exposed too.",
        why: "Scammers routinely try stolen passwords on email, banking and shopping sites.",
        how: ["List accounts that used this password — start with email and banking.", "Give each one its own new password.", "A password manager makes this easier."],
        verify: "No account still uses the old password.",
        completionMeans: "Reused copies of the password are retired.",
        priority: "now",
        triggeredBy: ["reuse: yes"],
      }));
      risks.push("Other accounts using this password may be targeted.");
    } else if (f.reuse === "unknown" || !f.reuse) {
      actions.push(a({
        id: "check-reuse",
        title: "Find out where else you used this password",
        instruction: "Check your password manager or saved browser passwords.",
        why: "We can't assume reuse either way. If it was reused, those accounts need attention too.",
        how: ["Look in your browser's saved passwords or password manager.", "Search for the same password or similar variations.", "Update your answer once you know."],
        verify: "You can say yes or no to reuse.",
        completionMeans: "Reuse is confirmed or ruled out.",
        priority: "verify",
        triggeredBy: [`reuse: ${f.reuse ?? "unanswered"}`],
      }));
      unknowns.push("Whether the password was reused elsewhere");
    }
    if (f.mfa === "no") {
      actions.push(a({
        id: "enable-mfa",
        title: "Turn on 2-step verification",
        instruction: "Add a second step so a password alone can't get someone in.",
        why: "Without it, the stolen password was the only lock on the account.",
        how: ["Security settings → 2-step verification.", "Prefer an authenticator app or security key over text messages.", "Save the backup codes somewhere safe and offline."],
        verify: "Signing in on a new device asks for a second step.",
        completionMeans: "The account needs more than a password to sign in.",
        priority: f.access === "no" ? "next" : "next",
        triggeredBy: ["mfa: no"],
        prerequisites: f.access === "yes" ? ["change-password"] : ["recovery"],
      }));
      risks.push("Without 2-step verification, the password alone may grant access.");
    } else if (f.mfa !== "yes") {
      unknowns.push("Whether 2-step verification was on");
    }
    actions.push(a({
      id: "watch-activity",
      title: "Look for changes you didn't make",
      instruction: "Check recent activity, sent messages, forwarding rules and purchases.",
      why: "These are signs someone used the account. Their absence is reassuring but not proof.",
      how: ["Review security alerts and recent sign-in activity.", "For email: check Sent, filters and forwarding rules.", "Tell contacts if strange messages went out from you."],
      verify: "Activity matches what you did yourself.",
      completionMeans: "You reviewed activity. AfterClick can't confirm the account is secure.",
      priority: "verify",
      triggeredBy: ["password exposed"],
    }));
    risks.unshift(f.access === "no" ? "Someone may currently control this account." : "Someone may have your password until it's changed.");
    resources.push(RESOURCES.cisa);
  }

  if (type === "code") {
    status = f.access === "no" ? "Possible unauthorized access" : "Code disclosed — use not confirmed";
    if (f.access === "no") {
      actions.push(a({
        id: "recovery", title: "Start official account recovery",
        instruction: "Use the service's own 'Can't sign in' page.",
        why: "Being locked out right after sharing a code suggests the code may have been used.",
        how: ["Go to the official site or app yourself.", "Choose 'Forgot password' / 'Can't sign in'.", "If recovery fails, use the provider's official support page."],
        verify: "You can sign in again.", completionMeans: "You regained access — then secure it.",
        priority: "now", triggeredBy: ["access: no"], resource: RESOURCES.ftcHacked,
      }));
      risks.push("Someone may currently control this account.");
    } else {
      actions.push(a({
        id: "secure-account", title: "Change your password and sign out other devices",
        instruction: "Sign in through the official app or site, change the password and end other sessions.",
        why: "A code plus a password can let someone in. Resetting both closes that door.",
        how: ["Open the official app — not any link from the message.", "Change your password.", "Use 'Sign out of all other devices' if offered."],
        verify: "Only your devices appear in the session list.", completionMeans: "Other sessions ended where supported.",
        priority: "now", triggeredBy: [`access: ${f.access ?? "unanswered"}`],
      }));
      if (f.access !== "yes") unknowns.push("Whether you can still sign in");
      unknowns.push("Whether the code was actually used");
      actions.push(a({
        id: "check-access", title: "Check for sign-ins you don't recognize",
        instruction: "Look at recent security alerts and sign-in history.",
        why: "Sharing a code doesn't prove someone signed in. This is how you find out.",
        how: ["Security settings → Recent activity or Devices.", "Look for new locations, devices or times you weren't active."],
        verify: "No unfamiliar sign-ins near the time you shared the code.",
        completionMeans: "Reviewed — the provider's record is the best evidence available.",
        priority: "verify", triggeredBy: ["code shared"],
      }));
    }
    if (f.settings === "yes") {
      actions.push(a({
        id: "restore-settings", title: "Undo the settings that changed",
        instruction: "Put back your recovery email, phone, and remove unknown 2-step methods.",
        why: "Changed recovery details are a strong sign someone else got in.",
        how: ["Remove unfamiliar recovery contacts and devices.", "Remove authenticator apps or keys you didn't add.", "Contact official support if you can't undo them."],
        verify: "Every recovery and 2-step method is yours.", completionMeans: "Settings restored.",
        priority: "now", triggeredBy: ["settings: yes"],
      }));
      risks.push("Changed settings suggest the account was accessed.");
    } else if (f.access === "yes" && f.settings !== "no") {
      unknowns.push("Whether recovery settings were changed");
    }
    if (f.financial === "yes") {
      actions.unshift(bankAction(undefined, ["financial code: yes"]));
      risks.push("Banking codes can be used to approve payments or new devices.");
      resources.push(RESOURCES.ftcScam);
    }
    resources.push(RESOURCES.cisa);
  }

  if (type === "payment") {
    status = "Urgent — financial loss possible";
    actions.push(bankAction(f.method, [`method: ${f.method ?? "unanswered"}`]));
    if (f.ongoing === "yes") {
      actions.push(a({
        id: "stop-contact", title: "Stop all contact with the scammer",
        instruction: "Don't send more money, codes or information. Block the number or account.",
        why: "Scammers often return with new reasons to pay — 'fees', 'refunds', 'taxes'.",
        how: ["Don't reply. Block them.", "Don't install anything or share your screen.", "Keep the messages — don't delete them."],
        verify: "You've had no further contact.", completionMeans: "Contact stopped.",
        priority: "now", triggeredBy: ["ongoing: yes"],
      }));
    }
    if (f.creds === "yes" || f.creds === "unknown") {
      actions.push(a({
        id: "secure-creds", title: f.creds === "yes" ? "Change any passwords or logins you shared" : "Check whether you shared login details",
        instruction: f.creds === "yes" ? "Change those passwords from the official site and tell your bank." : "Review the conversation for passwords, PINs or codes you gave.",
        why: "Shared logins could let the scammer take more money or access accounts.",
        how: ["Change passwords on the official sites.", "Turn on 2-step verification.", "Tell the bank which details were shared."],
        verify: "No account still uses the details you shared.", completionMeans: "Shared details are no longer valid.",
        priority: f.creds === "yes" ? "now" : "verify", triggeredBy: [`creds: ${f.creds}`],
      }));
      if (f.creds === "unknown") unknowns.push("Whether login details were shared");
    }
    actions.push(a({
      id: "evidence", title: "Save the evidence",
      instruction: "Screenshot messages, receipts, usernames, phone numbers and amounts.",
      why: "Your bank and official reports will ask for these details.",
      how: ["Screenshot the conversation and payment confirmation.", "Write down dates, times and amounts.", "Don't delete the conversation."],
      verify: "You have everything in one folder.", completionMeans: "Evidence saved.",
      priority: "next", triggeredBy: ["payment made"],
    }));
    actions.push(a({
      id: "report", title: "Report it officially",
      instruction: "File a report with the FTC, and the FBI's IC3 for internet fraud.",
      why: "Reports help authorities track scams and may be requested by your bank.",
      how: ["Go to ReportFraud.ftc.gov.", "Describe what happened using your saved evidence.", "Keep the report number."],
      verify: "You have a report confirmation.", completionMeans: "Report filed. Reports don't recover money directly.",
      priority: "next", triggeredBy: ["payment made"], resource: RESOURCES.ftcReport,
    }));
    actions.push(a({
      id: "recovery-scam", title: "Watch for 'recovery' scams",
      instruction: "Anyone promising to get your money back for a fee is likely another scammer.",
      why: "Victims are often targeted again by fake recovery services.",
      how: ["Ignore unsolicited offers to recover funds.", "Only deal with your bank and official agencies."],
      verify: "You haven't paid anyone for recovery.", completionMeans: "Ongoing awareness.",
      priority: "verify", triggeredBy: ["payment made"],
    }));
    risks.push("The payment may not be recoverable — outcome depends on the provider.");
    if (f.method === "crypto") risks.push("Gift card and crypto payments are especially hard to reverse.");
    if (f.ongoing === "yes") risks.push("Ongoing contact increases the chance of further losses.");
    unknowns.push("Whether the provider can reverse the payment");
    resources.push(RESOURCES.ftcScam, RESOURCES.ftcReport, RESOURCES.ic3);
  }

  if (type === "link") {
    const after = f.after;
    status = after === "viewed" || !after ? "Not confirmed compromise" : "Needs attention";
    if (!after || after === "viewed") {
      actions.push(a({
        id: "close-page", title: "Close the page and don't return",
        instruction: "Close the tab and delete the message that contained the link.",
        why: "Just viewing a page rarely compromises an up-to-date device or account.",
        how: ["Close the tab.", "Delete or report the message as phishing.", "Keep your browser and device updated."],
        verify: "No new downloads, extensions or pop-ups appeared.", completionMeans: "Link closed.",
        priority: "next", triggeredBy: [`after: ${after ?? "unanswered"}`],
      }));
      if (!after) unknowns.push("What happened after the click");
    }
    if (after === "entered") {
      if (f.info === "password") {
        actions.push(a({
          id: "change-password", title: "Change the password you entered",
          instruction: "Change it on the real site, and anywhere else you used it.",
          why: "Typing a password on a fake page may have given it away.",
          how: ["Open the real site yourself.", "Change the password and turn on 2-step verification.", "Update any account that shared it."],
          verify: "The old password no longer works.", completionMeans: "Password replaced.",
          priority: "now", triggeredBy: ["info: password"], resource: RESOURCES.ftcHacked,
        }));
        risks.push("The password you typed may be in someone else's hands.");
      } else if (f.info === "payment") {
        actions.push(bankAction("card", ["info: payment"]));
        risks.push("Card or bank details may be used for charges.");
      } else if (f.info === "personal") {
        actions.push(a({
          id: "identity", title: "Watch for identity misuse",
          instruction: "Consider a credit freeze and check IdentityTheft.gov for a personalized plan.",
          why: "Personal details can be used to open accounts in your name.",
          how: ["Visit IdentityTheft.gov.", "Consider freezing your credit with the three bureaus.", "Watch statements for unfamiliar activity."],
          verify: "Credit reports show nothing unfamiliar.", completionMeans: "Monitoring in place.",
          priority: "next", triggeredBy: ["info: personal"], resource: RESOURCES.identityTheft,
        }));
        resources.push(RESOURCES.identityTheft);
      } else unknowns.push("What information you entered");
    }
    if (after === "downloaded") {
      if (f.opened === "no") {
        actions.push(a({
          id: "delete-file", title: "Delete the file without opening it",
          instruction: "Delete it from Downloads and empty the trash.",
          why: "A file that was never opened usually hasn't done anything.",
          how: ["Open Downloads.", "Delete the file.", "Empty Trash / Recycle Bin."],
          verify: "The file is gone.", completionMeans: "File removed.",
          priority: "now", triggeredBy: ["opened: no"],
        }));
      } else {
        actions.push(a({
          id: "disconnect", title: f.opened === "yes" ? "Disconnect and scan this device" : "Scan this device to be safe",
          instruction: "Turn off Wi-Fi, then run your built-in security scan.",
          why: "Opened files can install malware. We can't know what it did — a scan is the next check.",
          how: ["Disconnect from the internet.", "Run Windows Security / your antivirus full scan.", "If anything is found, follow its removal steps or ask a trusted technician."],
          verify: "A full scan finishes without findings.", completionMeans: "Scan complete — a clean scan isn't absolute proof.",
          priority: f.opened === "yes" ? "now" : "verify", triggeredBy: [`opened: ${f.opened ?? "unanswered"}`], resource: RESOURCES.cisa,
        }));
        if (f.opened === "yes") {
          actions.push(a({
            id: "other-device-passwords", title: "Change important passwords from another device",
            instruction: "Use a phone or computer you trust to update email and banking passwords.",
            why: "If malware is present, it could capture what you type on this device.",
            how: ["Use a different, trusted device.", "Start with email, then banking.", "Turn on 2-step verification."],
            verify: "Key accounts have new passwords.", completionMeans: "Key passwords rotated.",
            priority: "next", triggeredBy: ["opened: yes"], prerequisites: ["disconnect"],
          }));
          risks.push("The opened file may have installed something harmful.");
        } else unknowns.push("Whether the file was opened");
      }
    }
    if (after === "permission") {
      actions.push(a({
        id: "revoke", title: "Remove the permission or extension",
        instruction: "Block the site's notifications and remove unfamiliar extensions.",
        why: "Permissions let a site keep sending pop-ups or reading pages you visit.",
        how: ["Browser settings → Site settings → Notifications → remove the site.", "Extensions → remove anything you don't recognize.", "Restart the browser."],
        verify: "No more pop-ups from that site.", completionMeans: "Permission revoked.",
        priority: "now", triggeredBy: ["after: permission"],
      }));
    }
    actions.push(a({
      id: "watch", title: "Keep an eye out for a few days",
      instruction: "Watch for unusual emails, sign-in alerts or charges.",
      why: "If nothing unusual shows up, that's a good sign — though not a guarantee.",
      how: ["Read security alerts carefully.", "Check bank statements."],
      verify: "Nothing unusual over the next week.", completionMeans: "Ongoing awareness.",
      priority: "verify", triggeredBy: ["link clicked"],
    }));
    if (status === "Not confirmed compromise") risks.push("Clicking alone doesn't confirm any compromise.");
    resources.push(RESOURCES.cisa);
  }

  if (type === "remote") {
    status = "Device may be under outside control";
    actions.push(a({
      id: "offline", title: "Keep the computer offline",
      instruction: "Stay disconnected until remote-access software is removed.",
      why: "Remote tools can let the caller reconnect at any time.",
      how: ["Turn off Wi-Fi or unplug the network cable.", "Don't restart the call or app."],
      verify: "The computer shows no internet connection.", completionMeans: "Device isolated.",
      priority: "now", triggeredBy: ["remote access granted"],
    }));
    if (f.banking === "yes" || f.banking === "unknown") {
      actions.unshift(bankAction(undefined, [`banking: ${f.banking}`]));
      risks.push("The caller may have seen or used your banking session.");
      if (f.banking === "unknown") unknowns.push("Whether banking sites were open");
    }
    actions.push(a({
      id: "uninstall", title: f.installed === "yes" ? "Uninstall the program they had you install" : "Check for remote-access programs",
      instruction: "Remove tools like AnyDesk, TeamViewer or anything unfamiliar.",
      why: "Leaving them installed keeps the door open.",
      how: ["Settings → Apps → sort by install date.", "Uninstall anything installed during the call.", "Run a full security scan."],
      verify: "No unfamiliar remote tools remain.", completionMeans: "Remote tools removed — a technician can double-check.",
      priority: f.installed === "yes" ? "now" : "next", triggeredBy: [`installed: ${f.installed ?? "unanswered"}`], resource: RESOURCES.ftcMalware,
    }));
    if (f.installed !== "yes" && f.installed !== "no") unknowns.push("Whether a program was installed");
    actions.push(a({
      id: "passwords", title: "Change passwords from another device",
      instruction: "Update email and banking passwords from a phone or trusted computer.",
      why: "Anything typed while they were connected could have been seen.",
      how: ["Use a trusted device.", "Start with email and banking.", "Turn on 2-step verification."],
      verify: "Key accounts have new passwords.", completionMeans: "Passwords rotated.",
      priority: "next", triggeredBy: ["remote access granted"],
    }));
    actions.push(a({
      id: "report", title: "Report the tech-support scam",
      instruction: "Report it to the FTC.", why: "Reports help stop these callers.",
      how: ["Go to ReportFraud.ftc.gov and describe the call."], verify: "You have a report confirmation.",
      completionMeans: "Report filed.", priority: "verify", triggeredBy: ["remote access granted"], resource: RESOURCES.ftcReport,
    }));
    risks.push("The caller may have installed something that lets them return.");
    resources.push(RESOURCES.ftcMalware, RESOURCES.ftcReport);
  }

  // Stable, rule-based ordering: priority first, then insertion order.
  const sorted = actions.map((x, i) => [x, i] as const).sort((p, q) => ORDER[p[0].priority] - ORDER[q[0].priority] || p[1] - q[1]).map(([x]) => x);
  const seen = new Set<string>();
  const uniqRes = resources.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)));
  return { incident: type, status, actions: sorted, risks, unknowns, resources: uniqRes };
}

export interface PlanDiff {
  added: Action[];
  removed: Action[];
  reprioritized: { action: Action; from: Priority; to: Priority }[];
  firstChanged: boolean;
}

export function diffPlans(before: Plan, after: Plan): PlanDiff {
  const b = new Map(before.actions.map((x) => [x.id, x]));
  const aMap = new Map(after.actions.map((x) => [x.id, x]));
  const added = after.actions.filter((x) => !b.has(x.id));
  const removed = before.actions.filter((x) => !aMap.has(x.id));
  const reprioritized = after.actions
    .filter((x) => b.has(x.id) && b.get(x.id)!.priority !== x.priority)
    .map((x) => ({ action: x, from: b.get(x.id)!.priority, to: x.priority }));
  return { added, removed, reprioritized, firstChanged: before.actions[0]?.id !== after.actions[0]?.id };
}

export const PRIORITY_LABEL: Record<Priority, string> = { now: "Do now", next: "Do next", verify: "Verify" };

/* ------------------------------------------------------------------ */
/* Recognized providers — vetted official help pages only. Links are   */
/* never derived from user-submitted or suspicious URLs.               */
/* ------------------------------------------------------------------ */
export type ProviderId = "google" | "microsoft" | "paypal" | "apple" | "amazon";

export const PROVIDERS: Record<ProviderId, { name: string; recovery: Resource; security: Resource }> = {
  google: {
    name: "Google",
    recovery: { label: "Google — Account recovery", url: "https://accounts.google.com/signin/recovery" },
    security: { label: "Google — Security Checkup", url: "https://myaccount.google.com/security-checkup" },
  },
  microsoft: {
    name: "Microsoft",
    recovery: { label: "Microsoft — Recover your account", url: "https://account.live.com/acsr" },
    security: { label: "Microsoft — Recent sign-in activity", url: "https://account.live.com/Activity" },
  },
  paypal: {
    name: "PayPal",
    recovery: { label: "PayPal — Report a problem / Resolution Center", url: "https://www.paypal.com/disputes/" },
    security: { label: "PayPal — Security Center", url: "https://www.paypal.com/us/security" },
  },
  apple: {
    name: "Apple",
    recovery: { label: "Apple — Recover your Apple Account", url: "https://iforgot.apple.com/" },
    security: { label: "Apple — Recognize phishing", url: "https://support.apple.com/en-us/102568" },
  },
  amazon: {
    name: "Amazon",
    recovery: { label: "Amazon — Account & login issues", url: "https://www.amazon.com/gp/help/customer/display.html?nodeId=GH4ZGFSGZ59QH2AR" },
    security: { label: "Amazon — Report suspicious communication", url: "https://www.amazon.com/gp/help/customer/display.html?nodeId=G4YFYCCNUSENA23B" },
  },
};

/** "What actually happened?" after inspecting a message → incident + seed facts. */
export type InteractionId = "none" | "clicked" | "password" | "code" | "money" | "remote";
export const INTERACTIONS: { id: InteractionId; label: string; incident: IncidentType | null; facts: Facts }[] = [
  { id: "none", label: "I haven't interacted with it", incident: null, facts: {} },
  { id: "clicked", label: "I clicked the link", incident: "link", facts: {} },
  { id: "password", label: "I entered my password", incident: "password", facts: {} },
  { id: "code", label: "I shared a verification code", incident: "code", facts: {} },
  { id: "money", label: "I sent money", incident: "payment", facts: {} },
  { id: "remote", label: "I installed software or granted remote control", incident: "remote", facts: { installed: "yes" } },
];

/** Guidance when the person only received the message. */
export function noInteractionPlan(provider?: ProviderId): Plan {
  const p = provider ? PROVIDERS[provider] : undefined;
  const actions: Action[] = [
    {
      id: "dont-engage", title: "Don't click, reply or call back",
      instruction: "Leave the message alone — don't use any link, number or attachment in it.",
      why: "Nothing has happened yet. Not engaging keeps it that way.",
      how: ["Don't tap links or open attachments.", "Don't reply, even to say stop.", "Don't call numbers listed in the message."],
      verify: "You haven't interacted with the message.", completionMeans: "You avoided the message.",
      priority: "now", triggeredBy: ["interaction: none"],
    },
    {
      id: "check-independently", title: p ? `Check your ${p.name} account independently` : "Check the claim independently",
      instruction: "If you're worried the message might be real, open the official app or type the website address yourself.",
      why: "The real service will show any genuine alert inside your account.",
      how: ["Open the official app, or type the address yourself.", "Look for notifications or alerts there.", "Ignore anything only the message mentions."],
      verify: "You looked inside your real account.", completionMeans: "Checked — this doesn't prove the message was fake or real.",
      priority: "next", triggeredBy: ["interaction: none"], ...(p ? { resource: p.security } : {}),
    },
    {
      id: "report-message", title: "Report and delete the message",
      instruction: "Use your email or phone's \"Report junk/phishing\" option, then delete it.",
      why: "Reports help filters block the sender for you and others.",
      how: ["Email: use Report phishing / Report junk.", "Text (US): forward to 7726 (SPAM).", "Optionally report at ReportFraud.ftc.gov.", "Delete the message."],
      verify: "The message is reported and gone.", completionMeans: "Reported.",
      priority: "verify", triggeredBy: ["interaction: none"], resource: RESOURCES.ftcReport,
    },
  ];
  const resources = [RESOURCES.ftcReport, ...(p ? [p.security] : [])];
  return { incident: "link", status: "No interaction reported", actions, risks: [], unknowns: [], resources };
}

/** Plan builder used by the Action Center. Adds vetted provider links when a brand was recognized. */
export function buildResponsePlan(input: { incident: IncidentType; facts: Facts; provider?: ProviderId | undefined }): Plan {
  const plan = computePlan(input.incident, input.facts);
  if (!input.provider) return plan;
  const p = PROVIDERS[input.provider];
  const recoveryIds = new Set(["recovery", "change-password", "recover", "check-access", "secure-account"]);
  const actions = plan.actions.map((x) => (recoveryIds.has(x.id) ? { ...x, resource: x.id === "check-access" ? p.security : p.recovery } : x));
  const seen = new Set<string>();
  const resources = [p.recovery, p.security, ...plan.resources].filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)));
  return { ...plan, actions, resources };
}
