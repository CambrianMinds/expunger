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
| **06** | `06_Certificate_of_Service.pdf` | Proof of Service (Certified Mail / Hand Delivery) | Ind. Trial Rule 5 | Trial Court |
| **07** | `07_Proposed_Order_Granting_Expungement.pdf` | Proposed Judicial Order Directing Sealing (ISP, BMV, Court) | IC §§ 35-38-9-1–6 | Judge Signature |
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

---

## Running Automated Tests

The IC § 35-38-9 statutory decision engine is tested using Jest:

```bash
# Install dependencies
npm install

# Run the statutory test suite
npm test
```

---

## Project Structure

```text
indiana-expungement-assistant/
├── extension/                     # Chrome Extension (Manifest V3)
│   ├── manifest.json              # MV3 configuration with required permissions
│   ├── background.js              # Service worker handling downloads & tab routing
│   ├── content.js                 # In-browser Knockout observable scraper
│   ├── eligibility.js             # IC § 35-38-9 statutory decision engine
│   ├── pdf-lib.min.js             # Client-side PDF generation library
│   ├── icons/                     # Standard extension icons (16, 32, 48, 128px)
│   └── sidepanel/                 # Modular ES6 Civic sidepanel UI
│       ├── main.js                # Central entry point & lifecycle controller
│       ├── state.js               # Reactive global application state
│       ├── scanner.js             # Scraper orchestration & parity modal
│       ├── profile.js             # Petitioner profile & address management
│       ├── generator.js           # Packet generation workflow controller
│       ├── pdf-generator.js       # Client-side PDF layout & form generator
│       ├── ui.js                  # Toast notifications & checklist state
│       ├── utils.js               # DOM selectors & formatting utilities
│       ├── sidepanel.html         # Tabbed UI with alerts, modals & input guards
│       └── sidepanel.css          # Modern civic portal styling with glassmorphism
├── docs/                          # Public GitHub Pages civic portal
│   ├── index.html                 # Self-help guide & interactive eligibility calculator
│   ├── style.css                  # Dignified civic design system (slate, navy, gold)
│   ├── app.js                     # Calculator logic, tab navigation, checklist
│   └── assets/                    # Optimized public imagery & icons
├── tests/                         # Automated test suite
│   └── eligibility.test.js        # Jest tests for IC § 35-38-9 statutory rules
├── archive/                       # Archived legacy components & code
│   ├── README.md                  # Rationale and restoration documentation
│   ├── legacy_backend/            # Archived Python FastAPI & form engine
│   ├── legacy_python_tests/       # Archived pytest integration test suites
│   ├── legacy_extension_monolith/ # Archived monolithic sidepanel.js script
│   └── legacy_backend_and_monolith_archive.zip # Portable compressed archive
├── CHROMEWEBSTORE.md              # Chrome Web Store submission metadata, assets & justifications
├── LICENSE                        # MIT License (Justin Bogner · CambrianMinds)
├── package.json                   # Project npm scripts & Jest test configuration
├── .gitignore                     # Excludes local node_modules, logs, and temp files
└── README.md                      # Public project documentation & statutory guidance
```

---

## Developer Attribution & License

- **Developer:** Justin Bogner · [CambrianMinds](https://github.com/CambrianMinds)
- **License:** [MIT License](LICENSE)

*This project is an independent open-source initiative dedicated to promoting equal access to justice and a second chances under Indiana law.*
