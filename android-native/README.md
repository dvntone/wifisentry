# Wi-Fi Sentry – Native Android App

A non-root, multi-module Android application (API 31 / Android 12+) that scans nearby Wi-Fi networks, applies lightweight threat heuristics, and maintains a local scan history.

## Module Structure

```
android-native/
├── app/        Android application module – UI (MainActivity, HistoryActivity)
└── core/       Android library module  – Wi-Fi scanning, threat analysis, storage
```

## Features

- **Wi-Fi scanning** – Uses `WifiManager` with runtime `ACCESS_FINE_LOCATION` permission (no root required).
- **Threat heuristics** – Flags:
  - Open (unencrypted) networks
  - SSIDs matching a configurable suspicious keyword list
  - SSIDs observed with multiple BSSIDs within a 10-minute window
  - SSIDs whose security capabilities have changed since the last scan
- **Scan history** – Up to 50 scans persisted as JSON in internal app storage.
- **Status dashboard** – Shows Wi-Fi on/off, location permission, and location services state with tap-to-fix shortcuts.

## Prerequisites

| Tool | Version |
|------|---------|
| Android SDK | API 34 (compile) / API 31 (min) |
| Java (JDK) | 17 |
| Gradle | 8.4 (via wrapper) |

## Build

```bash
# From the repo root:
cd android-native

# Debug APK
./gradlew assembleDebug

# The APK is output to:
# app/build/outputs/apk/debug/app-debug.apk
```

### Install on a connected device / emulator

```bash
./gradlew :app:installDebug
```

## Permissions

The app declares and requests at runtime:

| Permission | Purpose |
|-----------|---------|
| `ACCESS_FINE_LOCATION` | Required by Android for Wi-Fi scanning (API 23+) |
| `ACCESS_COARSE_LOCATION` | Fallback location permission |
| `ACCESS_WIFI_STATE` | Read Wi-Fi scan results |
| `CHANGE_WIFI_STATE` | Trigger a scan request |
| `ACCESS_NETWORK_STATE` | Network connectivity checks |

## Project versioning

`versionCode = 1`, `versionName = "0.1.0"` (set in `app/build.gradle`).

## CI

GitHub Actions workflow: `.github/workflows/android-native.yml`

Runs `./gradlew :app:assembleDebug` on every push/PR touching `android-native/**`.
