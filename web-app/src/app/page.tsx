'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [techniques, setTechniques] = useState<string[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [findings, setFindings] = useState<any[]>([]);
  const [threats, setThreats] = useState<any[]>([]);
  const [locationConsent, setLocationConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const API_BASE = 'http://localhost:3000/api';

  useEffect(() => {
    fetchThreats();
    checkLocationConsent();
  }, []);

  const checkLocationConsent = async () => {
    try {
      const res = await fetch(`${API_BASE}/location-consent`);
      const data = await res.json();
      setLocationConsent(data.consent);
    } catch (error) {
      console.error('Failed to check location consent:', error);
    }
  };

  const fetchThreats = async () => {
    try {
      const res = await fetch(`${API_BASE}/cataloged-threats`);
      const data = await res.json();
      setThreats(data);
    } catch (error) {
      console.error('Failed to fetch threats:', error);
    }
  };

  const handleTechniqueChange = (technique: string) => {
    setTechniques(prev =>
      prev.includes(technique)
        ? prev.filter(t => t !== technique)
        : [...prev, technique]
    );
  };

  const handleStartMonitoring = async () => {
    if (techniques.length === 0) {
      alert('Please select at least one technique');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/start-monitoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ techniques }),
      });
      const data = await res.json();
      setFindings(data.findings || []);
      setIsMonitoring(true);
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      alert('Failed to start monitoring');
    } finally {
      setLoading(false);
    }
  };

  const handleStopMonitoring = async () => {
    try {
      await fetch(`${API_BASE}/stop-monitoring`, { method: 'POST' });
      setIsMonitoring(false);
    } catch (error) {
      console.error('Failed to stop monitoring:', error);
    }
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
          <p className="text-slate-300">Advanced WiFi Monitoring & Threat Detection</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Control Panel */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 sticky top-8">
              <h2 className="text-xl font-bold mb-4">Detection Techniques</h2>

              <div className="space-y-3 mb-6">
                {[
                  { id: 'karma', label: 'Karma Attacks' },
                  { id: 'evil-twin', label: 'Evil Twins' },
                  { id: 'pineapple', label: 'WiFi Pineapple' },
                ].map(tech => (
                  <label key={tech.id} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={techniques.includes(tech.id)}
                      onChange={() => handleTechniqueChange(tech.id)}
                      className="w-4 h-4 rounded"
                      disabled={isMonitoring}
                    />
                    <span className="ml-3">{tech.label}</span>
                  </label>
                ))}
              </div>

              <button
                onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
                disabled={loading || (techniques.length === 0 && !isMonitoring)}
                className={`w-full py-2 rounded font-semibold transition ${
                  isMonitoring
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {loading ? 'Processing...' : isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
              </button>

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
            {/* Threats Summary */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-xl font-bold mb-4">Detected Threats</h2>
              {findings.length === 0 ? (
                <p className="text-slate-400">No threats detected yet. Start monitoring to see results.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {findings.map((finding, idx) => (
                    <div key={idx} className="bg-slate-700 rounded p-3 border-l-4 border-red-500">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{finding.ssid || 'Unknown SSID'}</p>
                          <p className="text-sm text-slate-300">{finding.type} - {finding.threat || finding.reason}</p>
                          <p className="text-xs text-slate-400">BSSID: {finding.bssid}</p>
                        </div>
                        <span className="text-xs bg-red-600/20 text-red-300 px-2 py-1 rounded">
                          {finding.severity || 'Alert'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                        threat.severity === 'High' ? 'bg-orange-600' :
                        threat.severity === 'Medium' ? 'bg-yellow-600' :
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
            { title: 'Real-time Scanning', desc: 'Detect threats as they appear' },
            { title: 'AI-Powered Research', desc: 'Submit threats for AI analysis' },
            { title: 'Location Mapping', desc: 'Track WiFi networks on maps' },
          ].map((feature, idx) => (
            <div key={idx} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

