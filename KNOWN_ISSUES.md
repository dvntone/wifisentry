# WiFi Sentry — Known Issues

> Last updated: 2026-03-05
> Update this file whenever a new issue is found or an existing issue is resolved.

---

## Status Key
- `[OPEN]` — Active issue, not yet fixed
- `[IN PROGRESS]` — Being worked on
- `[FIXED]` — Resolved (keep for 30 days then archive)
- `[WONT FIX]` — Deliberate decision not to fix

---

## Critical — Blocking

### KI-001 [OPEN] Release CI Build Failing
- **Affected:** `.github/workflows/release.yml` on `main` (commit `52f6bf4`)
- **Symptom:** "Release - Build & Deploy" workflow concludes with `failure`
- **Root cause:** Unknown — needs log inspection. Likely APK signing or artifact upload step.
- **History:** This class of failure appeared in v1.1.4 (artifacts never reached Releases page) and v1.1.7 (unsigned APK rejection). Fix was re-applied but may have regressed.
- **Impact:** No automated release APKs being published. Users cannot sideload latest version.
- **Fix needed:** Inspect `release.yml` logs. Verify `KEYSTORE_BASE64`, `KEYSTORE_STORE_PASSWORD`, `KEYSTORE_KEY_ALIAS`, `KEYSTORE_KEY_PASSWORD` secrets are set in repo settings.

### KI-002 [OPEN] SonarCloud Analysis Failing
- **Affected:** `.github/workflows/sonarcloud.yml` on `main` (commit `52f6bf4`)
- **Symptom:** SonarCloud workflow concludes with `failure`
- **Root cause:** Likely missing `SONAR_TOKEN` secret or `SONAR_ORGANIZATION` variable misconfiguration.
- **Impact:** Code quality gate is not running. Security issues may accumulate undetected.
- **Fix needed:** Verify `SONAR_TOKEN` and `SONAR_ORGANIZATION` are set in repo Settings > Secrets and Variables.

---

## Critical — Security (from CODE_AUDIT_REPORT.md)

### KI-003 [OPEN] CORS Fully Open
- **Affected:** `server.js` — `app.use(cors())`
- **Symptom:** Any domain can make API requests to the backend.
- **Fix needed:** Replace with `app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }))` and add `ALLOWED_ORIGINS` to `.env`.

### KI-004 [OPEN] No HTTP Security Headers
- **Affected:** `server.js` (Fastify/Express backend)
- **Symptom:** Missing Content-Security-Policy, HSTS, X-Frame-Options, etc.
- **Fix needed:** Add `helmet` middleware. `npm install helmet`, then `app.use(helmet())`.

### KI-005 [OPEN] No Rate Limiting on API Endpoints
- **Affected:** All API routes in `server.js` and `api/adapters.js`
- **Symptom:** Endpoints are open to brute-force and DDoS.
- **Fix needed:** Add `express-rate-limit` (100 req/15min general, 5 req/15min on auth routes).

### KI-006 [OPEN] No Input Validation
- **Affected:** All request handlers in `server.js`, `api/adapters.js`
- **Symptom:** Request bodies, params, and query strings are unsanitized.
- **Fix needed:** Add Joi schema validation on all POST/PUT/PATCH endpoints.

### KI-007 [OPEN] XSS via innerHTML
- **Affected:** `app.js`, `dashboard.js` (legacy files in root — also flagged for deletion)
- **Symptom:** DOM manipulation via `innerHTML` allows script injection.
- **Fix needed:** Replace with `textContent` and `createElement`. Note: these files should also be deleted as part of Phase 0 cleanup.

### KI-008 [OPEN] Unvalidated Shell Command Arguments
- **Affected:** `desktop/main.js`, `check-dependencies.js`
- **Symptom:** `spawn()` and `exec()` called with unsanitized user-controlled arguments.
- **Fix needed:** Validate and sanitize all arguments before passing to child processes. Use array form of `spawn()` instead of string form where possible.

---

## High Priority — Architecture

### KI-009 [OPEN] Hardcoded `localhost:3000` URLs
- **Affected:** Multiple Next.js frontend components
- **Symptom:** App breaks in any environment that isn't local development.
- **Fix needed:** Replace all hardcoded API URLs with `process.env.NEXT_PUBLIC_API_URL`. Update `.env.example` to document this variable.

### KI-010 [OPEN] Obsolete Files in Repository Root
- **Affected:** Root directory
- **Files to delete:**
  - `index.html`, `login.html`, `dashboard.html` (HTML-era prototype)
  - `app.js`, `styles.css` (HTML-era prototype)
  - `capacitor.config.ts` (Capacitor approach was abandoned in favor of native Kotlin)
  - `Gemini.yml` (duplicate — actual config is in `.github/workflows/`)
  - `aiService.js`, `config.js`, `check-dependencies.js` (superseded by backend modules)
  - `database-sqlite.js` (superseded by Android Room/SQLite in `android-native/`)
- **Impact:** Confuses contributors and AI agents about which files are authoritative.

### KI-011 [OPEN] Documentation Sprawl (32 .md Files in Root)
- **Affected:** Repository root
- **Symptom:** 32 markdown files in root with no clear hierarchy. New contributors and AI agents don't know which file to read first.
- **Fix needed:** Move all `.md` files (except `README.md`, `KNOWN_ISSUES.md`, `BUILD_STATUS.md`) into `docs/`. Create `docs/INDEX.md` as the entry point.

