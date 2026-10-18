# AfterClick Companion — Chrome Extension (Manifest V3)

> **"Cybersecurity first aid, one click away."**

A companion Chrome Manifest V3 extension for **AfterClick**, the cybersecurity first-aid kit built for the moment of panic right after someone clicks a phishing link, enters a password on a fake site, shares a verification code, sends money to a scammer, or grants remote control to a computer.

---

## 🛡️ Core Capabilities

1. **One-Click Page Address Inspector**
   - Deterministic domain analysis powered by `tldts`.
   - Distinguishes the full hostname from the true registered domain (eTLD+1).
   - Catches brand impersonation buried in subdomains (e.g., `paypal.com.secure-login.account-verify.top`).
   - Flags raw IP address hostnames, Punycode/IDN homoglyphs (`xn--`), shortened URLs (`bit.ly`), unencrypted HTTP schemes, and risky TLDs.
   - Never accesses private browsing data or network traffic.

2. **Explicit Visible Page & Link Inspection**
   - Injected **only upon explicit user click** using temporary `activeTab` permissions.
   - Analyzes visible text for urgent scam pressure, threat of account suspension, credential requests, and payment extortion.
   - Detects **link text mismatches** (e.g. text displays `paypal.com` but destination points to an attacker domain).
   - **Privacy Guarantee**: Never extracts passwords, input fields, cookies, session tokens, or local storage.

3. **Right-Click Context Menu ("Analyze with AfterClick")**
   - Highlight any suspicious message, email, or SMS on any webpage.
   - Right-click and choose **"Analyze with AfterClick"**.
   - Opens the dedicated local analysis dashboard, highlighting red flags with inline quoted evidence.

4. **Emergency Response Engine Handoff**
   - Click **"I already interacted"** to immediately launch the appropriate first-aid guide on the AfterClick website.
   - Safe deep-linking: transfers only safe parameters (`incident=password&source=extension`), never sensitive URLs, messages, or credentials.

5. **Sanitized Evidence Export**
   - One-click copy of clean, structured findings for IT departments, fraud hotlines, or law enforcement.

---

## 📦 Directory Structure

```text
extension/
├── manifest.json              # Chrome Manifest V3 specification
├── popup.html                 # Extension toolbar popup entry
├── inspect.html               # Right-click full-page analysis view
├── demo.html                  # Safe simulated phishing test page
├── package.json               # Dependencies and build scripts
├── vite.config.ts             # Vite multi-page extension build config
├── tsconfig.json              # TypeScript strict configuration
├── tailwind.config.js         # Warm cream AfterClick design theme
├── src/
│   ├── background/
│   │   └── service-worker.ts  # Manifest V3 service worker & context menu
│   ├── content/
│   │   └── content-script.ts  # On-demand visible text/link extractor
│   ├── popup/
│   │   ├── index.tsx          # React root for popup
│   │   └── Popup.tsx          # Multi-view inspection interface
│   ├── inspect/
│   │   ├── index.tsx          # React root for text analysis tab
│   │   └── InspectPage.tsx    # Detailed evidence & highlight UI
│   ├── lib/
│   │   ├── inspector.ts       # Pure deterministic URL & text rules engine
│   │   ├── inspector.test.ts  # 15 automated test specifications
│   │   ├── page-content-inspector.ts # Link mismatch & DOM text analyzer
│   │   └── constants.ts       # URL mappings and restricted page list
│   └── styles/
│       └── globals.css        # Tailwind styling & clean typography
└── public/
    └── icons/                 # Crisp AfterClick shield icons (16, 32, 48, 128)
```

Production builds:
- `dist-extension/` (unpacked directory ready for Chrome)
- `afterclick-companion.zip` (packaged zip archive)

---

## 🚀 How to Build & Install in Chrome

### 1. Build the Extension (if rebuilding from source)
```bash
cd extension
npm install
npm run build
```
This generates the extension bundles inside `extension/dist` and `dist-extension/`.

### 2. Open Chrome Extensions
1. In Google Chrome, navigate to:
   ```text
   chrome://extensions
   ```
