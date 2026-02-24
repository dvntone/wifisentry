'use client';

/**
 * PlatformShowcase
 *
 * Explains the three distribution tiers of WiFi Sentry and what each can do.
 * Shown in the PWA because the browser has no access to raw WiFi hardware,
 * so users need to understand the native apps to get full functionality.
 *
 * Desktop  — Electron app (Windows 8+)
 *   Full 802.11 monitor mode via Npcap+WlanHelper, WSL2, AirPcap, or vendor drivers.
 *   AI analysis, adapter management, system tray, auto-updates, WiGLE export.
 *
 * Android  — Native Kotlin app (Android 12+)
 *   On-device heuristic scanning via WifiManager, 13 threat checks, no root needed.
 *   Root unlocks monitor mode (DEAUTH_FLOOD, PROBE_RESPONSE_ANOMALY).
 *
 * PWA      — This page (any modern browser)
 *   Limited to what the browser exposes.  Connects to a local/remote backend for
 *   scanning when available.  Best used as a companion or remote dashboard.
 */

import React, { useState } from 'react';

// ─── Feature matrix ───────────────────────────────────────────────────────────

interface Feature {
  label: string;
  desktop: boolean | 'partial';
  android: boolean | 'partial';
  pwa: boolean | 'partial';
  note?: string;
}

const FEATURES: Feature[] = [
  { label: 'WiFi network scanning',           desktop: true,      android: true,      pwa: 'partial', note: 'PWA depends on backend server' },
  { label: 'Evil Twin detection',             desktop: true,      android: true,      pwa: 'partial' },
  { label: 'Karma Attack detection',          desktop: true,      android: true,      pwa: 'partial' },
  { label: 'WiFi Pineapple detection',        desktop: true,      android: true,      pwa: 'partial' },
  { label: 'MAC spoofing suspected',          desktop: true,      android: true,      pwa: 'partial' },
  { label: 'Beacon flood / spam detection',   desktop: true,      android: true,      pwa: 'partial' },
  { label: 'BSSID near-clone detection',      desktop: true,      android: true,      pwa: 'partial' },
  { label: 'WPS vulnerability flagging',      desktop: true,      android: true,      pwa: 'partial' },
  { label: 'Impossible protocol/band combo',  desktop: true,      android: true,      pwa: 'partial' },
  { label: 'Channel shift detection',         desktop: true,      android: true,      pwa: 'partial' },
  { label: '802.11 monitor mode',             desktop: true,      android: 'partial', pwa: false,     note: 'Android needs root; desktop needs Npcap/WSL2/vendor driver' },
  { label: 'Raw packet capture (PCAP)',       desktop: true,      android: false,     pwa: false,     note: 'Desktop: Npcap+tshark or WSL2+tcpdump' },
  { label: 'Deauth flood detection',          desktop: true,      android: 'partial', pwa: false,     note: 'Requires monitor mode' },
  { label: 'Probe-response anomaly (Karma)',  desktop: true,      android: 'partial', pwa: false,     note: 'Requires monitor mode + tshark' },
  { label: 'AI-powered threat analysis',      desktop: true,      android: false,     pwa: 'partial', note: 'PWA/desktop need Gemini API key configured' },
  { label: 'Scan history',                    desktop: true,      android: true,      pwa: 'partial' },
  { label: 'WiGLE CSV export',               desktop: true,      android: false,     pwa: false },
  { label: 'Location / network mapping',      desktop: true,      android: false,     pwa: 'partial', note: 'Map API feature flag; PWA uses browser geolocation' },
  { label: 'System tray & notifications',     desktop: true,      android: true,      pwa: false },
  { label: 'Auto-updates',                    desktop: true,      android: false,     pwa: false },
  { label: 'No server required',              desktop: false,     android: true,      pwa: false,     note: 'Android is fully self-contained on-device' },
];

// ─── Install cards ────────────────────────────────────────────────────────────

interface PlatformCard {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  description: string;
  highlights: string[];
  captureBackends?: string[];
  installLabel: string;
  installNote: string;
}

