# Copilot Instructions — WiFi Sentry

> These instructions govern ALL automated coding by GitHub Copilot, Copilot agent PRs, and AI-assisted
> development in this repository. Read and follow them entirely before making any change.

---

## 0. First Rule — Check Build Status

**Before writing a single line of code, check `BUILD_STATUS.md` in the repo root.**

- If any CI workflow marked `FAILING` or `ACTION_REQUIRED` on `main`: fix that first.
- Never create a PR that adds features on top of a broken build.
- If you cannot determine build status from the file, inspect the Actions tab before proceeding.

---

## 1. Project Overview

WiFi Sentry is a professional-grade wireless threat detection platform targeting:
- Evil Twin, Karma, and rogue access point detection
- Deauthentication flood, PMKID sniffing, and KRACK detection
- Active deauth/sniff detection against the user's device
- GPS-mapped threat visualization
- AI-assisted live and post-scan analysis (Google Gemini)
- Red team / Blue team operational modes
- Terminal-aesthetic UI with direct command input

**Platform targets:**
- Android (API 31+, Kotlin, Jetpack Compose for new UI, Activities for existing UI)
- Desktop (Electron + Fastify backend, Windows-first)
- Web dashboard (Next.js 16, Tailwind CSS)

**Architecture decision (final — do not change without explicit instruction):**
- MongoDB (Mongoose) is the PRIMARY database. Firebase is OPTIONAL cloud sync only.
- The Fastify backend is the single source of truth. All platforms call its API.
- Android native (Kotlin) is the primary sensor. Capacitor is NOT used. Do not add Capacitor.

---

## 2. Android / Kotlin Rules

### Scanner Chain (Critical — Do Not Break)
The app uses a priority-based scanner fallback chain. The order is fixed:

```
1. NexmonScanner      (Broadcom firmware patch, root, ARM64 only — ~6 phone models)
2. ShizukuWifiScanner (ADB-level privileges, no throttle)
3. UsbWifiScanner     (External USB adapter via OTG)
4. RootWifiScanner    (airmon-ng via Termux/Nethunter/UserLAnd/root shell)
5. StandardWifiScanner (Throttled WifiManager fallback — 4 scans/2min on Android 10+)
```

Rules:
- The app MUST compile and run fully on Standard tier (no root, no Shizuku). All advanced tiers are additive.
- Each scanner tier MUST be behind a build config flag so it can be disabled independently.
- `WatchdogService` monitors all scanners. If one fails, it MUST fall back silently to the next tier.
- Shizuku and Nexmon MUST be optional modules — do not hard-link them as required dependencies.
- NEVER call scanner operations on the main thread. All scanning runs on background threads/coroutines.

### Threading Rules (Critical — Was a Past Crash Cause)
- `RootChecker`, all scanner operations, and `GeminiAnalyzer` MUST run off the main thread.
- Use Kotlin coroutines (`viewModelScope.launch(Dispatchers.IO)`) for all I/O operations.
- UI updates MUST use `Dispatchers.Main` or `withContext(Dispatchers.Main)`.
- NEVER call `WifiManager` from the main thread without null-safety checks.

### Kotlin Coding Standards
- Use explicit types on lambda parameters — do not rely on type inference in `filterValues`, `map`, `flatMap`, etc. (KI-015 caused a build break from this).
- Use `?.let` and `?: return` patterns for null safety rather than `!!`.
- Coroutines scope: use `viewModelScope` in ViewModels, `lifecycleScope` in Activities/Fragments.
- State: use `StateFlow` and `SharedFlow` for observable state. Never use `LiveData` for new code.
- All new UI components use Jetpack Compose. Do not add new XML layouts.
- Minimum compile target: API 35. Minimum runtime target: API 31.

### Critical Permissions (Do Not Remove)
The following permissions in `AndroidManifest.xml` are required. Do NOT remove them:
- `USE_BIOMETRIC` — removing this causes a silent crash on Android 14+ (KI-014)
- `ACCESS_FINE_LOCATION` — required for WiFi scanning on all Android 10+ devices
- `ACCESS_WIFI_STATE`, `CHANGE_WIFI_STATE` — required for scanning
- `FOREGROUND_SERVICE` — required for background scanning service

