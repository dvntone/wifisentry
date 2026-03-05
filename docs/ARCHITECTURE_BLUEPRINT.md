# WiFi Sentry - Architecture & Design Blueprint

**Version:** 1.2.8a
**Purpose:** This document serves as the master blueprint for the WiFi Sentry project. In the event of major refactoring, code loss, or platform migration, this file contains the core logic, structural patterns, and UI/UX design language required to rebuild the system to exact specifications.

---

## 1. System Architecture

WiFi Sentry operates on a "Hybrid Local-First" architecture. 

*   **Node.js Backend (Fastify):** The central brain (`server.js`). It handles heavy computations, database interactions (SQLite/Mongoose), hardware interfacing via `node-wifi`, and AI processing via the Gemini SDK. It exposes REST and WebSocket APIs.
*   **Web App (Next.js):** A static React frontend (`web-app/out`). It acts as a "dumb terminal" that connects to the Fastify backend. It can be served locally or as a PWA.
*   **Desktop App (Electron):** A native wrapper that *spawns* the Fastify backend as a child process and loads the Next.js static files. It adds OS-level privileges (System Tray, Npcap, Windows Firewall management).
*   **Android App (Kotlin Native):** A standalone mobile client. It does *not* require the Node.js backend. It implements parallel logic in Kotlin (`WifiManager`, `BluetoothLeScanner`, `GeminiAnalyzer.kt`) to ensure zero-dependency field operation.

---

## 2. Feature Toggles & Modularity (Graceful Degradation)

The system is designed so that *any* failing or disabled module does not crash the entire app.

*   **Configuration State:** `desktop/config/desktop.config.js` acts as the single source of truth for the Desktop environment.
*   **Toggleable Systems:**
    *   `adapterManagement`: Can be disabled if the OS restricts hardware polling.
    *   `monitorMode`: Toggles raw packet capture.
    *   `mapApi`: Falls back to basic lists if offline.
    *   `aiAnalysis`: If disabled (or no API key), the system falls back to static JSON heuristics (Evil Twin, Karma signatures).
*   **Backend Modularity:** In Fastify, routes are loaded via `fastify.register()`. If `api/adapters.js` fails due to missing OS tools, it is caught in a `try/catch` and simply logs a warning, allowing the rest of the dashboard to load.

---

## 3. Wireshark & TShark Integration (Red/Blue Team Ops)

WiFi Sentry is a professional-grade tool capable of both passive scanning and raw packet capture.

*   **Desktop (Windows/Linux):** 
    *   The `capture` feature supports multiple backends: `auto`, `npcap`, `wsl2`, `airpcap`, or `vendor`.
    *   It actively searches for `tshark` and `dumpcap` executables.
    *   If found, it can capture raw 802.11 frames (PCAP) to analyze Deauth Floods and Probe-Response anomalies that are invisible to standard OS APIs.
*   **Android (Root):**
    *   `RootShellScanner.kt` detects if the device is rooted (via Shizuku or su).
    *   If rooted and `tshark` is installed (e.g., via Termux), it spawns a privileged shell to put `wlan0` into monitor mode, executing the same deep packet inspection as the desktop app.

---

## 4. UI/UX Design Language (Pillar 5)

The interface is styled as a "High-Tech Cyber Dashboard". This aesthetic must be maintained across Web, Desktop, and Android.

### Color Palette
*   **Base Background:** Slate 950 (`#0f172a`) / Slate 800 (`#1e293b`)
*   **Primary Accent (Tech/Neon):** Cyan 400 (`#22d3ee`) & Cyan 700 (`#0e7490`)
*   **Success/Safe:** Emerald 400 (`#34d399`) & Emerald 600 (`#059669`)
*   **Warnings/Threats:** Amber 500 (`#f59e0b`) & Red 500 (`#ef4444`)

### Typography & Layout
*   **Fonts:** `Geist` (Sans-serif for readability) and `Geist_Mono` (for data grids, MAC addresses, and statistics).
*   **Navigation:** Persistent left-hand Sidebar (Desktop/Web) or Bottom Navigation / Drawer (Android). 
*   **Data Presentation:** Top-row statistical cards (Threats, Status, Sensors). Dense, sortable data tables for network listings. 

---

## 5. Security Posture

*   **Authentication:** 
    *   Backend: Protected by `otplib` (TOTP 2FA) and `@fastify/helmet` CSP headers.
    *   Android: Protected by `androidx.biometric` (Fingerprint/Face unlock on app resume).
*   **Code Quality:** Enforced via `eslint@9` (Flat Config) and automated SonarCloud workflows checking for OWASP vulnerabilities.
*   **Zero-Telemetry:** By default, no data leaves the local machine. AI analysis requires explicit user opt-in and an API key.