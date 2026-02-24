# Wi-Fi Sentry – Native Android App

A non-root, multi-module Android application (API 31 / Android 12+) that scans nearby Wi-Fi networks, applies lightweight threat heuristics, and maintains a local scan history.

> **No server required.** This app runs entirely on the Android device using the built-in Wi-Fi hardware. There is no Node.js server, no npm setup, no system tools (aircrack-ng, tcpdump, iw, etc.) and no internet connection needed. All scanning and threat analysis happens locally on-device.

## Module Structure

```
android-native/
├── app/        Android application module – UI (MainActivity, HistoryActivity)
└── core/       Android library module  – Wi-Fi scanning, threat analysis, storage
```

## Features

- **Wi-Fi scanning** – Uses Android's `WifiManager` API directly with the device's built-in Wi-Fi hardware. No root required. No external tools or drivers needed.
- **Threat detection** – 11 heuristic checks applied entirely on-device:
  - **Open network** – unencrypted access point
  - **Suspicious SSID** – name matches a configurable keyword list (free, pineapple, karma, kali, rogue, pentest, …)
  - **Multiple BSSIDs** – same SSID seen with more than one BSSID within a 10-minute window (evil-twin / rogue AP indicator)
  - **Security change** – encryption type for a known SSID has changed since the last scan
  - **Evil twin / Pineapple** – open AP whose SSID was previously seen as encrypted, appearing with a new BSSID (classic impersonation pattern)
  - **MAC spoofing suspected** – BSSID has the locally-administered bit set and is brand-new (not a real manufacturer OUI)
  - **Suspicious signal strength** – previously-unseen BSSID advertising at unusually close range (≥ −40 dBm) while history exists
  - **Beacon spam (multi-SSID same OUI)** – 5+ distinct SSIDs from a single hardware OUI (Wi-Fi Pineapple Karma mode / Marauder SSID-list signature)
  - **Beacon flood** – 4+ brand-new BSSIDs from the same OUI in one scan (Marauder "spam ap list" / mdk4 signature)
  - **Impossible protocol/band combo** – Wi-Fi 5 (802.11ac) on 2.4 GHz, or a pre–Wi-Fi 6 standard on the 6 GHz band (rogue AP fabricating capabilities)
  - **BSSID near-clone** – same SSID, same first 4 MAC octets, different last 2 octets on the same band, or a new near-clone appearing alongside an already-known AP
- **Scan history** – Up to 50 scans persisted as JSON in internal app storage (no database server needed).
- **Status dashboard** – Shows Wi-Fi on/off, location permission, and location services state with tap-to-fix shortcuts.

## Device requirements

- Android 12 (API 31) or newer
- Wi-Fi enabled
- Location permission and location services enabled (required by Android for Wi-Fi scanning)

**That's it.** No Node.js. No server. No extra apps. No root.

## Prerequisites for building from source

| Tool | Version |
|------|---------|
| Android SDK | API 35 (compile) / API 31 (min) |
| Java (JDK) | 17 |
| Gradle | via wrapper (`./gradlew`) |

## Build

```bash
# From the repo root:
cd android-native

# Debug APK
./gradlew assembleDebug

# The APK is output to:
# app/build/outputs/apk/dev/debug/app-dev-debug.apk
```

### Install on a connected device / emulator

```bash
./gradlew :app:installDevDebug
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

`versionCode = 4`, `versionName = "0.2.2"` (set in `app/build.gradle`).

## CI

GitHub Actions workflow: `.github/workflows/android-native.yml`

Runs unit tests (`./gradlew :core:test`) and builds both a debug and dev-release APK on every push/PR touching `android-native/**`.