### Android Dependency Rules
- Pin ALL Gradle dependency versions exactly. No `+` suffixes. No `latest.release`.
- When adding a new dependency, add it to `android-native/gradle/libs.versions.toml` first, then reference it.
- Do not change `compileSdk` or `targetSdk` without explicit instruction.
- Do not change `minSdk` below 31.

---

## 3. Node.js / Backend Rules

### Security (Non-Negotiable)
Every API change MUST maintain these security controls. If they are not present, add them before your change:
- `helmet()` middleware on all routes
- CORS restricted to `process.env.ALLOWED_ORIGINS` (not open)
- Rate limiting: 100 req/15min general, 5 req/15min on any auth route
- Joi validation on all POST/PUT/PATCH request bodies
- All child process `spawn()`/`exec()` calls use array argument form and sanitized inputs

### URL Configuration
- NEVER hardcode `localhost`, `127.0.0.1`, or any port number in frontend code.
- All API base URLs come from `process.env.NEXT_PUBLIC_API_URL` (frontend) or `process.env.API_URL` (backend-to-backend).
- Add any new environment variables to `.env.example` with a descriptive comment.

### Module System
- Backend uses CommonJS (`require`/`module.exports`). Do not introduce `import`/`export` syntax in backend files.
- Frontend (Next.js) uses ESM. Do not introduce `require()` in frontend files.
- Do not mix the two in any single file.

### Database
- MongoDB via Mongoose is the database. Do not add Firebase Firestore as a data store.
- Firebase is permitted only for: push notifications (FCM) and optional cloud sync.
- Do not add the `dataconnect` directory back. It was intentionally removed.

### Dependency Rules
- Pin ALL npm dependencies exactly (no `^` or `~`). Use `npm install --save-exact`.
- Do not add a dependency that duplicates functionality already in the project.
- Run `npm audit` before finalizing any dependency change. Zero high/critical vulnerabilities.

---

## 4. Next.js / Frontend Rules

- All pages are in `app/` directory (Next.js 13+ App Router). Do not add pages to `pages/`.
- Use Tailwind CSS for all styling. Do not add inline styles or separate CSS files for new components.
- Use `textContent`, `createElement`, and safe DOM methods. Never use `innerHTML` for user-controlled data.
- All API calls go through a single client utility. Do not call `fetch()` directly with hardcoded URLs.
- Dark theme with monospace font and neon accents is the design standard. Do not introduce light theme components.

---

## 5. Electron / Desktop Rules

- The Electron app wraps the Next.js frontend. Do not duplicate UI logic in the Electron main process.
- All native capabilities (file system, process spawning, Npcap) go through Electron IPC with explicit channel names.
- Sanitize all data crossing the IPC bridge. Never expose Node.js `require` or `shell` to the renderer.
- `contextIsolation: true` and `nodeIntegration: false` in all `BrowserWindow` configs. Do not change these.

---

## 6. CI / Workflow Rules

- Do not modify `.github/workflows/` files without explicit instruction.
- Do not disable or bypass any existing quality gate (SonarCloud, Detekt, ESLint, CodeQL).
- Every PR must pass all required status checks before merge. Do not merge with failing checks.
- APK signing secrets (`KEYSTORE_*`) are required for release builds. Do not add alternative signing logic.
- The `emergency-rollback.yml` workflow must remain functional at all times. If it is broken, fixing it takes priority over all other work.

---

## 7. File Organization Rules

### What belongs where
```
/                        — Only: README.md, KNOWN_ISSUES.md, BUILD_STATUS.md, LICENSE, .env.example, Dockerfile, .gitignore, .nvmrc, .gitleaks.toml
/docs/                   — All other .md documentation files
/android-native/         — All Kotlin/Android code
/backend/ (or server.js) — All Node.js/Fastify API code
/web/                    — All Next.js frontend code
/desktop/                — All Electron code
/shared/                 — OUI database, threat signatures, AI prompt templates
```

