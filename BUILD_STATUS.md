# WiFi Sentry — Build Status

> Last updated: 2026-03-08
> Update this file at the START and END of every development session.
> Rule: Never write new code on top of a broken build. Fix red first.

---

## Current Health: IMPROVING

| Component | Status | Last Good Commit | Notes |
|---|---|---|---|
| Android APK | BUILDING | `4f7e154` | CI/CD Android build passing on main |
| Node.js Backend | PASSING | `4f7e154` | Fastify with helmet, CORS, rate-limiting — security controls verified |
| Next.js Frontend | BUILDING | `4f7e154` | Ubuntu CI build passing; Google Fonts blocked in sandbox env |
| Electron Desktop | BUILDING | `4f7e154` | `desktop:build-win` fixed in prior PR |
| DB Integration Tests | PASSING | `4f7e154` | `db-integration.yml` — green on main |
| Release Pipeline | PASSING | `98feab1` | `release.yml` — latest run succeeded (PR #44 merge) |
| Detekt | PASSING | `6ff81d5` | `detekt.yml` — green; jq path fix merged in PR #49 |
| Secret Scan (gitleaks) | PASSING | `6ff81d5` | `secret-scan.yml` — green |
| CodeQL Advanced | PASSING | `88828c0` | `codeql.yml` — last completed run succeeded |
| SonarCloud | FAILING | last green unknown | `sonarcloud.yml` — verify SONAR_TOKEN secret |
| Emergency Rollback | FAILING | last green unknown | `emergency-rollback.yml` — all runs fail |
| MSVC Code Analysis | FAILING | never green | `msvc.yml` — new workflow, consistently failing |

---

## CI Workflow Status (as of 2026-03-08)

### wifisentry/main @ `4f7e154`

| Workflow | Result | Action Required |
|---|---|---|
| CI/CD - Build & Test | SUCCESS | None |
| DB Integration Tests | SUCCESS | None |
| Release - Build & Deploy | SUCCESS | None (latest run at `98feab1` passed) |
| Gemini Scheduled Issue Triage | SUCCESS | None |
| Gemini Dispatch | SUCCESS | None |
| Detekt | SUCCESS | None (jq path fix merged in PR #49) |
| Secret Scan (gitleaks) | SUCCESS | None |
| CodeQL Advanced | SUCCESS | None (last completed run passed) |
| SonarCloud Analysis | FAILURE | Verify SONAR_TOKEN secret is set |
| Emergency Rollback | FAILURE | All runs fail — investigate logs |
| Microsoft C++ Code Analysis | FAILURE | New workflow — consistently failing, needs investigation |

---

## Known Broken Areas (Do Not Build On Top Of)

1. **SonarCloud** — Quality gate is dark. Fix KI-002 before any security-sensitive code changes.
2. **Emergency Rollback** — Safety net is broken. Fix KI-019 before any production deployments.
3. **MSVC Code Analysis** — New workflow, all runs fail. Investigate `msvc.yml` configuration.

---

## What Is Safe to Work On Right Now

- Android feature work (CI/CD, release, and Detekt all green)
- Backend API changes (Node.js backend passing, DB integration tests green)
- Frontend UI changes (Next.js build passing)
- Desktop improvements (build-win fixed)
- `docs/` reorganization (no code changes, zero build risk)
- Deleting obsolete root files (KI-010) — no code changes

---

## Session Log

### 2026-03-08 — Status PR update: refresh CI/CD statuses
- Updated BUILD_STATUS.md component table and CI workflow table to reflect current GitHub Actions results
- Release pipeline now PASSING on main (`98feab1`, PR #44 merge) — updated from FAILURE; KI-001 resolved
- Added newly tracked workflows: Detekt (PASSING), Secret Scan (PASSING), CodeQL Advanced (PASSING), MSVC Code Analysis (FAILING)
- Electron Desktop status updated from FIXING to BUILDING (desktop:build-win fix confirmed)
- Updated last good commit references from `c9416cf` to `4f7e154` (latest main HEAD after PR #49 merge)
- Updated "Known Broken Areas" section: removed release pipeline, added MSVC Code Analysis
- Expanded "What Is Safe to Work On" to include Android feature work, backend API changes, and frontend UI changes
- Updated KNOWN_ISSUES.md: marked KI-001 as FIXED (release pipeline passing)

### 2026-03-08 — Code audit: fix version strings, template literals, XSS, Next.js config
- Fixed invalid semver version `"1.2.8m"` → `"1.2.8"` in `package.json` and `android-native/app/build.gradle`
- Fixed escaped template literals in `web-app/src/app/playground/page.tsx` (lines 55, 61): `\${...}` → `${...}`; tab buttons were rendering literal `${...}` text instead of active class
- Fixed XSS vulnerability in `playground/page.tsx`: replaced `dangerouslySetInnerHTML={{ __html: renderedContent }}` with sandboxed `<iframe sandbox="" srcDoc={...}>` to isolate user-controlled HTML
- Removed invalid Next.js 16 config option `eslint.ignoreDuringBuilds` from `web-app/next.config.ts` (not in `NextConfig` type — was causing `tsc --noEmit` errors)

### 2026-03-08 — Fix desktop:build-win CI failure (Cannot find module '@tailwindcss/postcss')
- Root cause: `desktop:build-win` script was `npm run web:build && npm run desktop:build`, causing the Windows CI step to re-run the Next.js build without web-app node_modules installed
- Fixed `desktop:build-win` to `npm run desktop:build` (CI downloads pre-built web artifacts; no rebuild needed)
- Fixed `build:all` script: was calling `desktop:build-web` which just re-ran `web:build` and never built the Electron app; now correctly calls `desktop:build`
- Fixed `web-app/package.json`: pinned all dependency versions exactly (removed `^`/`~`), removed unused `@dataconnect/generated` dead dependency
- Created `docs/ROADMAP.md` with Now/Next/Later buckets covering CI/CD improvements, Android code quality, and repo hygiene
- PR addresses CI run #22810673223 / job #66167117143: compilation errors in `MainActivity.kt` (Context import) and `ScanResultAdapter.kt` (exhaustive when) were already resolved in prior PR #41; roadmap documents the strategy to prevent recurrence

### 2026-03-08 — Android version bump 1.2.8 → 1.2.9
- Bumped `versionCode` 25 → 26 and `versionName` "1.2.8" → "1.2.9" in `android-native/app/build.gradle`
- Updated `android-native/README.md` "Project versioning" section to reflect new versionCode/versionName
- Updated root `README.md` version badge, `docs/agent_coordination_log.md` current version, and `docs/ARCHITECTURE_BLUEPRINT.md` version header

### 2026-03-08 — Fix CodeQL build failures
- Fixed Kotlin compilation error: added missing `import android.content.Context` to `MainActivity.kt`
- Fixed exhaustive `when` expressions in `ScanResultAdapter.kt`: added `PMKID_SNIFFING` and `KRACK` branches to `displayName()` and `detailDescription()`
- Added string resources for PMKID sniffing and KRACK threat types in `strings.xml`
- Resolves CodeQL autobuild failure from workflow run #22810214602

### 2026-03-05 — Initial assessment
- Reviewed all docs and CI history
- Identified 22 known issues (see KNOWN_ISSUES.md)
- Build pipeline in degraded state
- Created tracking files (KNOWN_ISSUES.md, BUILD_STATUS.md)
- Created Copilot instructions with new standards
- Phase 0 cleanup initiated

---

## How to Update This File

At the **start** of each session:
1. Check GitHub Actions tab for latest run results
2. Update the table above
3. Note what is safe to work on

At the **end** of each session:
1. Record what was done in Session Log
2. Update component statuses if anything changed
3. Note any new issues discovered (add to KNOWN_ISSUES.md)

---

## Build Commands Reference

```bash
# Backend only
npm start                    # port 3000

# Frontend only
npm run web:dev              # Next.js on port 3001

# All services (once npm run dev is set up — KI-013)
npm run dev

# Android (via CI — preferred)
# Push to branch, let GitHub Actions build it
# Download APK from Actions > Artifacts

# Android (local — requires Android Studio + Java 17)
cd android-native
./gradlew assembleDebug

# Run backend tests
npm test

# Run Android unit tests
cd android-native && ./gradlew test
```

---

## Secrets Checklist (Required for CI to Pass)

Go to: `https://github.com/dvntone/wifisentry/settings/secrets/actions`

| Secret | Required For | Status |
|---|---|---|
| `KEYSTORE_BASE64` | Android release signing | Verify |
| `KEYSTORE_STORE_PASSWORD` | Android release signing | Verify |
| `KEYSTORE_KEY_ALIAS` | Android release signing | Verify |
| `KEYSTORE_KEY_PASSWORD` | Android release signing | Verify |
| `SONAR_TOKEN` | SonarCloud analysis | Verify |
| `GEMINI_API_KEY` | AI features (runtime) | Verify |
| `MONGODB_URI` | Backend database | Verify |

Go to: `https://github.com/dvntone/wifisentry/settings/variables/actions`

| Variable | Value | Status |
|---|---|---|
| `SONAR_ORGANIZATION` | `dvntone` | Verify |
