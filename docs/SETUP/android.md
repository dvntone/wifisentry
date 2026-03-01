# Android Setup Guide

This guide explains how to build and run the WiFi Sentry native Android application.

## 📱 Overview

The WiFi Sentry Android app is a **standalone, non-root** application designed for Android 12+ (API 31+). It performs WiFi scanning and threat detection directly on the device using the built-in WiFi hardware.

**Key Features:**
- No server or internet connection required.
- 11 on-device heuristic threat checks.
- Persisted scan history.
- Real-time status dashboard.

## 📋 Prerequisites

To build the app from source, you will need:
- **Java Development Kit (JDK)**: Version 17.
- **Android SDK**: API 35 (Compile SDK), API 31 (Minimum SDK).
- **Gradle**: Handled via the included wrapper (`./gradlew`).

## 🚀 Building the App

1.  **Navigate to the Android directory**:
    ```bash
    cd android-native
    ```

2.  **Build the Debug APK**:
    ```bash
    ./gradlew assembleDebug
    ```
    The resulting APK will be located at:
    `app/build/outputs/apk/dev/debug/app-dev-debug.apk`

3.  **Install on a connected device**:
    Make sure your Android device has **USB Debugging** enabled and is connected to your computer.
    ```bash
    ./gradlew :app:installDevDebug
    ```

## 🛠️ Permissions

The application requires the following permissions to function correctly:
- `ACCESS_FINE_LOCATION`: Required by Android for WiFi scanning.
- `ACCESS_WIFI_STATE`: To read WiFi scan results.
- `CHANGE_WIFI_STATE`: To trigger new scans.

The app will prompt you to grant these permissions upon first launch.

## 🔍 Threat Detection Heuristics

The Android app performs the following checks locally:
- **Open Network**: Unencrypted access points.
- **Suspicious SSID**: Matches known rogue AP names (e.g., "WiFi Pineapple").
- **Evil Twin Detection**: Identifies multiple BSSIDs for the same SSID.
- **Security Changes**: Detects if a known network's encryption has changed.
- **MAC Spoofing**: Identifies suspicious or non-standard MAC addresses.
- **Beacon Spam/Flood**: Detects patterns typical of WiFi attack tools like Marauder.

## ❓ Troubleshooting

### Scanning Not Working
- Ensure **WiFi** is turned on.
- Ensure **Location Services** are enabled (required by Android for WiFi scanning).
- Grant the requested **Location Permission**.

### Build Failures
- Verify you have **JDK 17** installed and `JAVA_HOME` is set correctly.
- Ensure you have the necessary **Android SDK** components installed via Android Studio or the command-line tools.
