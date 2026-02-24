# Reference Repositories

Curated list of open-source projects used as design, protocol, and threat-model
references for **Wi-Fi Sentry** (Android + desktop) and the **flipp3d** project.

Each entry notes: what the repo does, which project it applies to, and the
specific features / patterns worth adopting.

---

## Table of Contents

1. [WiGLE WiFi Wardriving](#1-wigle-wifi-wardriving)  ★ Primary UI & protocol reference
2. [m8b — Magic 8-Ball geolocation](#2-m8b--magic-8-ball-geolocation)
3. [Ghost\_ESP](#3-ghost_esp)  ★ Threat-model reference
4. [GhostESP-Companion (Android)](#4-ghostesp-companion-android)
5. [rpi-hunter](#5-rpi-hunter)
6. [Sniffnet](#6-sniffnet)  ★ Desktop UI reference
7. [Evilginx 2/3](#7-evilginx-23)
8. [Wi-Fi Pineapple Cloner](#8-wi-fi-pineapple-cloner)

---

## 1. WiGLE WiFi Wardriving

| | |
|---|---|
| **Repo** | <https://github.com/wiglenet/wigle-wifi-wardriving> |
| **Language** | Java (Android) |
| **Applies to** | Wi-Fi Sentry Android · Wi-Fi Sentry Desktop |
| **Priority** | ★★★ Primary reference |

### What it is
The canonical Android wardriving app, backing the WiGLE.net global WiFi database
(750 M+ networks).  Collects SSIDs, BSSIDs, GPS coordinates, and signal levels;
uploads results to WiGLE.net for crowd-sourced mapping.

### Key patterns already adopted
- `WifiReceiver` timer loop — `startScan()` after each `SCAN_RESULTS_AVAILABLE_ACTION`
  → **live streaming** one network at a time into the list (our `streamOneShotResults`)
- `ConcurrentLinkedHashMap` keyed by BSSID → our `sessionNetworks LinkedHashMap`
- Signal strength colored text (green / yellow / red) → our `signal_good/fair/weak`
- WiGLE CSV v1.4 export format → our `buildWigle()` in `HistoryActivity`
- Deduped unique-AP counting across scans → `seen` set in `buildWigle()`

### Features still to adopt

#### Android
| Feature | WiGLE class | Notes |
|---------|-------------|-------|
| GPS-tagged scan records | `GNSSListener.java` | Store `lat/lon` in `ScannedNetwork`; needed for map view and accurate WiGLE/m8b exports |
| OUI vendor lookup | `OUI.java` + assets | Show manufacturer name (e.g. "Apple Inc.") next to BSSID in network list |
| Wardrive session stats | `ListFragment` | Running counters: total unique APs, new this run, open networks |
| Network type icons | `NetworkListUtil.getImage()` | Icon per security class (lock, open, WEP warning) |
| "Run networks" vs history | `runNetworks` Set | Highlight networks first seen in the current session vs. known from DB |
| Background service | `WigleService` | Keep scanning when app is backgrounded; post ongoing notification |
| SSID filter / search | `AbstractSearchFragment` | Let user filter the live list by SSID substring |
| Channel / frequency display | `chan_freq_string` TextView | Show e.g. "5 GHz ch 36" in item row |
| Passpoint / Hotspot 2.0 | `passpointIcon` | Badge for Passpoint-capable APs |

#### Desktop
| Feature | Notes |
|---------|-------|
| WiGLE REST API upload | `AbstractApiRequest` → POST to `https://api.wigle.net/api/v2/file/upload` |
| WiGLE CSV v1.4 / v1.6 import | Parse existing wardrive files for display on map |
| Map tile overlay | WiGLE uses OSM tiles; we can use Mapbox/Google for the desktop map view |

---

## 2. m8b — Magic 8-Ball geolocation

| | |
|---|---|
| **Repo** | <https://github.com/wiglenet/m8b> |
| **Language** | Java |
| **Applies to** | Wi-Fi Sentry Desktop · flipp3d |
| **Priority** | ★★ Export format + future lookup |

### What it is
A compact binary geolocation database and query tool built on top of the WiGLE
dataset.  Takes a list of MAC addresses and returns their most-likely MGRS
(Military Grid Reference System) grid squares.

### Export format (already implemented)
```
<MAC>\t<latitude>\t<longitude>
```
One row per unique BSSID, tab-separated, no header.  Feed this file into m8b's
`generate` command to produce a `.m8b` lookup database.

> **Current limitation:** coordinates are `0.0` until GPS is integrated.
> Once `ScannedNetwork` stores lat/lon, the m8b export becomes a real
> location-to-BSSID mapping table.

### Features to adopt

| Feature | Notes |
|---------|-------|
| MGRS coordinate display | Show grid reference alongside lat/lon in AP detail; useful for flipp3d field ops |
| Offline MAC→location lookup | Bundle a regional `.m8b` slice; query it to show "last known location" for a BSSID even without internet |
| m8b `scan` command integration | Desktop: pass a list of BSSIDs, get back likely grid squares for contextualization |

---

## 3. Ghost\_ESP

| | |
|---|---|
| **Repo** | <https://github.com/jaylikesbunda/Ghost_ESP> |
| **Language** | C (ESP-IDF) |
| **Applies to** | Wi-Fi Sentry threat model · flipp3d hardware layer |
| **Priority** | ★★★ Threat model & attack taxonomy |

### What it is
ESP32 firmware that implements a wide range of WiFi and BLE attack/detection
primitives.  Useful as a **threat taxonomy** — every attack it can *perform*
is something our app should *detect*.

### Threat taxonomy to map to `ThreatType`

| Ghost\_ESP feature | Current `ThreatType` | Gap / improvement |
|---|---|---|
| Evil Portal (fake captive portal AP) | `EVIL_TWIN` | Add `EVIL_PORTAL` — open AP with matching SSID that serves a login page |
| Deauth flood | `DEAUTH_FLOOD` | ✅ covered |
| Beacon spam (many fake SSIDs) | `BEACON_FLOOD` | ✅ covered |
| WiFi Pineapple / Karma detection | `PROBE_RESPONSE_ANOMALY` | ✅ covered; add Pineapple-specific SSID heuristics |
| SAE flood (WPA3) | — | New: detect sudden flood of SAE Commit frames → `WPA3_SAE_FLOOD` |
| EAPOL logoff (disconnect authenticated clients) | — | New: detect EAPOL logoff storms → `EAPOL_LOGOFF_FLOOD` |
| DHCP starvation | — | New: detect burst of DHCP Discover from varied MACs → `DHCP_STARVATION` |
| Drone detection | — | Future: detect DJI OcuSync / drone beacon SSIDs |
| Station scanning | — | Show connected clients per AP (requires monitor mode / root) |
| Port scanning | — | Desktop: integrate nmap-style port scan results alongside WiFi data |
| ARP scanning | — | Surface ARP scan data in network detail (device count on AP) |

### ESP32 companion integration (flipp3d)
Ghost\_ESP exposes a serial/BLE command interface.  The `GhostESP-Companion`
Android app communicates over BLE serial.  For **flipp3d**, consider:
- BLE serial protocol for issuing scan commands to an attached ESP32
- Receiving deauth / beacon / probe frames captured by ESP32 in monitor mode
- Using ESP32 as a passive RF sensor feeding data into the Android/desktop UI

---

## 4. GhostESP-Companion (Android)

| | |
|---|---|
| **Repo** | <https://github.com/jaylikesbunda/GhostESP-Companion> |
| **Language** | Kotlin (Jetpack Compose) |
| **Applies to** | Wi-Fi Sentry Android UI |
| **Priority** | ★★ UI / UX patterns |

### What it is
A Kotlin/Compose Android companion app for Ghost\_ESP devices.  Primarily
relevant as a **UI reference** — not for code reuse.

### UI patterns to adopt

| Pattern | GhostESP file | Wi-Fi Sentry equivalent |
|---------|---------------|------------------------|
| Security badge pills (WPA3/WPA2/WEP/Open) | `BrutalistComponents.kt` | ✅ `text_security_badge` in `item_network.xml` |
| RSSI colored signal text | `SetNetworkListAdapter` | ✅ `signal_good/fair/weak` colors |
| AP detail screen (not just a dialog) | `ApDetailScreen.kt` | Upgrade `showNetworkDetailDialog()` to a full `Activity` or `BottomSheetDialogFragment` |
| Real-time threat assessment chips | `WifiScreen.kt` | Show threat badges inline on each list row |
| Dark theme with amber accent for threats | Theme system | ✅ `flag_background` dark amber in `values-night/colors.xml` |
| Bottom navigation with pill highlights | `ModernNavigationBar` | Add bottom nav: Scan · History · Settings |
| Handshake capture status | `HandshakeCaptureScreen.kt` | Future: WPA handshake capture indicator (root required) |

---

## 5. rpi-hunter

| | |
|---|---|
| **Repo** | <https://github.com/BusesCanFly/rpi-hunter> |
| **Language** | Python |
| **Applies to** | Wi-Fi Sentry Desktop · flipp3d |
| **Priority** | ★ LAN recon reference |

### What it is
Python tool that ARP-scans a LAN, identifies Raspberry Pi devices by OUI
(`B8:27:EB`, `DC:A6:32`, `E4:5F:01`), then attempts SSH login with default
credentials and delivers a payload.

### Concepts to adopt

| Concept | Notes |
|---------|-------|
| OUI-based device fingerprinting | Extend our OUI lookup to flag known-IoT / known-rogue OUI prefixes in the scan list (Pi, ESP32, Pineapple hardware) |
| ARP scan for connected clients | Desktop: show devices connected to each discovered AP (ARP over the management interface) |
| Default-credential awareness | Annotate APs whose OUI belongs to CPE manufacturers known to ship default passwords (ISP routers, cameras) |
| LAN sweep post-association | Future: after connecting to a test network, enumerate LAN hosts and surface them in the desktop map |

---

## 6. Sniffnet

| | |
|---|---|
| **Repo** | <https://github.com/GyulyVGC/sniffnet> |
| **Language** | Rust (iced GUI) |
| **Applies to** | Wi-Fi Sentry Desktop |
| **Priority** | ★★★ Primary desktop UI reference |

### What it is
Cross-platform network monitoring application (32 K+ stars).  Shows real-time
traffic charts, connection inspection, protocol breakdown, ASN/geo lookup, and
custom notifications.  Exports full PCAP captures.

### Desktop UI patterns to adopt

| Pattern | Sniffnet feature | Desktop implementation idea |
|---------|------------------|-----------------------------|
| Overview dashboard | Traffic overview page with live bandwidth chart | Replace the current basic Electron window with a dashboard: scan status + live network count + threat gauge |
| Real-time chart | `bytes_chart` (iced Canvas) | Live RSSI chart per AP during monitoring; threat event timeline |
| Protocol / service ID | 6000+ service fingerprints | Map WiFi capabilities string → human label (already started with `WifiDisplayUtils`) |
| Connection inspector | Per-connection detail pane | Per-AP detail pane: BSSID history, RSSI over time, associated client list |
| Custom notifications | Threshold-based alerts | Desktop notifications when a new threat type is first seen |
| PCAP export | `libpcap` integration | Export raw 802.11 frame captures (requires monitor mode / pcap lib on desktop) |
| Geolocation | MaxMind GeoIP | Show AP location on map tile; correlate with WiGLE coordinates |
| Thumbnail / minimized mode | `thumbnail.png` | Floating mini-widget showing live threat count while app is in background |
| Custom themes | `deep_cosmos.png` | Dark / light / custom theme support in the Electron desktop app |
| ASN lookup | IPinfo integration | For connected gateway IP: show ISP/ASN name in network detail |
| Filters | Protocol / IP filter bar | Filter scan results by band, security type, threat type in real-time |

### Architecture notes for desktop
Sniffnet uses `iced` (Rust GUI) + `pcap` crate.  Our desktop uses Electron + Node.
The patterns still apply:
- Separate **capture thread** (IPC worker) from **UI thread** — mirrors our
  `adapter-ipc-handlers.js` pattern
- **State machine** for scan phases: Idle → Scanning → Processing → Live
- **Ring buffer** for chart data — keep last N RSSI samples per BSSID

---

## 7. Evilginx 2/3

| | |
|---|---|
| **Repo** | <https://github.com/kgretzky/evilginx2> |
| **Language** | Go |
| **Applies to** | Wi-Fi Sentry threat model |
| **Priority** | ★★ Evil-twin / captive-portal threat detection |

### What it is
A man-in-the-middle reverse-proxy phishing framework.  Operates as a transparent
HTTP+DNS proxy between a victim and a real website; captures credentials and
session cookies, bypassing 2FA.  Often deployed behind a rogue AP / evil twin.

### Threat-model improvements for `ThreatAnalyzer`

| Evilginx attack vector | Detection strategy for Wi-Fi Sentry |
|---|---|
| Rogue AP serving a captive portal that proxies a real site | Detect APs with `[ESS]` only (open) + `SSID` matching a known-good network — flag as `EVIL_PORTAL` |
| DNS hijacking on captive portal | Future: after user association, probe DNS for known domains and check if resolved IPs are local — flag `DNS_HIJACK_SUSPECTED` |
| SSL stripping / invalid cert on portal | Future: HTTP probe returns a valid-looking page on port 80 with no redirect to HTTPS — flag `SSL_STRIP_SUSPECTED` |
| Session-cookie harvest via MITM | Educate users: any `EVIL_TWIN` or `EVIL_PORTAL` alert means credentials entered on that network may be compromised |
| Phishlet-based credential capture | Detection: AP with `[ESS]` + no encryption + SSID cloned from nearby WPA2 network + abnormal RSSI |

### UX copy improvements
Evilginx's attack descriptions are clear, jargon-free explainers.  Model our
per-threat `detailDescription()` strings on the same plain-English style:
- "A fake WiFi hotspot is impersonating…" not "EVIL_TWIN detected"

---

## 8. Wi-Fi Pineapple Cloner

| | |
|---|---|
| **Repo** | <https://github.com/xchwarze/wifi-pineapple-cloner> |
| **Language** | Shell / OpenWrt |
| **Applies to** | Wi-Fi Sentry threat model · flipp3d hardware |
| **Priority** | ★★ Pineapple detection heuristics |

### What it is
Scripts to port the Hak5 WiFi Pineapple NANO / TETRA firmware to generic
OpenWrt-compatible routers.  The resulting device is a fully functional
network auditing platform: karma attack, deauth, PineAP, DNS spoof, PMKID
attack, captive portal.

### Pineapple detection heuristics for `ThreatAnalyzer`

| Pineapple capability | Detection heuristic |
|---|---|
| Karma / PineAP (responds to any probe request) | `PROBE_RESPONSE_ANOMALY` — already implemented |
| Broadcasting dozens of SSIDs | `BEACON_FLOOD` / `MULTI_SSID_SAME_OUI` — already implemented |
| Open AP + known Pineapple OUI (`00:C0:CA`) | Add OUI check: flag `PINEAPPLE_OUI_SUSPECTED` when BSSID starts with Pineapple hardware OUI |
| Captive portal on 172.16.42.1 (default Pineapple IP) | Future: post-association probe to 172.16.42.1 — if panel is reachable flag `PINEAPPLE_PANEL_DETECTED` |
| PMKID attack (passive WPA2 crack) | Inform user: any `EVIL_TWIN` AP near a WPA2 network is a potential PMKID harvester — rotate PSK if flagged |
| DNSmasq-based DNS hijack | Same as Evilginx DNS hijack detection above |

### flipp3d hardware notes
- The Pineapple Cloner targets GL-iNet AR150 / AR750S (same SoC family as many
  cheap travel routers) — good candidate for a flipp3d reference hardware platform
- `wpc-tools` CLI pattern: simple positional commands (`theme_install`, `update`) —
  adopt for any flipp3d device management CLI
- PMKID module source: <https://github.com/xchwarze/wifi-pineapple-community/tree/main/modules/src/PMKIDAttack>

---

## Cross-project feature matrix

| Feature | Android | Desktop | flipp3d | Reference repo |
|---------|:-------:|:-------:|:-------:|---------------|
| Live network streaming | ✅ done | — | — | WiGLE |
| WiGLE CSV v1.4 export | ✅ done | planned | — | WiGLE |
| m8b MAC·LAT·LON export | ✅ done | planned | — | m8b |
| OUI vendor lookup | planned | planned | — | WiGLE, rpi-hunter |
| GPS-tagged scan records | planned | planned | — | WiGLE |
| WiGLE REST API upload | — | planned | — | WiGLE |
| Real-time RSSI chart | — | planned | — | Sniffnet |
| PCAP export | — | planned | — | Sniffnet |
| Traffic dashboard | — | planned | — | Sniffnet |
| `EVIL_PORTAL` threat type | planned | planned | — | Evilginx, Ghost\_ESP |
| `PINEAPPLE_OUI_SUSPECTED` | planned | planned | — | Pineapple Cloner |
| `DNS_HIJACK_SUSPECTED` | planned | planned | — | Evilginx |
| `SAE_FLOOD` / `EAPOL_FLOOD` | planned | planned | — | Ghost\_ESP |
| Pineapple panel probe | planned | planned | — | Pineapple Cloner |
| AP detail screen (full) | planned | planned | — | GhostESP-Companion |
| Bottom navigation | planned | — | — | GhostESP-Companion |
| ESP32 BLE serial bridge | — | — | planned | Ghost\_ESP |
| LAN ARP sweep | — | planned | planned | rpi-hunter |
| MGRS coordinate display | — | planned | planned | m8b |
| Custom theme support | — | planned | — | Sniffnet |

---

## Notes for flipp3d specifically

flipp3d is a separate project.  The repos most directly relevant:

1. **Ghost\_ESP** — firmware architecture for an ESP32-based field device; BLE
   serial command protocol; attack primitive taxonomy.
2. **m8b** — offline BSSID→grid-square lookups for field use without internet.
3. **rpi-hunter** — OUI fingerprinting; ARP-based LAN discovery; SSH payload
   delivery pattern (adapt for flipp3d's post-exploitation module).
4. **Wi-Fi Pineapple Cloner** — GL-iNet OpenWrt target hardware; PMKID module;
   `wpc-tools` CLI design pattern; reference for what a fully-featured rogue-AP
   platform exposes.
5. **Evilginx** — evil-portal / MITM architecture; phishlet abstraction; DNS
   server integration; session-cookie interception — relevant if flipp3d needs
   a captive-portal or credential-testing module.
