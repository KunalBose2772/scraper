# Google Maps Scraper Engine v2

An industrial-grade, highly reliable, and modular Google Maps scraping engine built with Node.js, TypeScript, and Playwright. 

This engine is designed to run standalone or to be integrated into APIs, SaaS architectures, or backend jobs. It is built strictly as a CLI engine: no database, no auth, no dashboards, and no bloated dependencies.

---

## Key Architectural Features

1. **Two-Phase Separation (Listing vs Details)**:
   - **Phase 1 (Listing Collection)**: The engine searches Google Maps and scrolls the results container using `ScrollManager` to extract only the business names, Google IDs, and listing URLs. This runs to completion (or up to `maxResults`) in one session without loading detail panels.
   - **Phase 2 (Detail Extraction)**: The engine visits each listing URL directly, loading details in isolation. If any listing details fail to load or time out, it is handled gracefully without crashing the overall scraper.
2. **Tab Isolation**: When extracting website contacts (emails, phones, socials), the engine opens a temporary tab in the background, keeping the main Google Maps page stable.
3. **Resume Capability**: Real-time progress is saved in `state.json` inside the output directory. If the program terminates or the browser crashes, restarting the command immediately resumes at the exact business number where it left off.
4. **Browser Stability & Crash Recovery**: Incorporates automatic page and navigation retries, element wait states, and a graceful browser restart mechanism that recreates the context if Playwright experiences a hard crash or disconnection.
5. **No Obfuscation Dependencies**: The scraper uses stable CSS selectors targeting ARIA roles, attributes (`data-item-id`), and structural anchors (like `a[href*="/maps/place/"]`) rather than relying on randomized CSS classes which Google updates frequently.

---

## File Structure

```text
src/
├── config/
│   └── config.ts            # Configuration parser (loads CLI arguments & config.json)
├── constants/
│   └── index.ts             # Stable selectors & default system thresholds
├── scraper/
│   ├── browser/
│   │   └── browser-manager.ts # Browser instance creator, proxy binder & restart handler
│   ├── details/
│   │   └── detail-extractor.ts # Business detail field parser (robust try-catches)
│   ├── exporter/
│   │   └── exporter.ts      # Excel (.xlsx), CSV, and JSON file writers
│   ├── listings/
│   │   └── listing-collector.ts # Coordinator for Phase 1 (search & scroll)
│   ├── parser/
│   │   └── url-parser.ts    # Extracts Latitude, Longitude, and Decoded CID
│   ├── scrolling/
│   │   └── scroll-manager.ts # Smart scroller (nudge control, end of list detector)
│   └── website/
│       └── website-extractor.ts # Website contact scraper (emails, phones, social links)
├── types/
│   └── index.ts             # Strict TypeScript Type and Interface definitions
├── utils/
│   ├── logger.ts            # Timestamped logging utility (Console + logs.txt output)
│   └── state-manager.ts     # Save/load/clear mechanism for resume capability
└── index.ts                 # Main orchestrator (Process lifecycle manager)
```

---

## Installation Guide

### Prerequisites
- Node.js (version 18 or above recommended)
- npm (Node Package Manager)

### Steps
1. Navigate to the project folder:
   ```bash
   cd c:\Users\kunal\Desktop\Scraper
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Install Playwright Chromium binaries:
   ```bash
   npx playwright install chromium
   ```

---

## Configuration

Settings are resolved using the following order of precedence: **Defaults < `config.json` < CLI Arguments**.

A default `config.json` is automatically generated in the root of the project upon the first run.

### Configuration Fields
| Field | Type | Description | Default |
| :--- | :--- | :--- | :--- |
| `keyword` | `string` | Search query keyword (e.g., "Restaurant") | `"Restaurant"` |
| `location` | `string` | Location query parameter (e.g., "Mumbai") | `"Mumbai"` |
| `maxResults` | `number` | Maximum listings to scroll and collect | `100` |
| `outputFormat`| `string` | Export formats: `"CSV"`, `"JSON"`, `"EXCEL"`, or `"ALL"` | `"ALL"` |
| `headless` | `boolean`| Launch browser without visual head | `true` |
| `timeout` | `number` | Timeout in milliseconds for page navigations | `30000` (30s) |
| `retryCount` | `number` | Retries allowed for individual business detail failures | `3` |
| `proxy` | `string` | Proxy server (format: `http://[user:pass@]ip:port`) | `""` (Disabled) |
| `slowMo` | `number` | Delays Playwright operations by N milliseconds | `0` |
| `exportFolder`| `string` | Target folder for saved reports | `"output"` |

---

## Usage Examples

### 1. Simple Run (Using config.json)
Simply configure `config.json` in the root folder:
```json
{
  "keyword": "Dentist",
  "location": "New York",
  "maxResults": 50,
  "outputFormat": "ALL",
  "headless": true,
  "timeout": 30000,
  "retryCount": 3,
  "exportFolder": "output"
}
```
Run the scraper:
```bash
npm start
```

### 2. Override configurations via CLI Flags
To bypass the values in `config.json` directly from the command line:
```bash
npm run start -- --keyword "Gym" --location "London" --max-results 20 --headless false --format "CSV"
```

### 3. Run Test Script
A predefined testing script exists in `package.json` to verify everything is working with 10 results in headful mode:
```bash
npm run test-run
```

---

## Output Structure

Upon completion (or during, for logs), the scraper creates a folder matching the date inside `output/`:

```text
output/
└── scrape-2026-07-01/
    ├── config.json         # A copy of the configuration used for this run
    ├── logs.txt            # Full runtime execution logs with timestamps
    ├── results.csv         # Flat tabular data (arrays flattened)
    ├── results.json        # Hierarchical JSON data (preserves website details structure)
    └── results.xlsx        # Excel Sheet containing the scraped data
```

---

## Error Handling & Edge Cases
- **Captchas**: If Google Maps triggers a CAPTCHA, it is recommended to run in headful mode (`--headless false`) or routing via a high-quality residential proxy (`--proxy`).
- **No Search Results**: If Google Maps fails to find any results matching `{keyword} in {location}`, the scraper logs a warning, terminates cleanly, and avoids hanging.
- **Dead Sites**: If a business website is offline or infinite-loops, the `WebsiteExtractor` times out after 15 seconds, keeping the rest of the scrape running smoothly.
- **Missing Selectors**: Properties like phone number, rating, or website are checked defensively. If missing, they are recorded as `null` instead of throwing exceptions.
