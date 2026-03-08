# WiFi Sentry — Engineering Roadmap

> This document tracks prioritized engineering improvements across CI/CD, Android code quality,
> and repository hygiene. It complements the feature-level [`ROADMAP_V2.md`](ROADMAP_V2.md).
>
> **Format:** Now (in progress / imminent) → Next (next 1–2 sprints) → Later (backlog)
>
> Related: fixes for CI run `22810673223` / job `66167117143` were landed as part of this document's
> creation — `import android.content.Context` added to `MainActivity.kt` and exhaustive `when`
> branches for `PMKID_SNIFFING` / `KRACK` added to `ScanResultAdapter.kt`.

---

## Now — Active / Imminent

### CI/CD
- **[KI-001]** Fix `release.yml` APK signing failure — verify `KEYSTORE_*` secrets are set and upload the signed APK artifact on success.
- **[KI-002]** Restore SonarCloud quality gate — confirm `SONAR_TOKEN` / `SONAR_ORGANIZATION` secrets are configured.
- **[KI-019]** Restore `emergency-rollback.yml` — the safety-net rollback workflow is currently broken and must be functional before any production deployment.
- Split the monolithic `ci-cd.yml` job into parallel lanes: `lint`, `unit-test`, `instrumented-test`, `build-apk` — reduces wall-clock time and makes failures easier to isolate.

### Android Code Quality
- **Exhaustive `when` strategy** — all extension functions that `when` on `ThreatType` must cover every enum value explicitly (no `else`). Compiler errors on new enum values are preferred over silent fallbacks. Policy: when a new `ThreatType` value is added, a build failure must occur until every `when` site is updated.
- Add Detekt static analysis to `ci-cd.yml` with the default rule set; fail the build on new findings above `WARNING` severity.

---

## Next — 1–2 Sprints

### CI/CD
- Add **ktlint** formatting check as a pre-merge gate (non-auto-correcting; developers run `./gradlew ktlintFormat` locally).
- Upload Detekt HTML report as a GitHub Actions artifact on every PR so reviewers can inspect findings without re-running the build.
- Add **artifact upload** of the debug APK from `ci-cd.yml` so QA can sideload builds without triggering the full release pipeline.
- Cache the Gradle wrapper and the Android SDK in CI to cut cold-build time by ~40%.

### Android Code Quality
- Add **unit tests for `ThreatType` mapping** in the `core` module:
  - Assert that every `ThreatType` value has a non-null, non-blank `displayName`.
  - Assert that every `ThreatType` value has a non-null, non-blank `detailDescription`.
  - Assert that the `severity` extension property returns the correct `ThreatSeverity` for each value.
  - These tests act as a compile-time + runtime contract so new enum values can never be silently unhandled.
- Migrate remaining `RootChecker` and scanner calls that still touch the main thread to `Dispatchers.IO` coroutines (see KI-014 threading rule).

### Repo Hygiene / Maintainability
- Add GitHub issue labels for roadmap buckets: `roadmap:now`, `roadmap:next`, `roadmap:later`, `ci-cd`, `android`, `security`, `docs`.
- Move any remaining `.md` files in the repo root (other than `README.md`, `KNOWN_ISSUES.md`, `BUILD_STATUS.md`, `LICENSE`) into `docs/`.
- Add a `CONTRIBUTING.md` that documents:
  - The scanner-chain priority order.
  - The exhaustive-`when` policy for `ThreatType`.
  - The threading rules (no scanner/IO work on main thread).
  - How to update `KNOWN_ISSUES.md` and `BUILD_STATUS.md`.

---

## Later — Backlog

### CI/CD
- Add **instrumented UI tests** (Espresso) gated behind a `[run-ui-tests]` commit-message flag so they only run on demand.
- Introduce a **matrix build** in CI covering `minSdk=31`, `minSdk=33`, and `minSdk=35` API levels to catch API-level regressions early.
- Publish Detekt and ktlint results as PR review comments via the `reviewdog` GitHub Action.
- Explore **incremental Kotlin compilation** (`incremental=true` in `gradle.properties`) to speed up iterative CI builds.

### Android Code Quality
- Add **lint baseline** (`lint-baseline.xml`) so new lint warnings fail the build while existing ones are tracked without blocking work.
- Introduce `@VisibleForTesting` annotations on internal functions that are tested directly, to signal intent and guard against accidental public-API drift.
- Consider a `ThreatTypeRegistry` companion object or `EnumSet` helper that enumerates all `ThreatType` values at runtime, making it impossible for a new value to be unhandled without an explicit code change in one central location.

### Repo Hygiene / Maintainability
- Evaluate whether `docs/ROADMAP.md` (engineering) and `docs/ROADMAP_V2.md` (product features) should remain separate or be merged. Merge only if both audiences are the same and a unified view adds clarity; otherwise keep them separate and link from `docs/INDEX.md`.
- Add a **documentation index** (`docs/INDEX.md`) — the file already exists but should be kept up to date as docs grow.
- Establish a **release checklist** that requires: green CI, updated `BUILD_STATUS.md`, updated `KNOWN_ISSUES.md`, and a passing Detekt/ktlint run before any release tag is pushed.
