<!-- markdownlint-disable MD022 MD032 MD060 -->

# Wi-Fi Sentry — Build Status

> Last updated: 2026-03-09 (Afternoon Session)
> Update this file at the START and END of every development session.
> Rule: Never write new code on top of a broken build. Fix red first.

---

## Current Health: IMPROVING

| Component | Status | Last Good Commit | Notes |
|---|---|---|---|
| Android APK | BUILDING | `c9416cf` | CI/CD Android build passing; release signing still unverified |
| Node.js Backend | PASSING | Latest | Fastify with helmet, CORS, rate-limiting — security controls verified; API URLs environment-aware |
| Next.js Frontend | PASSING | Latest | Build optimization enabled (image optimization, proper TypeScript); environment-based API URLs |
| Electron Desktop | PASSING | Latest | Electron 40.8.0, electron-builder 26.8.1; desktop:build-win working |
| DB Integration Tests | PASSING | `c9416cf` | `db-integration.yml` — green |
| SonarCloud | READY | Latest | `sonarcloud.yml` — SONAR_TOKEN secret added; next run will analyze |
| Release Pipeline | FAILING | last green unknown | `release.yml` — verify KEYSTORE_* signing secrets |
| Emergency Rollback | PASSING | Latest | Fixed: commit hash capture, jq validation, commit message handling |

---

## CI Workflow Status (as of 2026-03-08)

### wifisentry/main @ `c9416cf`

| Workflow | Result | Action Required |
|---|---|---|
| Gemini Scheduled Issue Triage | SUCCESS | None |
| DB Integration Tests | SUCCESS | None |
| CI/CD - Build & Test (Ubuntu) | PASSING | None |
| CI/CD - Build & Test (Windows Desktop) | FIXED | `desktop:build-win` no longer rebuilds web app |
| Release - Build & Deploy | FAILURE | Verify KEYSTORE_* secrets in repository settings |
| SonarCloud Analysis | READY | SONAR_TOKEN secret now configured; will run on next push/PR |
| Emergency Rollback | FAILURE | Investigate logs |
| Semgrep | NEW | No secret required; workflow now runs Semgrep CLI and uploads SARIF |

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

### 2026-03-09 (Afternoon) — API URL environment variables and build optimizations (KI-009 fix)
- **Frontend Environment Variables (KI-009)**: Fixed hardcoded localhost:3000 URLs - updated `frontend-shared/api-client.ts`, `SetupWizard.tsx`, `DependencyChecker.tsx` to use `NEXT_PUBLIC_API_URL` environment variable with fallback
- **Configuration**: Added `NEXT_PUBLIC_API_URL` documentation to `.env.example` with examples for dev/production
- **Build Optimizations**: Enabled Next.js image optimization (AVIF/WebP formats), SWC minification, response compression  
- **TypeScript Enforcement**: Removed `ignoreBuildErrors: true` from `next.config.ts` to enforce type safety at build time
- **Security Headers**: Disabled powered-by header in Next.js config
- **Version Sync**: Updated `package.json` version from 1.2.8 to 1.2.9 for consistency with releases
- These changes enable the app to work in any environment (dev/staging/production) via environment configuration

### 2026-03-09 — Repository cleanup and dev experience improvements
- **Cleanup (KI-010)**: Removed 10 obsolete prototype .js files from root (aiService, config, database, dependency-checker, evil-twin-detector, karma-attack, location-tracker, platform-installer, verify-services, wifi-scanner)
- **Infrastructure (KI-012)**: Removed `dataconnect/` directory and `web-app/src/dataconnect-generated/` (Firebase Data Connect replaced by MongoDB)
- **Dev Experience (KI-013)**: Made `npm run dev` start full backend+frontend stack concurrently instead of backend-only
- **Workflow Fixes**: Fixed `emergency-rollback.yml` to capture commit before reset and add jq validation

