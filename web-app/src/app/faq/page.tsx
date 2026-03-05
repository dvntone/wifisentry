'use client';

export default function FAQPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto text-slate-300">
      <div className="border-b border-cyan-900/50 pb-6 mb-8">
        <h1 className="text-4xl font-bold text-cyan-400 mb-2">FAQ & HELP</h1>
        <p className="text-sm font-mono text-cyan-700">Frequently Asked Questions</p>
      </div>

      <div className="space-y-6">
        {[
          {
            q: "What is an 'Evil Twin'?",
            a: "An Evil Twin is a fraudulent Wi-Fi access point that appears to be legitimate, set up to eavesdrop on wireless communications. WiFi Sentry detects these by comparing BSSID signatures and OUI vendor data against known good histories."
          },
          {
            q: "What is a 'Karma Attack'?",
            a: "A Karma attack occurs when a rogue access point listens for devices broadcasting requests for previously saved networks, and then impersonates those networks to force a connection. WiFi Sentry monitors your environment for rapid, anomalous SSID spawning to detect this."
          },
          {
            q: "Does this require root on Android?",
            a: "No. The Android version uses standard OS APIs (WifiManager) and operates completely without root privileges."
          },
          {
            q: "Where is my data stored?",
            a: "All historical scan data is stored locally on your device (SQLite/JSON). No network telemetry is sent to the cloud unless you explicitly request an AI Threat Analysis via Gemini."
          }
        ].map((faq, idx) => (
          <div key={idx} className="bg-slate-900 border-l-4 border-emerald-500 p-5 rounded shadow-lg">
            <h3 className="text-lg font-bold text-white mb-2">{faq.q}</h3>
            <p className="text-slate-400">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}