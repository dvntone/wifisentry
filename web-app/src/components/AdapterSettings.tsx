/**
 * WiFi Adapter Settings Component
 * Works on Web (PWA), Windows (Electron), and Android (Capacitor)
 * Allows users to select external WiFi adapters and configure settings
 */

'use client';

import React, { useState, useEffect } from 'react';

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
  const [platform, setPlatform] = useState<'web' | 'windows' | 'android'>('web');

  // Detect platform
  useEffect(() => {
    detectPlatform();
    loadAdapters();
    loadSettings();
  }, []);

  /**
   * Detect which platform we're running on
   */
  const detectPlatform = () => {
    if (typeof window !== 'undefined' && (window as any).electron) {
      setPlatform('windows');
    } else if (typeof window !== 'undefined' && (window as any).Capacitor) {
      setPlatform('android');
    } else {
      setPlatform('web');
    }
  };

  /**
   * Load available adapters
   */
  const loadAdapters = async () => {
    try {
      setLoading(true);
      setError(null);

      if (platform === 'windows' && (window as any).electron) {
        // Electron - get adapters from main process
        const result = await (window as any).electron.getAvailableAdapters?.();
        setAdapters(result?.adapters || []);
      } else if (platform === 'android') {
        // Android - call API or use Capacitor
        const response = await fetch('/api/adapters?platform=android');
        const data = await response.json();
        setAdapters(data.adapters || []);
        setIsRooted(data.deviceInfo?.isRooted || false);
      } else {
        // Web - call API
        const response = await fetch('/api/adapters?platform=web');
        const data = await response.json();
        setAdapters(data.adapters || []);
      }
    } catch (err) {
      setError(`Failed to load adapters: ${err}`);
      console.error('Error loading adapters:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load current settings
   */
  const loadSettings = async () => {
    try {
      const response = await fetch('/api/adapters/settings');
      const data = await response.json();
      setSettings(data.settings || settings);

      if (data.selectedAdapter) {
        setSelectedAdapter(data.selectedAdapter);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  /**
   * Handle adapter selection
   */
  const handleAdapterSelect = async (adapter: Adapter) => {
    try {
      if (platform === 'windows' && (window as any).electron) {
        // Electron - select adapter via IPC
        const result = await (window as any).electron.selectAdapter(
          adapter.name
        );
        if (result.success) {
          setSelectedAdapter(adapter);
        } else {
          setError(result.error);
        }
      } else {
        // API call
        const response = await fetch('/api/adapters/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adapterId: adapter.id || adapter.name,
            adapterName: adapter.name,
            platform,
          }),
        });

        if (response.ok) {
          setSelectedAdapter(adapter);
          setSettings((prev) => ({
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

  /**
   * Handle monitoring mode change (Android rooted only)
   */
  const handleMonitoringModeChange = async (mode: string) => {
    if (mode !== 'default' && !isRooted) {
      setError('Root access required for ' + mode + ' mode');
      return;
    }

    try {
      const response = await fetch('/api/adapters/enable-' + mode + '-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adapterId: selectedAdapter?.id,
        }),
      });

      if (response.ok) {
        setSettings((prev) => ({
          ...prev,
          monitoringMode: mode as any,
        }));
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to enable ' + mode + ' mode');
      }
    } catch (err) {
      setError(`Error changing monitoring mode: ${err}`);
    }
  };

  /**
   * Handle settings update
   */
  const handleSettingsUpdate = async () => {
    try {
      const response = await fetch('/api/adapters/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          settings,
        }),
      });

      if (response.ok) {
        setError(null);
        alert('Settings saved successfully');
      } else {
        setError('Failed to save settings');
      }
    } catch (err) {
      setError(`Error saving settings: ${err}`);
    }
  };

  /**
   * Refresh adapters list
   */
  const handleRefresh = () => {
    loadAdapters();
  };

  if (loading) {
    return <div className="p-6 text-center">Loading adapters...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">WiFi Adapter Settings</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Platform Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Device Information</h2>
        <div className="space-y-1 text-sm">
          <div>
            <strong>Platform:</strong> {platform.toUpperCase()}
          </div>
          {platform === 'android' && (
            <div>
              <strong>Root Access:</strong>{' '}
              <span className={isRooted ? 'text-green-600' : 'text-red-600'}>
                {isRooted ? '✓ Enabled' : '✗ Not Available'}
              </span>
            </div>
          )}
          <div>
            <strong>Available Adapters:</strong> {adapters.length}
          </div>
        </div>
      </div>

      {/* Current Adapter */}
      {selectedAdapter && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Active Adapter</h2>
          <div className="space-y-2">
            <div>
              <strong>{selectedAdapter.name}</strong>
              <span className="ml-2 text-sm text-gray-600">
                [{selectedAdapter.type}]
              </span>
            </div>
            {selectedAdapter.vendor && (
              <div>
                <strong>Vendor:</strong> {selectedAdapter.vendor}
              </div>
            )}
            {selectedAdapter.model && (
              <div>
                <strong>Model:</strong> {selectedAdapter.model}
              </div>
            )}
            {selectedAdapter.signalStrength !== undefined && (
              <div>
                <strong>Signal:</strong> {selectedAdapter.signalStrength}%
              </div>
            )}
          </div>
        </div>
      )}

      {/* Adapter Selection */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Available Adapters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {adapters.map((adapter) => (
            <div
              key={adapter.id || adapter.name}
              className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                selectedAdapter?.name === adapter.name
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => handleAdapterSelect(adapter)}
            >
              <div className="font-semibold">{adapter.name}</div>
              <div className="text-sm text-gray-600">{adapter.type}</div>
              {adapter.vendor && (
                <div className="text-xs text-gray-500">{adapter.vendor}</div>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Refresh Adapters
        </button>
      </div>

      {/* Monitoring Mode (Android Only) */}
      {platform === 'android' && !isRooted && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-800 mb-2">
            ⚠️ Root Access Required
          </h3>
          <p className="text-sm text-yellow-700">
            Rooting your device enables advanced monitoring modes:
            <ul className="list-disc list-inside mt-2">
              <li>Monitor mode - Sniff all WiFi packets</li>
              <li>Promiscuous mode - Capture unencrypted data</li>
            </ul>
          </p>
        </div>
      )}

      {platform === 'android' && isRooted && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Monitoring Mode</h2>
          <div className="space-y-3">
            {(['default', 'monitor', 'promiscuous'] as const).map((mode) => (
              <label key={mode} className="flex items-center p-3 border rounded-lg hover:bg-gray-50">
                <input
                  type="radio"
                  name="monitoringMode"
                  value={mode}
                  checked={settings.monitoringMode === mode}
                  onChange={() => handleMonitoringModeChange(mode)}
                  className="mr-3"
                />
                <span className="font-medium capitalize">{mode}</span>
                {mode === 'default' && (
                  <span className="ml-2 text-xs text-gray-600">(Standard WiFi)</span>
                )}
                {mode === 'monitor' && (
                  <span className="ml-2 text-xs text-gray-600">(Sniff all packets)</span>
                )}
                {mode === 'promiscuous' && (
                  <span className="ml-2 text-xs text-gray-600">(Requires root)</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="mb-6 bg-gray-50 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Settings</h2>
        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.autoDetectAdapters}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  autoDetectAdapters: e.target.checked,
                }))
              }
              className="mr-3"
            />
            <span>Auto-detect external adapters</span>
          </label>

          {platform === 'windows' && (
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.useExternalAdapter}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    useExternalAdapter: e.target.checked,
                  }))
                }
                className="mr-3"
              />
              <span>Use external USB adapter if available</span>
            </label>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSettingsUpdate}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
        >
          Save Settings
        </button>
        <button
          onClick={handleRefresh}
          className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};

export default WiFiAdapterSettings;
