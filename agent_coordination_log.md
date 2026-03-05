# agent_coordination_log

**CRITICAL: READ THIS BEFORE STARTING ANY TASK**

This file ensures that Gemini CLI and GitHub Copilot (or any other AI agents) do not "step on each other's toes."

## Current Session Status
- **Agent:** Gemini CLI
- **Current Project Version:** 1.2.8b
- **Last Updated:** 2026-03-05

## Recent Major Architectural Changes
1.  **Backend:** Migrated from `speakeasy` to `otplib` for 2FA.
2.  **Frontend:** Switched to Next.js 16 with a Sidebar-based "Cyber Terminal" UI.
3.  **Android:** Stabilized for Android 15, added Biometric Authentication, and integrated Bluetooth BLE scanning.
4.  **Workflows:** Consolidated all releases into a single `release.yml` and all Gemini AI logic into `gemini-actions.yml`. Deleted redundant files like `auto-release.yml` and `android-native.yml`.

## Active "Safety Rules" for Agents
- **Version Bumping:** ALWAYS bump the version in `package.json` AND `android-native/app/build.gradle` (versionCode + versionName) before pushing any fix. If you don't, the automated `release.yml` won't trigger or will overwrite artifacts.
- **Workflow Integrity:** Do not recreate `auto-release.yml` or `android-native.yml`. Everything is now unified in `release.yml` and `ci-cd.yml`.
- **UI Aesthetic:** Maintain the "Cyber Dashboard" theme (Slate 950 bg, Cyan 400 accents).

## Ongoing Tasks (Roadmap V2)
- [ ] Pillar 3: WebSocket data streaming between Android and Desktop.
- [ ] Pillar 6: Advanced Bluetooth threat heuristics (detecting rogue HID).
- [ ] Security: Resolve any SonarCloud high-severity flags (Note: Disable SonarCloud "Automatic Analysis" in dashboard to use our GitHub Action).

## Log Entry (Append here)
- **2026-03-05 (Gemini CLI):** Fixed Windows build by adding missing Electron dependencies. Consolidated 12+ workflows into 5 efficient files. Added PWA build artifacts back to the release engine.