### KI-012 [OPEN] Database Architecture Conflict
- **Affected:** Documentation vs. codebase
- **Symptom:** Docs reference Firebase/Firestore, code uses MongoDB/Mongoose. `dataconnect/` directory contains unused Firebase Data Connect PostgreSQL files.
- **Decision made:** MongoDB (Mongoose) is primary. Firebase is optional sync layer only.
- **Fix needed:** Delete `dataconnect/` directory. Update README to reflect MongoDB-primary architecture.

### KI-013 [OPEN] No Single Entry Point
- **Affected:** Developer onboarding
- **Symptom:** Starting the app requires 5+ separate terminal commands. No `npm run dev` that starts all services.
- **Fix needed:** Add `concurrently` to root `package.json`. Create `npm run dev` script.

---

## Medium Priority — Android

### KI-014 [FIXED] Android 14 Silent Crash on Launch
- **Fixed in:** Commit `14435c4` — added `USE_BIOMETRIC` permission to `AndroidManifest.xml`
- **Note:** Keep `USE_BIOMETRIC` permission even if biometric UI is not yet implemented. Removing it causes a silent crash on Android 14+.

### KI-015 [FIXED] Kotlin Type Inference Error in `filterValues` Lambda
- **Fixed in:** Commit `02753606` (PR #35)
- **Note:** Do not use implicit `filterValues` on maps without explicit type annotation. Always specify the lambda parameter type explicitly.

### KI-016 [OPEN] No Shizuku Scanner Integration
- **Affected:** `android-native/core/.../WifiScanner.kt`
- **Symptom:** App only uses standard throttled WifiManager (4 scans/2 min on Android 10+) or root. No middle-ground option for non-rooted devices with Shizuku.
- **Fix needed:** Port `ShizukuWifiScanner.kt` from wscanPLUS. See merge plan Phase 1A.

### KI-017 [OPEN] No Scanner Fallback Chain / Watchdog
- **Affected:** `android-native/core/`
- **Symptom:** If primary scanner fails, app does not automatically fall back to next-best option.
- **Fix needed:** Port `WatchdogService.kt` and scanner orchestrator from wscanPLUS. See merge plan Phase 1A.

### KI-018 [OPEN] Missing Detection: Deauth Flood, PMKID, KRACK
- **Affected:** `android-native/core/.../ThreatAnalyzer.kt`
- **Symptom:** ThreatAnalyzer covers 11 indicators (Evil Twin, Pineapple, MAC spoof, etc.) but does not detect Deauth floods, PMKID sniffing, or KRACK.
- **Fix needed:** Port `AttackHeuristics.kt` from wscanPLUS. Merge into unified `ThreatEngine.kt`.

---

## Low Priority

### KI-019 [OPEN] Emergency Rollback Workflow Failing
- **Affected:** `.github/workflows/emergency-rollback.yml`
- **Symptom:** Concludes with `failure` on latest main commit.
- **Note:** This is a safety net workflow. A broken rollback means there is no automated recovery path if a bad release goes out.

### KI-020 [OPEN] Unpinned Dependency Versions
- **Affected:** Root `package.json`, `android-native/gradle/libs.versions.toml`
- **Symptom:** `^` prefixes in npm and `+` ranges in Gradle allow silent breaking updates.
- **Fix needed:** Pin all versions exactly. Run `npm shrinkwrap` or use `package-lock.json` strictly.

### KI-021 [OPEN] Mixed CommonJS/ESM Module Patterns
- **Affected:** Backend JS files
- **Symptom:** Some files use `require()`, others use `import`. This causes runtime errors in Node.js 18+ strict mode.
- **Fix needed:** Standardize on CommonJS (`require`) for the backend until a full ESM migration is planned.

### KI-022 [OPEN] `REVIEW_SUMMARY.txt` and Ad-hoc Files in Root
- **Affected:** `REVIEW_SUMMARY.txt`, `agent_coordination_log.md`
- **Note:** These are AI-generated session artifacts, not versioned project files. Move `agent_coordination_log.md` to `docs/` and delete `REVIEW_SUMMARY.txt`.

### KI-023 [FIXED] Microsoft C++ Code Analysis CI Failing (Missing CMakeLists.txt)
- **Fixed in:** PR #64 — added minimal `CMakeLists.txt` to repository root
- **Affected:** `.github/workflows/msvc.yml` — `Configure CMake` step
- **Symptom:** `CMake Error: The source directory does not appear to contain CMakeLists.txt.` — workflow fails on every push/PR.
- **Root cause:** The `msvc.yml` workflow runs `cmake -B build` but the project has no C++ code and therefore no `CMakeLists.txt`. The workflow was added as a GitHub security template without adapting it to this JavaScript/Android/Kotlin project.
- **Fix:** Added a minimal `CMakeLists.txt` (`project(WifiSentry LANGUAGES NONE)`) so CMake configures successfully. The MSVC Code Analysis action finds no C++ sources and produces a clean empty SARIF report.

---

## Archive (Resolved > 30 Days)

_Nothing archived yet._
