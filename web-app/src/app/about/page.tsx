'use client';

export default function AboutPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto text-slate-300">
      <div className="border-b border-cyan-900/50 pb-6 mb-8">
        <h1 className="text-4xl font-bold text-cyan-400 mb-2">ABOUT_SYSTEM</h1>
        <p className="text-sm font-mono text-cyan-700">WiFi Sentry // Core Documentation</p>
      </div>

      <div className="space-y-8">
        <section className="bg-slate-900 border border-slate-700 p-6 rounded shadow-lg">
          <h2 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
            <span>🛡️</span> Project Overview
          </h2>
          <p className="leading-relaxed">
            WiFi Sentry is a professional-grade threat detection suite designed to protect users against 
            Karma attacks, Evil Twins, WiFi Pineapples, and advanced BSSID spoofing. By acting as a 
            continuous background monitor, it audits every nearby wireless beacon for anomalies.
          </p>
        </section>

        <section className="bg-slate-900 border border-slate-700 p-6 rounded shadow-lg">
          <h2 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
            <span>🧠</span> AI-Native Architecture
          </h2>
          <p className="leading-relaxed mb-4">
            Powered by Google Gemini API, WiFi Sentry doesn't just match signatures—it analyzes the 
            intent behind wireless anomalies. By evaluating historical signal drift and cloned vendor 
            prefixes, the system identifies "low-and-slow" surveillance patterns that static heuristics miss.
          </p>
        </section>

        <section className="bg-slate-900 border border-slate-700 p-6 rounded shadow-lg">
          <h2 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
            <span>📱</span> Cross-Platform Parity
          </h2>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Android Native:</strong> On-device Kotlin engine, biometrically secured.</li>
            <li><strong>Windows Desktop:</strong> Standalone Electron framework.</li>
            <li><strong>Web App (PWA):</strong> Next.js dashboard with live WebSocket telemetry.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}