### 2026-03-08 — Workflow reliability fixes (rollback, semgrep, sonar, detekt, linter, android CI)
- Fixed YAML parsing failure in `.github/workflows/emergency-rollback.yml` by replacing multiline `git commit -m` string with safe multi-flag commit message format
- Fixed `.github/workflows/semgrep.yml` invalid action inputs by switching to pinned Semgrep CLI execution and SARIF upload
- Standardized `.github/workflows/android.yml` JDK from 11 to 21
- Updated `.github/workflows/detekt.yml` to Detekt `v1.23.8` and removed `continue-on-error` from scan step so findings fail CI
- Updated `.github/workflows/sonarcloud.yml` to trigger on push/PR and skip analysis step when `SONAR_TOKEN` is missing
- Updated `.github/workflows/super-linter.yml` from `github/super-linter@v4` to `@v7`

### 2026-03-08 — Security hardening: API auth, WSL2 consolidation, Semgrep workflow
- Consolidated WSL2 command injection fixes from PRs #51, #58, #62 into single hardened implementation
- Added 5 input sanitizers to `desktop/windows-wsl2-adapter-manager.js` (interface, filepath, distro, user, BPF filter)
- Fixed BPF regex to allow valid operators; replaced all exec/string concat with spawn() array args; 30s timeout + 10MB cap
- Added `requireAuth` preHandler to 6 unauthenticated endpoints: `/api/location-consent`, `/api/log-location`, `/api/submit-technique`, `/api/start-monitoring`, `/api/stop-monitoring`, `/api/export-wigle`
- Added prompt injection sanitization to `/api/submit-technique` (strip control chars, max 2000 chars)
- Consolidated duplicate Semgrep workflow PRs #68 and #71 into single `.github/workflows/semgrep.yml`
- Fixed fork PR secret failure (skip job on fork PRs), SARIF upload guard (`hashFiles` check), documented new secrets in Secrets Checklist

### 2026-03-08 — Code audit: fix version strings, template literals, XSS, Next.js config
- Fixed invalid SemVer version `"1.2.8m"` → `"1.2.8"` in `package.json` and `android-native/app/build.gradle`
- Fixed escaped template literals in `web-app/src/app/playground/page.tsx` (lines 55, 61): `\${...}` → `${...}`; tab buttons were rendering literal `${...}` text instead of active class
- Fixed XSS vulnerability in `playground/page.tsx`: replaced `dangerouslySetInnerHTML={{ __html: renderedContent }}` with sandboxed `<iframe sandbox="" srcDoc={...}>` to isolate user-controlled HTML
- Removed invalid Next.js 16 config option `eslint.ignoreDuringBuilds` from `web-app/next.config.ts` (not in `NextConfig` type — was causing `tsc --noEmit` errors)

### 2026-03-08 — Fix desktop:build-win CI failure (Cannot find module '@tailwindcss/PostCSS')
- Root cause: `desktop:build-win` script was `npm run web:build && npm run desktop:build`, causing the Windows CI step to re-run the Next.js build without web-app node_modules installed
- Fixed `desktop:build-win` to `npm run desktop:build` (CI downloads pre-built web artifacts; no rebuild needed)
- Fixed `build:all` script: was calling `desktop:build-web` which just re-ran `web:build` and never built the Electron app; now correctly calls `desktop:build`
- Fixed `web-app/package.json`: pinned all dependency versions exactly (removed `^`/`~`), removed unused `@dataconnect/generated` dead dependency
- Created `docs/ROADMAP.md` with Now/Next/Later buckets covering CI/CD improvements, Android code quality, and repository hygiene
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
| `SONAR_TOKEN` | SonarCloud analysis | ✅ ADDED |
| `GEMINI_API_KEY` | AI features (runtime) | Verify |
| `MONGODB_URI` | Backend database | Verify |

Go to: `https://github.com/dvntone/wifisentry/settings/variables/actions`

| Variable | Value | Status |
|---|---|---|
| `SONAR_ORGANIZATION` | `dvntone` | Verify |
