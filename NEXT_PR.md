# Next PR — WiGLE & OpenCellID Import + Android Settings Page

## Context
This file captures the exact pending work deferred from PR #29 so the next
Copilot session can start immediately without re-exploration.

---

## PR A — WiGLE & OpenCellID Import (Android `core` + `app`)

**Goal:** Let users seed the heuristics engine with data they already captured
via the WiGLE app or any OpenCellID export, dramatically improving evil-twin,
beacon-flood, and near-clone detection from the very first scan.

### New files — `core` module

| File | Purpose |
|------|---------|
| `core/.../WigleParser.kt` | Parse WiGLE CSV v1.4 → `WigleImportResult`; groups by UTC calendar day so `ThreatAnalyzer` gets one `ScanRecord` per day; RFC 4180 CSV tokeniser; multi-format date fallback |
| `core/.../OpenCellIdParser.kt` | Parse OpenCellID / Mozilla Location Service CSV → `OpenCellIdImportResult` |
| `core/.../CellTowerRecord.kt` | Data model: radio, mcc, mnc, lac, cid, lon, lat, rangeMeters, samples, averageSignal |
| `core/.../CellTowerStorage.kt` | JSON-backed storage, dedup by (radio:mcc:mnc:lac:cid), cap 5 000 towers |
| `core/src/test/.../WigleParserTest.kt` | CSV tokeniser, channel→freq mapping, happy path, malformed rows, non-WIFI skip, UTC day-bucketing |
| `core/src/test/.../OpenCellIdParserTest.kt` | Happy path, malformed rows, header skip, column-count validation |

### Modified files — `core` module

| File | Change |
|------|--------|
| `ScanStorage.kt` | Add `importWigleRecords(incoming)`: dedup by UTC-day bucket, merge-sort newest-first, trim to `maxRecords`; add `MS_PER_DAY` constant |

### New files — `app` module

| File | Purpose |
|------|---------|
| `app/.../ImportActivity.kt` | SAF `GetContent` file pickers (no extra manifest permissions needed); parsing on `Dispatchers.IO` via `lifecycleScope`; progress bar; result/error dialog showing network or tower counts |
| `app/res/layout/activity_import.xml` | Title card explaining import; two `MaterialButton`s ("Choose WiGLE CSV" / "Choose OpenCellID CSV"); `ProgressBar`; `TextView` status area |

### Modified files — `app` module

| File | Change |
|------|--------|
| `AndroidManifest.xml` | Add `<activity android:name=".ImportActivity" android:exported="false" />` |
| `res/values/strings.xml` | Import title, button labels, status strings, result/error messages |
| `HistoryActivity.kt` | Add `button_import` that launches `ImportActivity`; wire alongside existing export |
| `res/layout/activity_history.xml` | Replace single `button_export` with horizontal `LinearLayout` containing `button_import` (weight=1) + `button_export` (weight=1) |

### Integration note
After `importWigleRecords()` stores the parsed records, all 13 `ThreatAnalyzer`
checks automatically benefit — no other code changes needed.  GPS coordinates
from WiGLE records populate `ScannedNetwork.latitude/longitude`, ready for the
Google Maps integration.

---

## PR B — Android Settings Page

**Goal:** Let users fine-tune the app without touching code.

### New files

| File | Purpose |
|------|---------|
| `app/.../SettingsActivity.kt` | Full settings screen |
| `app/res/layout/activity_settings.xml` | Settings layout |
| `core/.../AppSettings.kt` | Data class + `SettingsStorage` (SharedPreferences-backed) |

### Settings to expose

| Category | Setting | Type |
|----------|---------|------|
| **Developer** | Developer mode toggle | Switch |
| **Scanning** | Scan interval (seconds) | Slider / number input (min 5 s, max 300 s) |
| **Scanning** | Auto-start monitoring on launch | Switch |
| **Upload** | WiGLE upload enabled | Switch |
| **Upload** | WiGLE API key | Text input (obscured) |
| **Upload** | OpenCellID upload enabled | Switch |
| **Upload** | OpenCellID API key | Text input (obscured) |
| **Export** | Auto-export after scan | Switch |
| **Threats** | Per-threat enable/disable | One Switch per `ThreatType` (15 total) |
| **Threats** | Sensitivity (low / medium / high) | Radio group — adjusts RSSI threshold + flood count |
| **Threats** | Suspicious RSSI threshold (dBm) | Slider (advanced / dev mode only) |
| **Threats** | Beacon flood threshold (new BSSIDs) | Slider (advanced / dev mode only) |
| **Threats** | Multi-SSID OUI threshold (SSIDs) | Slider (advanced / dev mode only) |

### Integration
- `ThreatAnalyzer` constructor already accepts `suspiciousKeywords` and
  `recentWindowMs`; extend it to accept a `SettingsSnapshot` so all thresholds
  are runtime-configurable without touching the analysis logic.
- `MainViewModel` reads `SettingsStorage` and passes a snapshot to
  `ThreatAnalyzer` on each scan.
- WiGLE / OpenCellID upload happens after `appendRecord()` when the
  corresponding toggle is enabled (fire-and-forget coroutine on `Dispatchers.IO`).

---

## PR C — Google Maps Integration (Android + Web)

**Goal:** Plot scanned networks on a live map; use cell towers for GPS-less
geolocation fallback.

### Prerequisites
- PR A merged (GPS coordinates on `ScannedNetwork`, `CellTowerStorage` populated)
- Google Maps API key configured (already prepped in `desktop/handlers/map.js`)

### Changes
- **Android**: Add `MapActivity` with Google Maps SDK; plot `ScannedNetwork`
  markers colour-coded by threat level; cluster nearby APs; tap marker → detail
  dialog (same content as existing `showNetworkDetailDialog`).
- **Cell-assisted geolocation**: `CellTowerStorage.findNearest(mcc, mnc, lac, cid)`
  returns the best-matching tower; used to set `lastKnownLocation` when GPS is
  unavailable (fallback chain: GPS → Network → CellTower → null).
- **Web (PWA)**: `NetworkMap.tsx` already uses Leaflet/OSM; swap tile layer to
  Google Maps when `NEXT_PUBLIC_GOOGLE_MAPS_KEY` is set.

---

## PR D — Wireshark Integration (Desktop)

**Goal:** Stream captured packets to a live Wireshark session from the desktop app.

### Design
- New `desktop/handlers/wireshark.js` — IPC handlers: `wireshark-start-capture`,
  `wireshark-stop-capture`, `wireshark-get-status`, `wireshark-open-file`.
- Uses `tshark` (CLI component of Wireshark) when available; falls back to pcap
  file export that user opens manually.
- `desktop/config/desktop.config.js` already has `features.wireshark: true` flag.
- Capture backend: routes through `windows-capture-manager.js` so Npcap/WSL2/
  vendor driver is selected automatically.

---

## PR E — Database & Server Backend (Desktop)

**Goal:** Replace the current in-memory scan store with a proper queryable DB;
prep for multi-device sync and the server backend.

### Design (already partially scaffolded)
- `database-sqlite.js` already exists (WAL mode, zero-install).
- `database.js` already has `DB_TYPE=auto` fallback (MongoDB → SQLite).
- Add schema migrations for `scan_records`, `networks`, `threats`, `cell_towers`.
- Expose query endpoints via new `routes/history.js` Fastify plugin.
- `desktop/config/desktop.config.js` `features.database: true` flag ready.
