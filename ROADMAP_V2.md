# WiFi Sentry - Roadmap V2: Cross-Platform Consolidation & Security

With the structural migration to Fastify and Next.js complete, and the Android App stabilized for Android 15, the next phase of development focuses on bringing all platforms to full feature parity and enhancing the core security features.

## Pillar 1: Biometric Authentication (Defense in Depth)
**Goal:** Prevent unauthorized physical access to the app and its sensitive data across all platforms.
- **Android:** Implement `androidx.biometric` for Fingerprint/Face unlock upon app launch or resuming from the background.
- **Web / Desktop (Electron):** Integrate WebAuthn (Passkeys) using `@simplewebauthn/server` and `@simplewebauthn/browser` for passwordless, cryptographically secure authentication, replacing/augmenting the standard password login.

## Pillar 2: AI-Native Threat Intelligence
**Goal:** Move beyond static heuristics (e.g., "Is this an Evil Twin?") to behavioral analysis ("What is the intent of this network?").
- **Implementation:** Utilize the Google Gemini API to analyze historical scan patterns and detect low-and-slow surveillance attacks or sophisticated spoofing that simple threshold-based heuristics miss. 
- **Standardization:** Ensure the Android `GeminiAnalyzer` and the Node.js `aiService` use the exact same prompts and return the same structured JSON formats for consistent threat advice.

## Pillar 3: Real-Time Multi-Device Sync
**Goal:** Allow devices to act as distributed sensors.
- **Implementation:** Leverage Fastify's WebSocket capabilities to stream live scan results from a mobile device (Android) running the native app directly to a Desktop/Web dashboard. This enables scenarios like leaving an old Android phone in a hotel room as a dedicated "sensor" while monitoring it remotely from a laptop.

## Pillar 4: Unified Testing & Core Logic Parity
**Goal:** Guarantee identical threat detection behavior whether the user is running the Node.js backend or the standalone Android APK.
- **Implementation:** 
  - Standardize the algorithms in `ThreatAnalyzer.kt` (Android) and `evil-twin-detector.js` (Node.js).
  - Create a unified integration test suite (e.g., using Postman/Newman or Jest) that asserts the same raw input data produces the exact same threat severity and categorization across both codebases.

## Pillar 5: Unified High-Tech UX/UI
**Goal:** Transform the UI across all platforms into a sleek, modern, professional "cybersecurity dashboard".
- **Design Language:** Dark mode by default, monospace typography for data grids, neon accents (cyan/purple/green) for threat indicators, and rich statistical visualizations.
- **Web / Desktop (Next.js):** 
  - Implement a persistent sidebar navigation menu.
  - Create dedicated pages for **About**, **FAQ/Help**, **Settings**, and **Version Info**.
  - Add real-time telemetry charts (signal strength over time, threat distribution).
- **Android (Native):** 
  - Align `colors.xml` and Material 3 themes with the Web/Desktop dark-tech aesthetic.
  - Introduce a bottom navigation bar or a side drawer to access History, Settings, and Help.
  - Enhance the stats card with custom charting (e.g., MPAndroidChart) for a true "dashboard" feel.
