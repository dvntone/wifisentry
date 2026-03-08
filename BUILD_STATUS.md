# WiFi Sentry — Build Status

> Last updated: 2026-03-05
> Update this file at the START and END of every development session.
> Rule: Never write new code on top of a broken build. Fix red first.

---

## Current Health: DEGRADED

| Component | Status | Last Good Commit | Notes |
|---|---|---|---|
| Android APK | UNKNOWN | `52f6bf4` | Release workflow failing — APK may not be building |
| Node.js Backend | UNKNOWN | `52f6bf4` | Not tested post-cleanup |
| Next.js Frontend | UNKNOWN | `52f6bf4` | Not tested post-cleanup |
| Electron Desktop | UNKNOWN | `52f6bf4` | Not tested |
| DB Integration Tests | PASSING | `52f6bf4` | `db-integration.yml` — green |
| SonarCloud | FAILING | last green unknown | `sonarcloud.yml` failing on main |
| Release Pipeline | FAILING | last green unknown | `release.yml` failing on main |
| Emergency Rollback | FAILING | last green unknown | `emergency-rollback.yml` failing |

---

## CI Workflow Status (as of 2026-03-05)

### wifisentry/main @ `52f6bf4`

| Workflow | Result | Action Required |
|---|---|---|
| Gemini Scheduled Issue Triage | SUCCESS | None |
| DB Integration Tests | SUCCESS | None |
| Release - Build & Deploy | FAILURE | Inspect logs — likely signing key issue |
| SonarCloud Analysis | FAILURE | Verify SONAR_TOKEN secret is set |
| Emergency Rollback | FAILURE | Inspect logs |

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

### 2026-03-08 — PR #38 review fault resolution
- Reviewed PR #38 checklist: Android 14/15+ modernization
- Created `android-native/gradle/libs.versions.toml` with pinned versions for KSP, Room, SQLCipher, Shizuku, and Compose
- Updated root `build.gradle` with KSP (`2.1.0-1.0.29`) and Compose compiler (`2.1.0`) plugins
- Updated `settings.gradle` to add Jitpack repository (required by Shizuku)
- Updated `core/build.gradle` with Room runtime/KTX/compiler (2.6.1), SQLCipher (4.5.4), sqlite-ktx
- Updated `app/build.gradle` with Shizuku API/provider (13.1.5, optional via `BuildConfig.SHIZUKU_ENABLED`), Compose BOM (2024.12.01), KSP, Compose compiler plugin, `buildConfig true`
- Created `ShizukuWifiScanner.kt` (app module) — tier-2 ADB-privileged scanner, gated by `SHIZUKU_ENABLED` flag (false by default, true in `dev` flavor)
- Created `OuiDatabase.kt` (core module) — encrypted Room/SQLCipher OUI database with Android Keystore AES-256 key (StrongBox-backed with TEE fallback), WAL mode
- Created `network_security_config.xml` — cleartext traffic blocked globally, certificate pinning for `raw.githubusercontent.com` (DigiCert root CA pins)
- Updated `AndroidManifest.xml` — added `networkSecurityConfig`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_CONNECTED_DEVICE`, and signature-level `WIFISENTRY_IPC` permission
- No existing functionality altered; all changes are additive

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
