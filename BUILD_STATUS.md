# WiFi Sentry — Build Status

> Last updated: 2026-03-08
> Update this file at the START and END of every development session.
> Rule: Never write new code on top of a broken build. Fix red first.

---

## Current Health: IMPROVING

| Component | Status | Last Good Commit | Notes |
|---|---|---|---|
| Android APK | BUILDING | `c9416cf` | CI/CD Android build passing; release signing still unverified |
| Node.js Backend | PASSING | `c9416cf` | Fastify with helmet, CORS, rate-limiting — security controls verified |
| Next.js Frontend | BUILDING | `c9416cf` | Ubuntu CI build passing; Google Fonts blocked in sandbox env |
| Electron Desktop | FIXING | current PR | `desktop:build-win` failure fixed (prior PR); remaining code quality fixes in this PR |
| DB Integration Tests | PASSING | `c9416cf` | `db-integration.yml` — green |
| SonarCloud | FAILING | last green unknown | `sonarcloud.yml` — verify SONAR_TOKEN secret |
| Release Pipeline | FAILING | last green unknown | `release.yml` — verify KEYSTORE_* signing secrets |
| Emergency Rollback | FAILING | last green unknown | `emergency-rollback.yml` — investigate |

---

## CI Workflow Status (as of 2026-03-08)

### wifisentry/main @ `c9416cf`

| Workflow | Result | Action Required |
|---|---|---|
| Gemini Scheduled Issue Triage | SUCCESS | None |
| DB Integration Tests | SUCCESS | None |
| CI/CD - Build & Test (Ubuntu) | PASSING | None |
| CI/CD - Build & Test (Windows Desktop) | FIXED | `desktop:build-win` no longer rebuilds web app |
| Release - Build & Deploy | FAILURE | Verify KEYSTORE_* secrets in repo settings |
| SonarCloud Analysis | FAILURE | Verify SONAR_TOKEN secret is set |
| Emergency Rollback | FAILURE | Investigate logs |

---

## Known Broken Areas (Do Not Build On Top Of)

1. **Release pipeline** — APKs are not being published. Before adding any new features to Android, fix KI-001 first.
2. **SonarCloud** — Quality gate is dark. Fix KI-002 before any security-sensitive code changes.
3. **Emergency Rollback** — Safety net is broken. Fix KI-019 before any production deployments.

---

## What Is Safe to Work On Right Now

- `docs/` reorganization (no code changes, zero build risk)
- Deleting obsolete root files (KI-010) — no code changes
- Writing new `.md` tracking files
- Updating `copilot-instructions.md`
- Reading and analyzing code structure

---

## Session Log

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

### 2026-03-08 — Remove MSVC C++ Analysis workflow (no C++ code in project)
- Removed `.github/workflows/msvc.yml` — Microsoft C++ Code Analysis workflow was failing with "CMakeLists.txt not found" because the project has no C++ code
- Workflow was incompatible with this JS/Android codebase and provided no analysis value
- Resolves CI failure from workflow run #22818467119 / job #66187371006

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