const PLATFORMS: PlatformCard[] = [
  {
    id: 'desktop',
    icon: '🖥️',
    title: 'Desktop App',
    subtitle: 'Windows 8+ · Electron',
    badge: 'Full featured',
    badgeColor: 'bg-blue-600',
    description:
      'The most capable version. Puts your WiFi adapter into 802.11 monitor mode to capture raw frames, ' +
      'detect attacks that are invisible to passive scanning, and run AI-powered analysis with Gemini.',
    highlights: [
      'Full 802.11 monitor mode (raw frame capture)',
      'Npcap+WlanHelper, WSL2, AirPcap, or vendor drivers',
      'AI threat analysis via Gemini',
      'System tray, adapter management, auto-updates',
      'WiGLE export, location mapping, PCAP capture',
    ],
    captureBackends: [
      'Npcap + WlanHelper.exe  (Win 8+, recommended)',
      'WSL2 + airmon-ng / iw   (Win 10 2004+ only)',
      'AirPcap USB hardware',
      'RTL8812AU / AR9271 / MT7610U vendor drivers',
    ],
    installLabel: 'Download for Windows',
    installNote: 'Requires Npcap or WSL2 for monitor mode',
  },
  {
    id: 'android',
    icon: '📱',
    title: 'Android App',
    subtitle: 'Android 12+ (API 31) · Native Kotlin',
    badge: 'No root needed',
    badgeColor: 'bg-green-600',
    description:
      'A self-contained companion app. Runs entirely on-device using the Android WifiManager API — ' +
      'no server, no Node.js, no extra tools. 13 heuristic checks applied locally. ' +
      'Root unlocks monitor mode for deeper detection.',
    highlights: [
      '13 on-device heuristic threat checks',
      'No server, no internet, no root required',
      'Scan history (50 records, JSON export)',
      'Live monitoring with threat notifications',
      'Root mode: deauth flood + probe-response anomaly',
    ],
    installLabel: 'Download APK',
    installNote: 'Sideload or install via Play Store (coming soon)',
  },
];

// ─── Cell renderer ────────────────────────────────────────────────────────────

function Cell({ value }: { value: boolean | 'partial' }) {
  if (value === true)      return <span className="text-green-400 text-lg">✓</span>;
  if (value === 'partial') return <span className="text-yellow-400 text-lg" title="Partial / conditional">◐</span>;
  return <span className="text-slate-600 text-lg">—</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

const PlatformShowcase: React.FC = () => {
  const [showMatrix, setShowMatrix] = useState(false);

  return (
    <div className="space-y-8">

      {/* PWA limitation banner */}
      <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-4 flex gap-3">
        <span className="text-amber-400 text-xl flex-shrink-0">⚠️</span>
        <div>
          <p className="font-semibold text-amber-200">Browser limitations apply</p>
          <p className="text-sm text-amber-300/80 mt-1">
            Web browsers cannot access raw WiFi hardware or set adapters to monitor mode.
            This PWA connects to a local backend server for scanning when available,
            but for full 802.11 threat detection download the Desktop or Android app below.
          </p>
        </div>
      </div>

      {/* Platform cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PLATFORMS.map(p => (
          <div key={p.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
            {/* Card header */}
            <div className="p-6 border-b border-slate-700 bg-slate-700/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-3xl">{p.icon}</span>
                    <div>
                      <h3 className="text-lg font-bold leading-tight">{p.title}</h3>
                      <p className="text-xs text-slate-400">{p.subtitle}</p>
                    </div>
                  </div>
                </div>
                <span className={`${p.badgeColor} text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap`}>
                  {p.badge}
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-3 leading-relaxed">{p.description}</p>
            </div>

            {/* Highlights */}
            <div className="p-6 flex-1">
              <ul className="space-y-2">
                {p.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-slate-300">{h}</span>
                  </li>
                ))}
              </ul>

              {/* Capture backend detail for desktop */}
              {p.captureBackends && (
                <div className="mt-4 bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-400 mb-2">Monitor mode backends</p>
                  <ul className="space-y-1">
                    {p.captureBackends.map((b, i) => (
                      <li key={i} className="text-xs text-slate-400 flex items-center gap-2">
                        <span className="text-blue-400">▸</span>{b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Install CTA */}
            <div className="p-6 pt-0">
              <button
                disabled
                className="w-full py-2.5 rounded-lg bg-slate-700 text-slate-300 font-semibold text-sm
                           border border-slate-600 cursor-not-allowed opacity-70"
                title="Download links coming soon"
              >
                {p.installLabel}
              </button>
              <p className="text-xs text-slate-500 mt-2 text-center">{p.installNote}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Feature matrix toggle */}
      <div>
        <button
          onClick={() => setShowMatrix(v => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition"
        >
          <span>{showMatrix ? '▼' : '▶'}</span>
          Full feature comparison
        </button>

        {showMatrix && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-slate-300 font-semibold">Feature</th>
                  <th className="px-4 py-3 text-center text-slate-300 font-semibold">🖥️ Desktop</th>
                  <th className="px-4 py-3 text-center text-slate-300 font-semibold">📱 Android</th>
                  <th className="px-4 py-3 text-center text-slate-300 font-semibold">🌐 PWA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {FEATURES.map((f, i) => (
                  <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-2.5 text-slate-300">
                      {f.label}
                      {f.note && (
                        <span className="ml-2 text-xs text-slate-500">({f.note})</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center"><Cell value={f.desktop} /></td>
                    <td className="px-4 py-2.5 text-center"><Cell value={f.android} /></td>
                    <td className="px-4 py-2.5 text-center"><Cell value={f.pwa} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-700/30">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-xs text-slate-500">
                    ✓ Fully supported &nbsp;·&nbsp; ◐ Partial / conditional &nbsp;·&nbsp; — Not available
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default PlatformShowcase;
