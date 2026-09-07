# Indiana Expungement Assistant

**Automated in-browser MyCase scraper and court-ready expungement packet generator for Indiana's Second Chance Law (Indiana Code § 35-38-9).**

[![Live Portal](https://img.shields.io/badge/Live_Portal-GitHub_Pages-blue?style=for-the-badge&logo=github)](https://cambrianminds.github.io/indiana-expungement-assistant/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Statute](https://img.shields.io/badge/Indiana_Code-IC_%C2%A7_35--38--9-emerald?style=for-the-badge)](https://iga.in.gov/laws/2023/ic/titles/35#35-38-9)
[![Developer](https://img.shields.io/badge/Developer-Justin_Bogner-indigo?style=for-the-badge)](https://github.com/CambrianMinds)

🌐 **Live Web Portal & Interactive Eligibility Calculator:** [https://cambrianminds.github.io/indiana-expungement-assistant/](https://cambrianminds.github.io/indiana-expungement-assistant/)

---

> ## 🛑 CRITICAL LEGAL WARNING: INDIANA'S LIFETIME ONE-SHOT RULE
>
> **INDIANA CODE § 35-38-9-9(i) STRICT STATUTORY LIMITATION:**
> Under Indiana law, **a person may petition for expungement of criminal conviction records ONLY ONCE IN THEIR ENTIRE LIFETIME.**
>
> - **Omission is Permanent and Irreversible:** If you omit or neglect to include any criminal conviction in your expungement petition, **YOU WILL PERMANENTLY LOSE THE RIGHT TO EVER EXPUNGE THAT CONVICTION FOR THE REST OF YOUR LIFE.**
> - **Multi-County 365-Day Window:** Under **IC § 35-38-9-9(d)**, if you have conviction records in more than one Indiana county, all petitions across all counties must be filed within a **365-day period**. Filing your first petition starts that lifetime countdown.
> - **Mandatory Pre-Filing Search:** You **MUST** search [mycase.in.gov](https://public.courts.in.gov/mycase/) for all legal names, maiden names, previous married names, and aliases across **ALL 92 Indiana counties** before submitting your petition.

---

> ## ⚖️ PUBLIC INTEREST MISSION & LEGAL SAFEGUARDS
>
> **The Public Accessibility Initiative:**
> Indiana's Second Chance Law (IC § 35-38-9) is one of the most transformative civil rights reforms in state history. It offers individuals who have paid their societal debt and maintained clean records an opportunity to remove old criminal records that hinder employment, housing, and civic participation.
>
> However, navigating complex local court rules and formatting formal legal pleadings is daunting. Private defense attorneys frequently charge **$1,500 to $3,500** for routine expungement petitions, placing second chances out of reach for working-class citizens.
>
> This open-source tool was designed and developed by **Justin Bogner** (an independent software developer) as a civic public service project to democratize access to standard Indiana court forms.
>
> **Strict Legal Disclaimers:**
>
> 1. **NOT AN ATTORNEY:** The developer is **NOT an attorney**, is not licensed to practice law in Indiana or any jurisdiction, and does not operate a law firm or legal referral service.
> 2. **NOT LEGAL ADVICE:** This software is an automated clerical data extraction and document formatting tool. It does **NOT** provide legal advice, case strategy, or legal representation.
> 3. **NO ATTORNEY-CLIENT RELATIONSHIP:** Using this software, website, extension, or documentation does **NOT** establish an attorney-client relationship.
> 4. **PRO SE RESPONSIBILITY:** You are filing **pro se** (representing yourself). You bear 100% of the responsibility to audit every case number, date, charge, and personal identifier before signing under penalty of perjury and filing with the Court Clerk.
> 5. **"AS IS" WARRANTY DISCLAIMER:** Provided **"AS IS" WITHOUT WARRANTY OF ANY KIND**. The developer disclaims all liability for errors, omissions, court rejections, prosecutorial objections, or omitted convictions.

---

## Privacy & Security: Zero Cloud Storage

Your personal information (Social Security Number, Date of Birth, Driver's License Number, and 10-year address history) is required by the court for the Confidential Information Sheet (ACR Form).

- **100% In-Browser Execution**: All data parsing, eligibility evaluation, and PDF form generation run entirely client-side inside your browser session using `pdf-lib`. No local server, Python installation, or remote API is required.
- **No Remote Telemetry**: Petitioner data is stored strictly in your browser's secure local `chrome.storage.local` and is never transmitted to external servers.
- **In-Browser Scraping**: All record discovery occurs client-side within your active, authenticated Indiana MyCase browser session.

---

## System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        GOOGLE CHROME BROWSER                           │
│                                                                        │
│   ┌────────────────────────┐      ┌────────────────────────────────┐   │
│   │  public.courts.in.gov  │◄────►│ Chrome Extension (Manifest V3) │   │
│   │  (User's Live Session) │      │ • Knockout.js Observable Reader│   │
│   │  • Search Results      │      │ • Client-Side CCS Fetcher      │   │
│   │  • Case Summaries      │      │ • IC § 35-38-9 Rules Engine    │   │
│   └────────────────────────┘      │ • Civic Sidepanel Interface    │   │
│                                   │ • Interactive Formatters & Acks│   │
│                                   │ • In-Browser PDF-Lib Engine    │   │
│                                   └───────────────┬────────────────┘   │
│                                                   │ In-Memory Blobs    │
│                                                   ▼                    │
│                                   ┌────────────────────────────────┐   │
│                                   │  Court-Ready Expungement Forms │   │
│                                   │  (Official Pro Se Pleadings    │   │
│                                   │   + Instructions & Warnings)   │   │
│                                   └────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation Highlights

### 🔍 Knockout.js Observable Scraping (Why It's The Only Viable Approach)

Indiana's MyCase portal is built on the Odyssey justice platform, which renders its UI entirely through **Knockout.js** — a reactive MVVM framework that binds case data, charges, and disposition events to a JavaScript observable view-model before the page renders.

The content script reads this observable model directly via `ko.dataFor()` on the root Knockout-bound element. This means the scraper reads structured JavaScript objects — not HTML — giving it access to the full case data graph regardless of what the DOM looks like visually:

```javascript
const koRoot = document.querySelector('[data-bind]');
const vm = ko.dataFor(koRoot);
const cases = ko.unwrap(vm.SearchResults) || ko.unwrap(vm.caseList);
```

**Why not CSS selectors?** The Odyssey platform's HTML template structure changes with every court system update. Any selector-based scraper breaks the moment Indiana updates its frontend — which happens frequently with no public changelog. By reading the reactive data model directly, the tool is resilient to template re-renders, column reordering, and CSS class changes, because the underlying object structure is governed by the court's own data schema.

**Fallback chain when KO is unavailable:**
1. Structured DOM traversal using stable ARIA roles and `data-bind` attributes
2. CCS `fetch()` call to the Odyssey case detail endpoint with `credentials: 'same-origin'` and an 800–1500ms randomized jitter delay (to mimic human browsing and avoid rate limiting)

---

### ⚖️ IC § 35-38-9 Statutory Decision Engine

`eligibility.js` is a self-contained IIFE that attaches to `window.IndianaExpungement` for browser use and also exposes `module.exports` for CommonJS (Jest tests). **It is intentionally not an ES module** — it is loaded as a plain `<script>` tag before the module-type `main.js` entry point, because the Chrome content script pipeline requires it to be available globally before `content.js` executes.

The engine evaluates each case against all five statutory tiers:

| Tier | Statute | Standard | Wait Period |
|------|---------|----------|-------------|
| Non-Convictions | IC § 35-38-9-1 | **Mandatory Grant** | ≥ 1 year from arrest/dismissal |
| Misdemeanors | IC § 35-38-9-2 | **Mandatory Grant** | ≥ 5 years from conviction |
| Class D / Level 6 Felonies | IC § 35-38-9-3 | **Mandatory Grant** | ≥ 8 years from conviction |
| Major Felonies (Levels 1–5) | IC § 35-38-9-4 | **Discretionary** | ≥ 8 years from conviction |
| Serious Bodily Injury Felonies | IC § 35-38-9-5 | **Prosecutor Consent Required** | ≥ 10 years from conviction |

**Key design decisions:**
- **Section 1 decoupling:** Non-conviction records (arrests, dismissals, acquittals under IC § 35-38-9-1) carry **no lifetime limit** and are explicitly excluded from the 365-day multi-county consolidation clock (IC § 35-38-9-9(d)), which governs only conviction tiers. An arrest-only petition never blocks conviction expungements in other counties.
- **Integer day arithmetic:** The 365-day consolidation window uses `Math.floor((today - priorDate) / 86400000)` — exact integer day counts, not month arithmetic — preventing leap-year edge cases from inadvertently expiring a valid filing window.
- **Indiana Trial Rule 6(A) rollover:** When fewer than 14 days remain in the window, the engine computes the exact 365th calendar day and alerts if it falls on a weekend, legal holiday, or court closure (deadline extends to the next business day).

---

### 📄 In-Browser PDF Generation (pdf-lib)

All 10 court pleadings are assembled client-side using the vendored `pdf-lib.min.js` — no server, no upload, no cloud rendering. The `pdf-generator.js` context engine enforces **Indiana Trial Rule 10** formatting constraints throughout:

- 8.5 × 11 in (612 × 792 pt), 72 pt (1-inch) margins all sides
- 12 pt minimum, black-only (`#000000`), Times New Roman / Georgia / Arial families
- Double-spaced body text; single-spaced tables and footnotes
- Bottom-center page numbers starting at 1
- Caption block: court name, party title, cause number, Rule 7(A) designation

Interactive **fillable form fields** are embedded via pdf-lib's `PDFAcroForm` API so petitioners can type PII directly into the PDF instead of handwriting it — reducing transcription errors on the Confidential Information Sheet (DOC 03).

---

### 🏛️ Bifurcated DOC 07 Relief (Mixed Batches)

When a packet contains both IC § 35-38-9-1 non-conviction records and conviction-tier records in the same county, DOC 07 (Proposed Order) cleanly bifurcates the relief section:

**Section 1 subsection (non-convictions):**
- Decrees permanent redaction and sealing under IC § 35-38-9-1/10
- Affirms that petitioner shall be treated as never having been arrested or charged
- **Omits civil rights restoration language** — civil rights were never lost for dismissed/arrest records

**Conviction subsection (IC §§ 35-38-9-2 through 35-38-9-5):**
- Enforces statutory access restrictions under IC §§ 35-38-9-6 and 35-38-9-7
- Explicitly restores full civil rights (voting, public office, jury service) under IC § 35-38-9-10
- The lifetime one-shot finding (IC § 35-38-9-9(i)) is included **only** when conviction tiers are present

Courts reject blanket orders that apply conviction-level restrictions to dismissed charges, or that purport to restore civil rights for non-conviction records. Bifurcation eliminates this as a rejection vector for mixed-batch petitions.

---

### 📋 Prior XP Cause Number in Affirmative Pleadings

When a petitioner has already filed in County A and is now filing in County B within the 365-day consolidation window, the tool captures:
- **Prior filing county** (from a dropdown of all 92 Indiana counties)
- **Prior filing date** (date input for exact integer-day arithmetic)
- **Prior XP cause number** (optional, e.g., `49D01-2501-XP-000123`)

This data is injected into DOC 04 (Verified Petition) and DOC 05 (Prosecutor Notice) as affirmative statutory averments:

> *"Petitioner previously filed a petition for expungement in Marion County on January 15, 2025 under Cause No. 49D01-2501-XP-000123, and this petition is timely submitted within the 365-day consolidation period prescribed by IC § 35-38-9-9(d)."*

Providing the specific cause number transforms an unverified claim into an instantly auditable Odyssey docket reference. A deputy prosecutor can verify the prior filing date within seconds — eliminating defensive motions for clarification or evidentiary hearings.

---

### 📮 Form 06 Service Method Pre-Selection

DOC 06 (Certificate of Service) pre-marks the correct method checkbox based on the petitioner's UI selection:

```
[X] Indiana Odyssey E-Filing System (IEFS)      [  ] Certified Mail      [  ] First Class Mail
```

Pro se filers frequently file through IEFS while leaving paper mail boxes checked (or vice versa), creating an ambiguous certificate of service on the docket. The synchronized selector closes this gap between Indiana Trial Rule 5 requirements and actual filing mechanics.

---

### 🧪 Dual-Tree Parity & Automated Test Suite

The codebase maintains two parallel source trees that must remain identical for all shared modules:

| Tree | Entry Point | Purpose |
|------|------------|---------|
| `extension/sidepanel/` | `sidepanel.html` | Chrome Manifest V3 extension |
| `docs/app/` | `app.html` | Standalone web app (GitHub Pages) |

A dedicated `scripts/check-parity.js` script enforces **byte-exact equality** between both `pdf-generator.js` files as part of the `npm test` pipeline. Any character-level discrepancy between the trees fails the build:

```bash
npm test
# Runs: jest + check-parity.js + check-i18n.js + check-disclaimers.js
# 20 Jest assertions · ~500ms total runtime
```

**Jest coverage includes:**
- Section 1 non-conviction decoupling from the 365-day clock
- Cross-county conviction blocking at exactly day 365 and day 366
- Leap year boundary arithmetic (Feb 29 filing dates)
- All statutory disqualification categories (sex offenses, public servant misconduct, homicide)
- `extractCaseTypeCode`, `yearsElapsed`, and `assessEligibility` function contracts

---

## Court Forms Generated (10 Official Pleadings)

Every packet generated by the tool contains standard Indiana Office of Court Services (IOCS) pro se pleadings formatted for immediate court filing:

| # | Document File Name | Formal Legal Description | Authority | Destination |
| --- | --- | --- | --- | --- |
| **00** | `00_CRITICAL_WARNING_AND_INSTRUCTIONS.pdf` | Step-by-Step Pro Se Filing Walkthrough & One-Shot Alert | IC § 35-38-9-9(i) | Petitioner Copy |
| **00** | `00_COMPLETE_EXPUNGEMENT_PETITION_PACKET.pdf` | Consolidated Master Court Packet (All Pleadings Combined) | Indiana Rules of Court | Court Filing |
| **01** | `01_Appearance_Form.pdf` | Appearance Form for Self-Represented Person | Ind. Trial Rule 3.1 | County Clerk |
| **02** | `02_Notice_of_Exclusion_Confidential_Info.pdf` | Notice of Exclusion of Confidential Information | ACR Rule 5 | Public Court File |
| **03** | `03_Confidential_Information_Sheet.pdf` | Confidential Information Sheet (SSN, DOB, DL#, Addresses) | ACR Rule 5 & IC § 35-38-9-8(b) | Sealed Envelope |
| **04** | `04_Verified_Petition_for_Expungement.pdf` | Verified Petition Itemizing All Causes & Affirmations | IC §§ 35-38-9-1–4 | Presiding Judge |
| **05** | `05_Notice_of_Filing_to_Prosecutor.pdf` | Formal 30-Day Notice of Filing to County Prosecutor | IC § 35-38-9-9(g) | Prosecutor |
| **06** | `06_Certificate_of_Service.pdf` | Proof of Service (Certified Mail / Hand Delivery / IEFS) | Ind. Trial Rule 5 | Trial Court |
| **07** | `07_Proposed_Order_Granting_Expungement.pdf` | Proposed Judicial Order Directing Sealing (ISP, BMV, Court) — Bifurcated for Mixed Batches | IC §§ 35-38-9-1–7, 35-38-9-10 | Judge Signature |
| **08** | `08_Fee_Waiver_Request_and_Order.pdf` | Verified Request to Waive $157 Civil Filing Fee & Order | IC § 33-37-3-2 | Presiding Judge |

---

## Statutory Eligibility Matrix (IC § 35-38-9)

| Indiana Code | Offense Classification | Statutory Waiting Period | Legal Standard |
| --- | --- | --- | --- |
| **IC § 35-38-9-1** | Arrests, Dismissed Charges, Not Guilty Verdicts, Infractions | **≥ 1 year** from date of arrest or dismissal | **Mandatory Grant** (Court must grant if statutory prerequisites are met) |
| **IC § 35-38-9-2** | Misdemeanor Convictions (Class A, B, C) | **≥ 5 years** from date of conviction / sentencing | **Mandatory Grant** |
| **IC § 35-38-9-3** | Class D & Level 6 Felonies (Without Serious Bodily Injury) | **≥ 8 years** from date of conviction / sentencing | **Mandatory Grant** (Subject to statutory disqualifications) |
| **IC § 35-38-9-4** | Major Felonies (Classes A, B, C; Levels 1, 2, 3, 4, 5) | **≥ 8 years** from conviction OR **≥ 3 years** from sentence completion | **Discretionary Grant** (Court holds judicial discretion) |
| **IC § 35-38-9-5** | Felonies Involving Serious Bodily Injury | **≥ 10 years** from conviction OR **≥ 5 years** from sentence completion | **Discretionary** (Requires written Prosecutor consent) |

*Note: In computing waiting periods for convictions, statutory law counts from the **Date of Conviction / Sentencing**, whereas non-convictions (dismissals) count from the **Date of Arrest or Dismissal**.*

---

## 📖 How to Prepare Your Petition (2 Easy Methods)

You can use the Indiana Expungement Assistant in two ways. Both methods execute 100% locally in your browser with zero servers, zero tracking, and complete privacy.

### Method 1: The Web App & Bookmarklet (Recommended - No Install)

This is the easiest method. It works in any modern browser (Chrome, Edge, Safari, Firefox) and doesn't require installing any extensions.

**Step 1: Save the Bookmarklet**

1. Navigate to the [Live Web Portal](https://cambrianminds.github.io/indiana-expungement-assistant/app/app.html).
2. Under "1-Click Bookmarklet Exporter", drag the blue **⚖️ Export MyCase Data** button to your browser's bookmarks bar.

**Step 2: Export from MyCase**

1. Go to [Indiana MyCase (public.courts.in.gov)](https://public.courts.in.gov/mycase/) and search for your name.
2. *Crucial Rule:* Search across **All Counties** and include any maiden names or aliases.
3. Once your search results load, click the **⚖️ Export MyCase Data** bookmark you saved.
4. A secure overlay will appear. Click **Full Deep Export**. The bookmarklet will automatically deep-scrape the required Chronological Case Summary (CCS) details for all your cases and download a `mycase-expungement-data.json` file to your computer.

**Step 3: Generate Your Packet**

1. Go back to the [Live Web Portal](https://cambrianminds.github.io/indiana-expungement-assistant/app/app.html) (Import Records tab).
2. Drag and drop your downloaded `mycase-expungement-data.json` file into the upload area.
3. Review your statutory eligibility on the **Results** tab.
4. Fill out your legal identifiers on the **Profile** tab.
5. On the **Generate** tab, acknowledge the legal disclaimers and click **Generate Complete Petition Packet**. The tool will generate your 10-pleading court-ready PDF (typically 12–18 pages depending on case count).

---

### Method 2: The Chrome Extension (Developer Mode)

If you prefer an integrated sidepanel experience in Google Chrome, you can install the extension locally.

**Step 1: Load the Chrome Extension**

1. Clone or download this repository:

   ```bash
   git clone https://github.com/CambrianMinds/indiana-expungement-assistant.git
   ```

2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the upper-right corner).
4. Click **Load unpacked** and select the `extension/` directory from this downloaded project.
5. Pin the **Indiana Expungement Assistant** (scales of justice icon) to your Chrome toolbar.

**Step 2: Open the Sidebar & Scan**

1. Navigate to your search results on [Indiana MyCase](https://public.courts.in.gov/mycase/).
2. Click the extension icon to open the Chrome Sidepanel.
3. Click **Scan Page & Check Eligibility**. The extension parses your cases and dispositions directly.
4. If you have cases under other names or in other counties, leave **"Merge across searches"** checked and run another search. Click Scan again to accumulate all cases into one master petition.

**Step 3: Generate Your Packet**

1. Follow the same flow in the sidebar: review the **Results** tab, fill out the **Profile** tab, and finally go to the **Generate** tab to download your court-ready PDF.

---

### Final Step (For Both Methods): Sign, File, and Serve Your Documents

1. **Print** the downloaded PDF file.
2. **Sign in ink:** Hand-sign the physical signature lines across all pleadings under penalty of perjury.
3. **File with the Clerk:** File the original documents (Appearance, Confidential Sheets under seal, Verified Petition, and Proposed Order) with the Circuit or Superior Court Clerk in the county where your convictions occurred. You can submit in person at the clerk's window or e-file via the [Indiana E-Filing System (IEFS)](https://www.in.gov/courts/efile/).
4. **Serve the Prosecutor & Agencies:** Under IC § 35-38-9-8(e), serve copies of the petition and Notice of Filing on the County Prosecuting Attorney via Certified Mail or IEFS e-service, as itemized on Form 06 (*Certificate of Service*).
5. **Post-Order Distribution:** After the judge signs DOC 07, verify with the court clerk whether they automatically transmit the signed order to ISP and BMV electronically. In many rural counties, you must obtain physical certified copies from the clerk's counter and mail them yourself to the Indiana State Police Criminal History Repository (100 N. Senate Ave., Indianapolis, IN 46204) and BMV (PO Box 6008, Indianapolis, IN 46206).

---

## Running Automated Tests

The IC § 35-38-9 statutory decision engine is tested using Jest:

```bash
# Install dependencies
npm install

# Run the statutory test suite (jest + parity + i18n + disclaimers)
npm test
```

---

## Project Structure

```text
indiana-expungement-assistant/
├── extension/                     # Chrome Extension (Manifest V3)
│   ├── manifest.json              # MV3 configuration with required permissions
│   ├── background.js              # Service worker handling downloads & tab routing
│   ├── content.js                 # In-browser Knockout observable scraper (primary) + CCS fetch fallback
│   ├── eligibility.js             # IC § 35-38-9 statutory decision engine (IIFE, not ES module)
│   ├── pdf-lib.min.js             # Vendored client-side PDF generation library
│   ├── icons/                     # Standard extension icons (16, 32, 48, 128px)
│   └── sidepanel/                 # Modular ES6 Civic sidepanel UI
│       ├── main.js                # Central entry point & lifecycle controller
│       ├── state.js               # Reactive global application state
│       ├── scanner.js             # Scraper orchestration & parity modal
│       ├── profile.js             # Petitioner profile & address management
│       ├── generator.js           # Packet generation workflow controller
│       ├── pdf-generator.js       # Client-side PDF layout & form generator (Trial Rule 10)
│       ├── ui.js                  # Toast notifications & checklist state
│       ├── utils.js               # DOM selectors & formatting utilities
│       ├── county-directory.js    # Verified clerk/prosecutor/ISP/BMV service addresses (92 counties)
│       ├── sidepanel.html         # Tabbed UI with alerts, modals & input guards
│       └── sidepanel.css          # Modern civic portal styling with glassmorphism
├── docs/                          # Public GitHub Pages civic portal
│   ├── index.html                 # Self-help guide, interactive eligibility calculator & technical docs
│   ├── style.css                  # Dignified civic design system (slate, navy, gold)
│   ├── app.js                     # Calculator logic, tab navigation, checklist
│   ├── bookmarklet.js             # 1-click MyCase bookmarklet exporter
│   └── app/                       # Standalone web app (mirrors extension/sidepanel/)
│       ├── app.html               # Tabbed web app UI (parallel to sidepanel.html)
│       ├── main.js                # Web app entry point
│       ├── generator.js           # Web app packet generation controller
│       ├── pdf-generator.js       # Byte-for-byte identical to extension/sidepanel/pdf-generator.js
│       └── pdf-lib.min.js         # Vendored pdf-lib (same as extension copy)
├── tests/                         # Automated test suite
│   ├── eligibility.test.js        # 20 Jest assertions for IC § 35-38-9 statutory rules
│   └── canary-schema.test.js      # Canary test ensuring payload schema integrity
├── scripts/                       # Build & validation scripts
│   ├── check-parity.js            # Enforces byte-exact equality between both pdf-generator.js trees
│   ├── check-i18n.js              # Validates all translation keys are complete across all locales
│   └── check-disclaimers.js       # Validates mandatory legal disclaimer IDs in both HTML files
├── locales/                       # Internationalization translation files
├── archive/                       # Archived legacy components & code
│   ├── README.md                  # Rationale and restoration documentation
│   ├── legacy_backend/            # Archived Python FastAPI & form engine
│   └── legacy_extension_monolith/ # Archived monolithic sidepanel.js script
├── AGENTS.md                      # AI agent coding rules & project constraints
├── CHROMEWEBSTORE.md              # Chrome Web Store submission metadata & justifications
├── formatting.md                  # Indiana Trial Rule 10 PDF formatting constraints reference
├── LICENSE                        # MIT License (Justin Bogner · CambrianMinds)
├── package.json                   # Project npm scripts & Jest test configuration
└── README.md                      # This file
```

---

## Developer Attribution & License

- **Developer:** Justin Bogner · [CambrianMinds](https://github.com/CambrianMinds)
- **License:** [MIT License](LICENSE)

*This project is an independent open-source initiative dedicated to promoting equal access to justice and a second chance under Indiana law.*