### Do Not Create
- Do not create new `.md` files in the repository root (use `docs/` instead)
- Do not create files in `dataconnect/` — this directory is removed
- Do not create a `capacitor.config.ts` — Capacitor is not used
- Do not create ad-hoc session logs or `REVIEW_SUMMARY.txt` style files

---

## 8. Threat Detection Standards

These are the threat types the app detects. Do not change detection thresholds without explicit instruction:

| Threat | Method | Severity | Threshold |
|---|---|---|---|
| Evil Twin | Duplicate SSID + different BSSID | HIGH | Any match |
| Karma Attack | Probe response to any client SSID | HIGH | Any instance |
| Deauth Flood (general) | Deauth frame count | HIGH | 15+ frames / 10 seconds |
| Deauth targeting this device | Deauth frame with device MAC as destination | HIGH | Any instance |
| PMKID Sniffing | EAPOL M1 from unassociated client | MEDIUM | Any instance |
| KRACK | Duplicate EAPOL M3 replay counter | HIGH | Any duplicate |
| WiFi Pineapple | Beacon pattern + OUI match | HIGH | Any match |
| Rogue HID | Bluetooth peripheral fingerprint | MEDIUM | Anomaly score > 0.7 |
| MAC Spoofing | OUI mismatch / randomization on known SSID | MEDIUM | Any mismatch |

False positive reduction (AI-assisted):
- GPS context: same BSSID at 3+ different locations = elevated confidence
- Time context: factor scan time and location type into risk scoring
- Scan history: new SSID not seen in last 30 days in this geofence = elevated alert

---

## 9. Red Team / Blue Team Mode

- Blue Team mode: passive detection only. No active probing. No frame injection.
- Red Team mode: requires biometric authentication before activation. Requires explicit user confirmation before each active operation. All actions logged locally with timestamp.
- Do not enable Red Team capabilities in the Play Store / public build. They are gated by a `BUILD_FLAVOR` build config flag.
- Never implement deauth injection, beacon injection, or client deassociation without both: (a) Red Team mode active, and (b) explicit per-action user confirmation.

---

## 10. What NOT to Do (Lessons from Build History)

These mistakes caused the 35+ failed Copilot branches and build failures in this repo's history:

| What not to do | Why |
|---|---|
| Add features while CI is red | Compounds failures — you won't know what broke what |
| Use implicit types in Kotlin lambdas | Caused KI-015 — `filterValues` type inference build break |
| Call `RootChecker` or scanners on the main thread | Caused KI-014 — silent crash on Android 14 |
| Remove `USE_BIOMETRIC` permission | Caused silent crash on Android 14 |
| Hardcode `localhost:3000` in frontend | Breaks every environment except local dev |
| Use `app.use(cors())` without origin restriction | Opens API to any domain |
| Use `innerHTML` with data | XSS vulnerability |
| Use `spawn(cmd, string)` form | Shell injection vulnerability |
| Add `^` to npm versions or `+` to Gradle versions | Silent breaking updates from upstream |
| Create new .md files in repo root | Documentation sprawl — use `docs/` |
| Mix Firebase and MongoDB as primary stores | Architectural conflict causes confusion |
| Add Capacitor to the project | Abandoned approach — native Kotlin is the decision |
| Attempt to merge multiple phases at once | Makes failures impossible to isolate |
| Change `SONAR_TOKEN` or workflow permission scopes | Breaks quality gate |

---

## 11. Asking Before Acting

If you are uncertain about any of the following, stop and create an issue rather than guessing:

- Which scanner tier a new capability belongs in
- Whether a dependency version is compatible
- Whether a change could affect the build pipeline
- Whether a permission is required for Android compatibility
- Whether a detection threshold should be changed
- Any change to `.github/workflows/` files

---

## 12. PR Standards

Every Copilot-generated PR must:
1. Reference the `KNOWN_ISSUES.md` issue ID it addresses (e.g., "Fixes KI-003")
2. Include a description of what was changed and why
3. Not mix multiple unrelated changes in one PR
4. Pass all CI checks before requesting review
5. Update `BUILD_STATUS.md` session log with a one-line summary of the change
6. Not leave TODO comments in code without a corresponding entry in `KNOWN_ISSUES.md`
