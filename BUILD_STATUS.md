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

## Open PRs — Recommended Merge Order (as of 2026-03-08)

9 open PRs. Dependency chains, file overlaps, and conflicts analyzed below.

### Dependency Graph

```
main
├── PR #48 (fix-sonarcloud-vulnerabilities)
│   ├── PR #51 (update-wifi-sentry-actions)
│   │   └── PR #58 (fix-sanitize-bpf-filter)
│   └── PR #59 (fix-unused-exec-import-csp-issue)
├── PR #60 (remediation-required) ← base is copilot/fix-release-tag-comparison (MERGED as PR #49) — retarget to main
├── PR #62 (fix-quality-gate-failure)
├── PR #64 (fix-not-found-issue)
├── PR #66 (update-build-gradle-sonarqube-plugin)
└── PR #67 (update-status-pr) [DRAFT]
```

### Conflicts Identified

| Conflict | PRs | Issue | Resolution |
|---|---|---|---|
| `windows-wsl2-adapter-manager.js` | #48 vs #62 | Both rewrite WSL2 security (sanitizers, spawn, exec removal) | **Choose one.** PR #48 also fixes XSS, CSP, scanner, hardcoded secret. PR #62 is WSL2-only but standalone. |
| MSVC workflow approach | #51 vs #64 | #51 removes `msvc.yml` (no C++ code); #64 adds `CMakeLists.txt` to make it work | **Choose one.** #51 (remove) is correct — project has no C++ code. Close #64. |
| `wifi-scanner.js` | #48 vs #51 vs #60 | All modify `exec` → `execFile` import; #60 adds HOME check | Stacked — merge in order #48 → #51. #60 needs rebase. |

### Recommended Merge Order

**Step 1 — Security chain (merge in strict order):**

| Order | PR | Title | Base | Files Changed | Action |
|---|---|---|---|---|---|
| 1 | #48 | Fix security vulnerabilities: XSS, cmd injection, CSP, hardcoded secret | `main` | 7 files | **Merge** |
| 2 | #59 | Scope strict CSP to API routes; remove unused exec import | `#48` branch | 1 file (server.js) | **Merge** (auto-retargets after #48) |
| 3 | #51 | Remove MSVC workflow; fix WSL2 cmd injection | `#48` branch | 4 files | **Merge** (auto-retargets after #48) |
| 4 | #58 | Fix BPF filter regex, spawn guardrails, tcpdump injection | `#51` branch | 1 file | **Merge** (auto-retargets after #51) |

**Step 2 — Close superseded/conflicting:**

| PR | Title | Action | Reason |
|---|---|---|---|
| #62 | Fix SonarCloud quality gate: WSL2 cmd injection | **Close** | Superseded by #48 + #51 + #58 (same `windows-wsl2-adapter-manager.js` fixes, done more incrementally) |
| #64 | Add CMakeLists.txt for MSVC CI | **Close** | Conflicts with #51 which removes `msvc.yml` entirely (correct approach — no C++ code) |

**Step 3 — Independent PRs (merge in any order):**

| Order | PR | Title | Base | Action |
|---|---|---|---|---|
| 5 | #60 | Security remediation: Joi validation, cmd injection, bounds checking | ⚠️ **Retarget to `main`** (base `copilot/fix-release-tag-comparison` was merged as PR #49) | **Retarget base → main**, then merge |
| 6 | #66 | Add org.sonarqube plugin to Android build.gradle | `main` | **Merge** |
| 7 | #67 | Update BUILD_STATUS.md and KNOWN_ISSUES.md | `main` | **Merge** (this PR) |

### File Touch Map (overlap analysis)

```
windows-wsl2-adapter-manager.js  → PR #48, #51, #58, #62 (CONFLICT: #62 vs chain)
wifi-scanner.js                  → PR #48, #51, #60
server.js                        → PR #48, #59
BUILD_STATUS.md                  → PR #48, #51, #64, #67
dependency-checker.js            → PR #48
NetworkMap.tsx                   → PR #48
routes/*.js, api/adapters.js     → PR #60
platform-installer.js            → PR #60
android-native/build.gradle      → PR #66
.github/workflows/msvc.yml       → PR #51 (remove), #64 (add CMakeLists.txt)
KNOWN_ISSUES.md                  → PR #64, #67
```

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
- Added "Open PRs — Recommended Merge Order" section: dependency graph, conflict analysis, 7-step merge plan
- Identified PRs #62 and #64 as superseded/conflicting (should be closed)
- Identified PR #60 needs base retargeted to `main` (its base `copilot/fix-release-tag-comparison` was merged as PR #49)

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
