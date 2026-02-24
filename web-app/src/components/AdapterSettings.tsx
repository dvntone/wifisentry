'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Adapter {
  id?: string;
  name: string;
  type: 'built-in' | 'external-usb';
  vendor?: string;
  model?: string;
  status: string;
  isExternal: boolean;
  signalStrength?: number;
  supportsMonitorMode?: boolean;
}

interface AdapterSettings {
  useExternalAdapter: boolean;
  selectedAdapterId: string;
  autoDetectAdapters: boolean;
  monitoringMode: 'default' | 'monitor' | 'promiscuous';
  rootAccessEnabled: boolean;
}

interface CaptureBackend {
  id: string;
  label: string;
  description: string;
  available: boolean;
  monitorMode: boolean;
  requiresHardware: boolean;
  installUrl: string;
}

const WiFiAdapterSettings: React.FC = () => {
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [selectedAdapter, setSelectedAdapter] = useState<Adapter | null>(null);
  const [settings, setSettings] = useState<AdapterSettings>({
    useExternalAdapter: false,
    selectedAdapterId: '',
    autoDetectAdapters: true,
    monitoringMode: 'default',
    rootAccessEnabled: false,
  });
  const [isRooted, setIsRooted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Capture backend state (desktop / Electron only)
  const [captureBackends, setCaptureBackends] = useState<Record<string, CaptureBackend>>({});
  const [activeBackend, setActiveBackend] = useState<string | null>(null);
  const [backendSwitching, setBackendSwitching] = useState(false);

  // Detect platform synchronously — no async setState needed
  const platform: 'web' | 'windows' | 'android' = (() => {
    if (typeof window === 'undefined') return 'web';
    if ((window as any).electron)   return 'windows';
    if ((window as any).Capacitor)  return 'android';
    return 'web';
  })();

  const isElectron = platform === 'windows';

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadAdapters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isElectron) {
        const result = await (window as any).electron.getAvailableAdapters?.();
        setAdapters(result?.adapters || []);
      } else if (platform === 'android') {
        const response = await fetch('/api/adapters?platform=android');
        const data = await response.json();
        setAdapters(data.adapters || []);
        setIsRooted(data.deviceInfo?.isRooted || false);
      } else {
        const response = await fetch('/api/adapters?platform=web');
        const data = await response.json();
        setAdapters(data.adapters || []);
      }
    } catch (err) {
      setError(`Failed to load adapters: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [isElectron, platform]);

  const loadSettings = useCallback(async () => {
    try {
      if (isElectron) {
        const data = await (window as any).electron.getSettings?.();
        if (data?.adapterSettings) setSettings(data.adapterSettings);
        if (data?.selectedAdapter) setSelectedAdapter(data.selectedAdapter);
      } else {
        const response = await fetch('/api/adapters/settings');
        const data = await response.json();
        if (data.settings)        setSettings(data.settings);
        if (data.selectedAdapter) setSelectedAdapter(data.selectedAdapter);
      }
    } catch {
      // settings not yet saved — use defaults
    }
  }, [isElectron]);

  const loadCaptureBackends = useCallback(async () => {
    if (!isElectron) return;
    try {
      const result = await (window as any).electron.getCaptureBackends?.();
      if (result?.backends) setCaptureBackends(result.backends);
      if (result?.active)   setActiveBackend(result.active);
    } catch { /* feature not yet available */ }
  }, [isElectron]);

  useEffect(() => {
    loadAdapters();
    loadSettings();
    loadCaptureBackends();
  }, [loadAdapters, loadSettings, loadCaptureBackends]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleAdapterSelect = async (adapter: Adapter) => {
    try {
      if (isElectron) {
        const result = await (window as any).electron.selectAdapter(adapter.name);
        if (result.success) setSelectedAdapter(adapter);
        else setError(result.error);
      } else {
        const response = await fetch('/api/adapters/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adapterId: adapter.id || adapter.name, adapterName: adapter.name, platform }),
        });
        if (response.ok) {
          setSelectedAdapter(adapter);
          setSettings(prev => ({
            ...prev,
            useExternalAdapter: adapter.isExternal,
            selectedAdapterId: adapter.id || adapter.name,
          }));
        } else {
          setError('Failed to select adapter');
        }
      }
    } catch (err) {
      setError(`Error selecting adapter: ${err}`);
    }
  };

  const handleMonitoringModeChange = async (mode: string) => {
    if (mode !== 'default' && !isRooted) {
      setError('Root access required for ' + mode + ' mode');
      return;
    }
    try {
      const response = await fetch('/api/adapters/enable-' + mode + '-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapterId: selectedAdapter?.id }),
      });
      if (response.ok) {
        setSettings(prev => ({ ...prev, monitoringMode: mode as any }));
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to enable ' + mode + ' mode');
      }
    } catch (err) {
      setError(`Error changing monitoring mode: ${err}`);
    }
  };

  const handleSettingsUpdate = async () => {
    try {
      setSaveStatus('idle');
      if (isElectron) {
        await (window as any).electron.saveSettings?.({ adapterSettings: settings });
      } else {
        const response = await fetch('/api/adapters/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, settings }),
        });
        if (!response.ok) throw new Error('Server returned error');
      }
      setSaveStatus('saved');
      setError(null);
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      setSaveStatus('error');
      setError(`Error saving settings: ${err}`);
    }
  };

  const handleSetCaptureBackend = async (backend: string) => {
    if (!isElectron) return;
    try {
      setBackendSwitching(true);
      const result = await (window as any).electron.setCaptureBackend?.(backend);
      if (result?.success) {
        setActiveBackend(backend);
        await loadCaptureBackends();
      } else {
        setError(result?.error || 'Failed to switch backend');
      }
    } catch (err) {
      setError(`Error switching backend: ${err}`);
    } finally {
      setBackendSwitching(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 text-center text-slate-300">
        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2" />
        Loading adapters...
      </div>
    );
  }

  const backendList = Object.values(captureBackends);

  return (
    <div className="p-6 max-w-4xl mx-auto text-slate-100">
      <h1 className="text-3xl font-bold mb-6">WiFi Adapter Settings</h1>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/40 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
          {error}
          <button className="float-right text-red-300 hover:text-red-100" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Save status */}
      {saveStatus === 'saved' && (
        <div className="bg-green-900/40 border border-green-500 text-green-200 px-4 py-3 rounded mb-4">
          ✓ Settings saved
        </div>
      )}

      {/* Platform Info */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Device Information</h2>
        <div className="space-y-1 text-sm text-slate-300">
          <div><strong>Platform:</strong> {platform.toUpperCase()}</div>
          {platform === 'android' && (
            <div>
              <strong>Root Access:</strong>{' '}
              <span className={isRooted ? 'text-green-400' : 'text-red-400'}>
                {isRooted ? '✓ Enabled' : '✗ Not Available'}
              </span>
            </div>
          )}
          <div><strong>Available Adapters:</strong> {adapters.length}</div>
        </div>
      </div>

      {/* Current Adapter */}
      {selectedAdapter && (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Active Adapter</h2>
          <div className="space-y-1 text-sm text-slate-300">
            <div><strong>{selectedAdapter.name}</strong> <span className="text-slate-400">[{selectedAdapter.type}]</span></div>
            {selectedAdapter.vendor && <div><strong>Vendor:</strong> {selectedAdapter.vendor}</div>}
            {selectedAdapter.model  && <div><strong>Model:</strong>  {selectedAdapter.model}</div>}
            {selectedAdapter.signalStrength !== undefined && (
              <div><strong>Signal:</strong> {selectedAdapter.signalStrength}%</div>
            )}
          </div>
        </div>
      )}

      {/* Adapter Selection */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Available Adapters</h2>
        {adapters.length === 0 ? (
          <p className="text-slate-400 text-sm">No adapters found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {adapters.map(adapter => (
              <div
                key={adapter.id || adapter.name}
                className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                  selectedAdapter?.name === adapter.name
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-slate-600 hover:border-slate-500 bg-slate-800'
                }`}
                onClick={() => handleAdapterSelect(adapter)}
              >
                <div className="font-semibold">{adapter.name}</div>
                <div className="text-sm text-slate-400">{adapter.type}</div>
                {adapter.vendor && <div className="text-xs text-slate-500">{adapter.vendor}</div>}
              </div>
            ))}
          </div>
        )}
        <button onClick={loadAdapters} className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition text-sm">
          Refresh Adapters
        </button>
      </div>

      {/* Monitor mode backends (Electron only) */}
      {isElectron && backendList.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-1">802.11 Monitor Mode Backend</h2>
          <p className="text-sm text-slate-400 mb-3">
            Select the method used to put your adapter into monitor mode for raw frame capture.
          </p>
          <div className="space-y-2">
            {/* Auto option */}
            <label className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${
              activeBackend === 'auto' ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 bg-slate-800 hover:border-slate-500'
            }`}>
              <input
                type="radio" name="captureBackend" value="auto"
                checked={activeBackend === 'auto'}
                onChange={() => handleSetCaptureBackend('auto')}
                disabled={backendSwitching}
                className="mt-1"
              />
              <div>
                <div className="font-semibold text-sm">Auto-detect <span className="text-blue-400 text-xs ml-1">(recommended)</span></div>
                <div className="text-xs text-slate-400">Try available backends in order: Npcap → WSL2 → AirPcap → Vendor driver</div>
              </div>
            </label>

            {backendList.map(b => (
              <label key={b.id} className={`flex items-start gap-3 p-3 border-2 rounded-lg transition ${
                b.available
                  ? `cursor-pointer ${activeBackend === b.id ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 bg-slate-800 hover:border-slate-500'}`
                  : 'border-slate-700 bg-slate-800/40 cursor-not-allowed opacity-50'
              }`}>
                <input
                  type="radio" name="captureBackend" value={b.id}
                  checked={activeBackend === b.id}
                  onChange={() => handleSetCaptureBackend(b.id)}
                  disabled={!b.available || backendSwitching}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{b.label}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${b.available ? 'bg-green-800 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
                      {b.available ? 'Available' : 'Not installed'}
                    </span>
                    {b.monitorMode && b.available && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-800 text-blue-300">Monitor mode ✓</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{b.description}</div>
                  {!b.available && (
                    <a href={b.installUrl} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-blue-400 hover:underline mt-1 inline-block">
                      Install →
                    </a>
                  )}
                </div>
              </label>
            ))}
          </div>
          {backendSwitching && <p className="text-xs text-slate-400 mt-2">Switching backend…</p>}
        </div>
      )}

      {/* Monitoring Mode (Android rooted only) */}
      {platform === 'android' && !isRooted && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-300 mb-2">⚠️ Root Access Required</h3>
          <p className="text-sm text-yellow-200">
            Rooting your device enables advanced monitoring modes:
          </p>
          <ul className="list-disc list-inside mt-2 text-sm text-yellow-200 space-y-1">
            <li>Monitor mode — capture raw 802.11 frames</li>
            <li>Deauth flood detection</li>
            <li>Probe-response anomaly (Karma) detection</li>
          </ul>
        </div>
      )}

      {platform === 'android' && isRooted && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Monitoring Mode</h2>
          <div className="space-y-3">
            {(['default', 'monitor', 'promiscuous'] as const).map(mode => (
              <label key={mode} className="flex items-center p-3 border border-slate-600 rounded-lg hover:bg-slate-800 cursor-pointer">
                <input
                  type="radio" name="monitoringMode" value={mode}
                  checked={settings.monitoringMode === mode}
                  onChange={() => handleMonitoringModeChange(mode)}
                  className="mr-3"
                />
                <span className="font-medium capitalize">{mode}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {mode === 'default'      && '(Standard WiFi scanning)'}
                  {mode === 'monitor'      && '(Raw 802.11 frame capture)'}
                  {mode === 'promiscuous'  && '(Capture all frames — requires root)'}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="mb-6 bg-slate-800 border border-slate-700 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Settings</h2>
        <div className="space-y-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoDetectAdapters}
              onChange={e => setSettings(prev => ({ ...prev, autoDetectAdapters: e.target.checked }))}
              className="mr-3"
            />
            <span>Auto-detect external adapters</span>
          </label>
          {platform === 'windows' && (
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.useExternalAdapter}
                onChange={e => setSettings(prev => ({ ...prev, useExternalAdapter: e.target.checked }))}
                className="mr-3"
              />
              <span>Prefer external USB adapter when available</span>
            </label>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSettingsUpdate}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
        >
          Save Settings
        </button>
        <button
          onClick={loadAdapters}
          className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};

export default WiFiAdapterSettings;

