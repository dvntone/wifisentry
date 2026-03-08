# Agent Handoff Context

> **Handoff created:** 2026-03-08
> For ongoing coordination history see: `docs/agent_coordination_log.md`

---

## 1. User Preferences (Current Focus)

- **Primary focus: Android build stability.** Keep the Android APK building cleanly before touching anything else.
- Version unification across `package.json` and `android-native/app/build.gradle` is a deferred task — do it later as a dedicated step, not as a side-effect of other work.
- When in doubt, fix red CI before adding features (see `BUILD_STATUS.md` rule at the top of that file).

---

## 2. Recent Work (as of 2026-03-08)

### PR #45 — merged 2026-03-08
Fix: Windows desktop CI dependency failure (`@tailwindcss/postcss` module not found)

Changes in that PR:
- `desktop:build-win` script changed from `npm run web:build && npm run desktop:build` to `npm run desktop:build` only (CI downloads pre-built web artefacts; re-running the Next.js build on Windows without web-app `node_modules` was the root cause of the failure).
- `build:all` script corrected to call `desktop:build` (was calling `desktop:build-web` which never built the Electron app).
- `web-app/package.json`: pinned all dependency versions exactly (removed `^`/`~`).
- `web-app/package.json`: removed unused `@dataconnect/generated` dead dependency.
- `BUILD_STATUS.md` updated with session log entry.

---

## 3. Current Versioning

| Location | Current value (main before bump) | Intended next value |
|---|---|---|
| `android-native/app/build.gradle` — `versionName` | `1.2.8` | `1.2.9` |
| `android-native/app/build.gradle` — `versionCode` | `25` | `26` |
| `package.json` — `version` | `1.2.8` (cleaned from `1.2.8m`) | unchanged for now |

**Android-only bump plan:**
- Manually edit `android-native/app/build.gradle` lines `versionCode` and `versionName`.
- Update `BUILD_STATUS.md` session log.
- Do NOT touch `package.json` version during this bump.

**Note on `version-bump.yml`:**
The `.github/workflows/version-bump.yml` workflow (manual `workflow_dispatch`) bumps both `package.json` AND `android-native/app/build.gradle` in lockstep. Current plan is to skip this workflow and bump Android only by direct file edit to avoid unintended package.json churn.

---

## 4. CI / Build Status (as of 2026-03-08)

- No open PRs; nothing known to be failing.
- For detailed per-workflow status, see `BUILD_STATUS.md` (updated same date).

Quick summary from `BUILD_STATUS.md`:

| Component | Status |
|---|---|
| Android APK (CI) | BUILDING (passing) |
| Node.js Backend | PASSING |
| Next.js Frontend | BUILDING (passing) |
| Electron Desktop | FIXED (PR #45) |
| DB Integration Tests | PASSING |
| SonarCloud | FAILING — needs `SONAR_TOKEN` secret |
| Release Pipeline | FAILING — needs `KEYSTORE_*` secrets |
| Emergency Rollback | FAILING — needs investigation (KI-019) |

---

## 5. Known Tool / API Limitations

- The chat assistant had intermittent failures listing open PRs via the GitHub API (`list_pull_requests`); direct PR URLs (e.g. `https://github.com/dvntone/wifisentry/pull/45`) worked reliably as a workaround.

---

## 6. Next Steps / Roadmap

1. **Bump Android version** to `versionName "1.2.9"` / `versionCode 26` in `android-native/app/build.gradle` and update `BUILD_STATUS.md`.
2. **Fix emergency rollback** (KI-019) — safety net must be restored before any production deployment.
3. **Fix release pipeline** (KI-001) — verify `KEYSTORE_*` secrets in repo settings so APKs are published.
4. **Fix SonarCloud** (KI-002) — verify `SONAR_TOKEN` secret; disable Automatic Analysis in SonarCloud dashboard so the GitHub Action controls it.
5. **Version unification** (deferred) — once Android is stable, align `package.json` version with the Android `versionName` using `version-bump.yml`.
6. **Prepare release** — after all CI is green and secrets are confirmed, trigger `release.yml` for a tagged release.

---

## 7. Key File Locations

| What | Path |
|---|---|
| Android version | `android-native/app/build.gradle` (lines ~14-15) |
| Version bump workflow | `.github/workflows/version-bump.yml` |
| CI/CD pipeline | `.github/workflows/ci-cd.yml` |
| Release pipeline | `.github/workflows/release.yml` |
| Build status tracker | `BUILD_STATUS.md` |
| Known issues tracker | `KNOWN_ISSUES.md` |
| Agent coordination log | `docs/agent_coordination_log.md` |
| Copilot instructions | `.github/copilot-instructions.md` |