2. In the top-right corner, toggle **Developer mode** to **ON**.

### 3. Load Unpacked Extension
1. Click the **Load unpacked** button in the top-left toolbar.
2. Select the `dist-extension` folder located at:
   ```text
   /Users/samandarnumonov/Downloads/afterclick-action-guide-main/dist-extension
   ```
   *(or `extension/dist`)*
3. The **AfterClick Companion** extension will now appear in your extensions list!

### 4. Pin AfterClick to the Browser Toolbar
1. Click the puzzle-piece icon (**Extensions**) in Chrome's top-right toolbar.
2. Find **AfterClick Companion** and click the **Pin** icon (📌).
3. The dark AfterClick shield icon is now ready on your toolbar.

---

## 🎯 Hackathon Demonstration Sequence

Judges can test the entire workflow safely using the included demonstration page without visiting real phishing websites:

1. **Open the Demo Page**:
   - Open `dist-extension/demo.html` (or `public/extension-demo.html`) in Google Chrome:
     ```text
     file:///Users/samandarnumonov/Downloads/afterclick-action-guide-main/dist-extension/demo.html
     ```
   - Notice the simulated urgent PayPal account suspension alert with lookalike URLs.

2. **Test Toolbar Popup Inspection**:
   - Click the **AfterClick** extension icon in your toolbar.
   - The compact popup opens (warm cream style matching the website).
   - Shows the current URL and page info.
   - Click **"Inspect this page"**:
     - Immediately exposes the real registered domain vs. fake subdomains.
     - Warns about lookalike impersonation.
   - Click **"Inspect visible page text and links"**:
     - Safely extracts rendered text without accessing forms or cookies.
     - Flags urgency threats, credential harvesting, and payment demands.
     - Detects link mismatches.

3. **Test Right-Click Context Menu**:
   - On the demo page, highlight the text:
     *"FINAL NOTICE: Unauthorized access detected. Your account will be permanently closed today."*
   - Right-click and choose **"Analyze with AfterClick"**.
   - An analysis tab opens with:
     - Inline colored highlights on detected threat words.
     - Specific warning sign cards with quoted evidence.
     - Extracted link dissection.
     - Copyable sanitized summary button.

4. **Test Emergency Handoff**:
   - Click **"I already interacted"** or choose **"Entered password"**.
   - The extension opens the AfterClick first-aid checklist (`/?incident=password&source=extension`).
   - The website immediately launches the tailored emergency triage workflow without asking the user to copy/paste anything sensitive.

---

## 🧪 Automated Tests

15 automated unit tests verify the deterministic rules engine and extension safeguards:
```bash
cd extension
npm run test
```

Tested criteria:
- [x] Legitimate registered-domain extraction (`tldts`)
- [x] Misleading subdomain structures (`paypal.com.secure-login.account-verify.top`)
- [x] IDN & Punycode hostnames (`xn--...`)
- [x] Raw IP address hosts (`192.168.1.1`)
- [x] URL shortener detection (`bit.ly`, etc.)
- [x] HTTP vs HTTPS interpretation (HTTPS does not imply safe)
- [x] Suspicious urgency and deadline language
- [x] Brand impersonation indicators
- [x] Non-overlapping highlight segmentation for UI
- [x] Empty, invalid, and malformed URL handling
- [x] Safe non-sensitive query parameter handoff
- [x] Sanitized report export without passwords/tokens
- [x] No false safety guarantees when no red flags are found
- [x] Restricted internal browser page detection (`chrome://`, `about:blank`)
- [x] Displayed link vs actual destination mismatch detection

---

## 🔒 Security & Privacy Commitments

- **No Remote Telemetry**: All inspection rules run locally in your browser memory.
- **Never Visits Malicious Sites**: Address inspection parses string structures using `tldts` and never initiates HTTP GET requests to suspicious targets.
- **Strictly Scoped Permissions**: Uses minimal permissions (`activeTab`, `scripting`, `contextMenus`, `storage`). Never runs background persistent web traffic monitoring.
- **No False Comfort**: Clean text explicitly states that an absence of known red flags does not guarantee safety.
