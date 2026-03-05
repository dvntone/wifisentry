<div align="center">
  <img src="docs/logo.svg" alt="Wi-Fi Sentry logo" width="128" height="128"/>
  <h1>W I F I &nbsp; S E N T R Y</h1>
  <p><strong>Professional-Grade Wireless Threat Detection & Intelligence</strong></p>
  <p><i>Android 15+ Native • Windows Desktop • Next.js Cyber-Dashboard</i></p>
  <p>
    <a href="https://sonarcloud.io/summary/new_code?id=dvntone_wifisentry">
      <img src="https://sonarcloud.io/api/project_badges/measure?project=dvntone_wifisentry&metric=alert_status" alt="Quality Gate Status" />
    </a>
    <img src="https://img.shields.io/badge/version-1.2.8d-0e7490.svg" alt="Version 1.2.8d" />
    <img src="https://img.shields.io/badge/license-MIT-34d399.svg" alt="License MIT" />
  </p>
</div>

---

## 📡 System Overview
WiFi Sentry is a distributed security suite designed to detect and neutralize wireless threats like **Evil Twins, Karma Attacks, and Rogue HID Peripherals**. It combines native low-level hardware access with Google Gemini AI to provide actionable intelligence on your wireless environment.

### 🛠️ Consolidated Architecture
| Component | Technology | Purpose |
|---|---|---|
| **Android Native** | Kotlin / API 35 | Mobile field sensor & standalone detector. |
| **Desktop App** | Electron / Fastify | High-privilege monitor mode & packet capture. |
| **PWA Dashboard** | Next.js 16 / Tailwind | Unified "Cyber Terminal" control center. |
| **AI Engine** | Gemini 1.5 Flash | Behavioral analysis & remediation advice. |

---

## 🚀 Installation

### **Android (Mobile Sensor)**
1. Download the latest `app-dev-release.apk` from [Releases](https://github.com/dvntone/wifisentry/releases).
2. Sideload to your device.
3. **Note:** On Android 15, you may need to enable "Allow Restricted Settings" in App Info to grant fine location/bluetooth permissions.

### **Desktop (Windows/Linux)**
1. Download the `.exe` installer (Windows) or the `.tar.gz` (Web/Linux).
2. Install **Wireshark/Npcap** (required for 802.11 monitor mode).
3. Launch `WiFi Sentry.exe` to start the local sensor and dashboard.

---

## 🛡️ V2 Roadmap: The Pillars of Security

### **Pillar 1: Biometric Defense**
Full biometric locking (Fingerprint/PIN) on Android to protect local scan history and API keys from physical unauthorized access.

### **Pillar 2: AI-Native Intelligence**
Standardized Gemini prompts across all platforms to detect "low-and-slow" surveillance patterns that static heuristics miss.

### **Pillar 3: Companion Sync**
Real-time WebSocket streaming. Use your Android device as a remote sensor that feeds live data into your PC's cyber-terminal.

### **Pillar 4: Bluetooth Perimeter**
Expansion into BLE (Bluetooth Low Energy) tracking to detect stalker-tags (AirTags) and rogue HID peripherals.

### **Pillar 5: Cyber-Dashboard UX**
A unified "Terminal" aesthetic with Slate-950 backgrounds, monospace typography, and neon teal accents.

---

## 🧪 Security & Quality
WiFi Sentry is continuously audited via **SonarCloud** to meet OWASP security standards. No data leaves your device unless you explicitly opt-in to AI Threat Analysis.

---
<div align="center">
  <p>© 2026 WiFi Sentry Team • Secure the Airwaves</p>
</div>
