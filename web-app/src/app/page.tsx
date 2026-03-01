'use client';

import { useEffect, useState, useCallback } from 'react';
import LiveScanResults from '../components/LiveScanResults';
import DependencyChecker from '../components/DependencyChecker';
import PlatformShowcase from '../components/PlatformShowcase';

export default function Home() {
  const [techniques, setTechniques] = useState<string[]>([]);
  const [threats, setThreats] = useState<any[]>([]);
  const [locationConsent, setLocationConsent] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL 
    ? `${process.env.NEXT_PUBLIC_API_URL}/api`
    : 'http://localhost:3000/api';

  const fetchThreats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/cataloged-threats`);
      const data = await res.json();
      setThreats(data);
    } catch (error) {
      console.error('Failed to fetch threats:', error);
    }
  }, [API_BASE]);

  const checkLocationConsent = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/location-consent`);
      const data = await res.json();
      setLocationConsent(data.consent);
    } catch (error) {
      console.error('Failed to check location consent:', error);
    }
  }, [API_BASE]);

  useEffect(() => {
    // Probe backend availability — AbortController for broad browser compatibility
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    fetch(`${API_BASE}/health`, { signal: controller.signal })
      .then(() => setBackendAvailable(true))
      .catch(() => setBackendAvailable(false))
      .finally(() => clearTimeout(timer));
  }, [API_BASE]);

  useEffect(() => {
    if (backendAvailable) {
      fetchThreats();
      checkLocationConsent();
    }
  }, [backendAvailable, fetchThreats, checkLocationConsent]);

  const handleTechniqueChange = (technique: string) => {
    setTechniques(prev =>
      prev.includes(technique)
        ? prev.filter(t => t !== technique)
        : [...prev, technique]
    );
  };

  const handleLocationConsent = async (consent: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/location-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent }),
      });
      const data = await res.json();
      setLocationConsent(data.consent);
    } catch (error) {
      console.error('Failed to update location consent:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">🛡️ WiFi Sentry</h1>
          <p className="text-slate-300">Advanced WiFi Monitoring &amp; Threat Detection</p>
        </div>

        {/* Backend-dependent content */}
        {backendAvailable === false ? (
          /* ── No backend: show platform showcase ── */
          <section>
            <h2 className="text-2xl font-bold mb-6">Get the full experience</h2>
            <PlatformShowcase />
          </section>
        ) : (
          /* ── Backend available: show live scanning UI ── */
          <>
            <div className="mb-8">
              <DependencyChecker apiBase={API_BASE} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Control Panel */}
              <div className="lg:col-span-1">
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 sticky top-8">
                  <h2 className="text-xl font-bold mb-4">Detection Techniques</h2>

                  <div className="space-y-3 mb-6">
                    {[
                      { id: 'karma',      label: 'Karma Attacks' },
                      { id: 'evil-twin',  label: 'Evil Twins' },
                      { id: 'pineapple',  label: 'WiFi Pineapple' },
                    ].map(tech => (
                      <label key={tech.id} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={techniques.includes(tech.id)}
                          onChange={() => handleTechniqueChange(tech.id)}
                          className="w-4 h-4 rounded text-blue-500 bg-slate-600 border-slate-500 focus:ring-blue-500"
                        />
                        <span className="ml-3">{tech.label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Location Consent */}
                  <div className="mt-6 pt-6 border-t border-slate-600">
                    <h3 className="font-semibold mb-3">Location Tracking</h3>
                    <button
                      onClick={() => handleLocationConsent(!locationConsent)}
                      className={`w-full py-2 rounded font-semibold transition ${
                        locationConsent
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      {locationConsent ? '✓ Enabled' : 'Disabled'}
                    </button>
                    <p className="text-xs text-slate-400 mt-2">
                      {locationConsent
                        ? 'Your location is being tracked for network mapping'
                        : 'Enable to map WiFi networks on a map'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Results Panel */}
              <div className="lg:col-span-2 space-y-8">
                <LiveScanResults techniques={techniques} />

                {/* Threat Catalog */}
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <h2 className="text-xl font-bold mb-4">Known Threats ({threats.length})</h2>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {threats.length === 0 ? (
                      <p className="text-slate-400">No threats in catalog yet.</p>
                    ) : (
                      threats.slice(0, 5).map((threat, idx) => (
                        <div key={idx} className="bg-slate-700 rounded p-3">
                          <p className="font-semibold text-sm">{threat.name}</p>
                          <p className="text-xs text-slate-300">{threat.description}</p>
                          <span className={`inline-block text-xs px-2 py-1 rounded mt-2 ${
                            threat.severity === 'Critical' ? 'bg-red-600' :
                            threat.severity === 'High'     ? 'bg-orange-600' :
                            threat.severity === 'Medium'   ? 'bg-yellow-600' :
                            'bg-blue-600'
                          }`}>
                            {threat.severity}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
              {[
                { title: 'Real-time Scanning',    desc: 'Detect threats as they appear' },
                { title: 'AI-Powered Research',   desc: 'Submit threats for AI analysis' },
                { title: 'Location Mapping',      desc: 'Track WiFi networks on maps' },
              ].map((feature, idx) => (
                <div key={idx} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-400">{feature.desc}</p>
                </div>
              ))}
            </div>

            {/* Showcase at the bottom when backend is available */}
            <section className="mt-16">
              <h2 className="text-2xl font-bold mb-6">Native apps for full capabilities</h2>
              <PlatformShowcase />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
