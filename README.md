# AfterClick — Cybersecurity First Aid

> **What you do next matters, calmly.**

AfterClick is a cybersecurity first-aid kit built for the moment of panic right after someone clicks a phishing link, enters a password on a fake site, shares a verification code, sends money to a scammer, or lets someone remote into their computer.

Live site: [https://afterclick-nine.vercel.app/](https://afterclick-nine.vercel.app/)

Instead of generic advice or victim-blaming security guides, it gives clear, prioritized triage so people know exactly what to do in the first 15 minutes.

---

## 3 Core Systems

### 1. Scam & URL Inspector
* **Local, deterministic inspection**: Safe on-device domain analysis (`tldts`).
* **Never visits or opens links**: Catches lookalikes, raw IP addresses, sneaky subdomains (like `paypal.com.secure-login.account-verify.top`), URL shorteners, and urgent scam triggers.
* **Inline evidence highlighting**: Highlights suspicious phrases directly inside the text and quotes the exact words under each warning sign.
* **No false guarantees**: Never issues a certificate that a message is "safe"—clean text explicitly reminds users that an absence of known red flags does not guarantee safety.

### 2. Interactive Emergency Response Engine
When a user picks one of the 5 incident types, the app launches a focused response workflow:

| Incident | Immediate Focus & Rules |
| :--- | :--- |
| **I clicked a link** | Reassures the user: clicking alone is rarely an automatic compromise unless files were downloaded or credentials entered. |
| **I entered my password** | Checks if still signed in or locked out, prioritizes official account recovery, and terminates other active sessions. |
| **I shared a verification code** | Explains that handing over a code does not guarantee full access, guiding immediate credential revokes. |
| **I sent money to a scammer** | Bypasses all questions: immediately surfaces urgent bank fraud hotline guidance and transaction recall steps. |
| **Someone had remote access** | Prioritizes physical network disconnect (airplane mode / unplug ethernet) before running offline scans. |

* **First Aid First**: Shows immediate calm steps before asking a single triage question.
* **One step at a time**: Clear action cards with *Why this matters*, *step-by-step instructions*, *how to verify*, and direct links to official recovery portals (Google, Apple, Microsoft, PayPal, Amazon).
* **Dynamic plan adaptation**: Plans recalibrate dynamically with what-changed breakdowns.

### 3. Case File & Follow-Up Tools
* **Auto-saved locally**: Answers and checked-off steps save straight to the browser's storage—no account or login required.
* **Exportable Case File**:
  * **Downloadable Markdown report**: Full chronological record with findings, actions taken, and remaining risks.
  * **Sanitized support draft**: Pre-written ticket draft to banks/providers with passwords, codes, and tokens stripped out.
  * **Quick helper summary**: Copy-paste summary for a friend, family member, or IT admin.

---

## 🧩 AfterClick Companion (Chrome Extension)

The project includes an installable Chrome Manifest V3 extension located in `extension/` and pre-built in `dist-extension/`.

### Features
- **One-click active page inspector** (identifies hostname, registered domain, HTTPS status, lookalikes, risky TLDs).
- **On-demand visible text & link inspector** (detects scam urgency and link mismatches; never reads passwords, cookies, or auth tokens).
- **Right-click context menu** ("Analyze with AfterClick" on any highlighted text).
- **Direct emergency triage handoff** into the live website at [https://afterclick-nine.vercel.app/](https://afterclick-nine.vercel.app/).

### Quick Install (Chrome)
1. Open `chrome://extensions` in Google Chrome and enable **Developer mode**.
2. Click **Load unpacked** and select the `dist-extension` folder.
3. Pin **AfterClick Companion** to your browser toolbar.

---

## 💻 Development

The extension shares the website's inspector and supports opt-in OpenAI
explanations. Set `OPENAI_API_KEY` in the server environment; see
[extension setup and privacy](extension/README.md). AI cannot override the local
findings or the rules-engine recovery plan. Production extension AI requires the
updated website backend to be deployed; the development extension uses localhost.

### ElevenLabs voice guide

The incident workflow includes **Talk me through it** for first aid, questions,
and individual recovery steps. Listen, pause, resume, and replay are available;
changing steps or closing the dialog stops playback. This is read-aloud guidance,
not microphone input or an open-ended conversational agent.

Copy `.env.example` to `.env.local` and set `ELEVENLABS_API_KEY` and
`ELEVENLABS_VOICE_ID` from your ElevenLabs account. Set the same server environment
variables in your hosting dashboard and redeploy to enable production voice.
Never use `VITE_` variables for the key. The voice must be accessible to your account.

The server rebuilds narration from the rules engine; it accepts only incident,
answer, provider, and step selectors, never arbitrary speech text. Only the generated
guidance is sent to ElevenLabs, not pasted messages or case reports. Speech uses
`eleven_multilingual_v2` through the [text-to-speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert),
which consumes ElevenLabs TTS credits (agent-minute allowances are a separate product).
Repeated clips are cached in server memory and each server instance allows up to
20 new generations per minute. This is not a distributed spending limit: configure
an API-key credit limit in ElevenLabs before a public launch. Cache and limits reset
on restart and are independent across serverless instances. Missing credentials or
provider failures leave all written guidance usable.

```sh
# Install dependencies
pnpm install

# Run website locally
pnpm dev

# Run automated tests (25/25 passing)
pnpm test

# Build production website
pnpm run build

# Build Chrome extension
cd extension
npm install
npm run build
```
