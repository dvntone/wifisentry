'use client';

/**
 * PortSettings
 *
 * UI for managing the backend server port:
 *  - Shows the current port
 *  - Scans and suggests an available port if the current one is blocked
 *  - Lets the user type a custom port number
 *  - Checks Windows Defender Firewall rule status
 *  - Offers a one-click "Add Firewall Rule" that triggers a UAC prompt,
 *    or shows manual instructions if elevation is unavailable
 *
 * Only fully functional inside the Electron desktop app (window.electron exists).
 * In the PWA it shows a read-only informational view.
 */

import React, { useState, useEffect, useCallback } from 'react';

interface FirewallResult {
  success?: boolean;
  exists?: boolean;
  ruleFound?: boolean;
  message?: string;
  requiresManual?: boolean;
  instructions?: string[];
  command?: string;
  error?: string;
  platform?: string;
}

interface PortCheckResult {
  port: number;
  available: boolean;
}

const isElectron = typeof window !== 'undefined' && !!(window as any).electron;
const el = isElectron ? (window as any).electron : null;

const PortSettings: React.FC = () => {
  const [currentPort, setCurrentPort] = useState<number | null>(null);
  const [inputPort, setInputPort] = useState('');
  const [checking, setChecking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [portStatus, setPortStatus] = useState<PortCheckResult | null>(null);
  const [firewallStatus, setFirewallStatus] = useState<FirewallResult | null>(null);
  const [firewallLoading, setFirewallLoading] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [manualInstructions, setManualInstructions] = useState<string[] | null>(null);

  // ── Load current port ───────────────────────────────────────────────────────

  const loadCurrentPort = useCallback(async () => {
    if (!el) return;
    try {
      const result = await el.portGetCurrent();
      setCurrentPort(result.port);
      setInputPort(String(result.port));
    } catch { /* not in Electron */ }
  }, []);

  const loadFirewallStatus = useCallback(async () => {
    if (!el) return;
    try {
      setFirewallLoading(true);
      const result = await el.firewallCheck();
      setFirewallStatus(result);
    } catch { /* ignore */ } finally {
      setFirewallLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentPort();
    loadFirewallStatus();
  }, [loadCurrentPort, loadFirewallStatus]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleCheckPort = async () => {
    const p = parseInt(inputPort, 10);
    if (isNaN(p)) return;
    setChecking(true);
    setPortStatus(null);
    try {
      const result = await el.portCheck(p);
      setPortStatus(result);
    } finally {
      setChecking(false);
    }
  };

  const handleFindAvailable = async () => {
    setScanning(true);
    setPortStatus(null);
    setSaveResult(null);
    try {
      const result = await el.portFindAvailable(parseInt(inputPort, 10) || currentPort);
      if (result.success) {
        setInputPort(String(result.port));
        setPortStatus({ port: result.port, available: true });
      }
    } finally {
      setScanning(false);
    }
  };

  const handleSavePort = async () => {
    const p = parseInt(inputPort, 10);
    if (isNaN(p)) return;
    setSaving(true);
    setSaveResult(null);
    setManualInstructions(null);
    try {
      const result = await el.portSet(p);
      if (result.success) {
        setCurrentPort(p);
        setSaveResult({ success: true, message: `Port set to ${p}. Restart the app to apply.` });
        await loadFirewallStatus();
      } else if (result.inUse) {
        setSaveResult({
          success: false,
          message: `Port ${p} is in use.${result.suggested ? ` Try port ${result.suggested}.` : ''}`,
        });
        if (result.suggested) setInputPort(String(result.suggested));
      } else {
        setSaveResult({ success: false, message: result.error || 'Failed to set port.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddFirewallRule = async () => {
    setFirewallLoading(true);
    setManualInstructions(null);
    try {
      const result = await el.firewallAddRule(currentPort ?? undefined);
      if (result.success) {
        await loadFirewallStatus();
      } else if (result.requiresManual && result.instructions) {
        setManualInstructions(result.instructions);
      } else {
        setFirewallStatus(result);
      }
    } finally {
      setFirewallLoading(false);
    }
  };

  const handleRemoveFirewallRule = async () => {
    setFirewallLoading(true);
    try {
      await el.firewallRemoveRule();
      await loadFirewallStatus();
    } finally {
      setFirewallLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!isElectron) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-lg font-bold mb-2">Backend Port</h2>
        <p className="text-sm text-slate-400">
          Port settings are managed by the Desktop app.
          This PWA connects to the backend at <code className="text-blue-400">http://localhost:3000</code>.
        </p>
      </div>
    );
  }

  const portChanged = currentPort !== null && parseInt(inputPort, 10) !== currentPort;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-700/30">
        <h2 className="text-lg font-bold">Backend Port</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Current port: <span className="font-mono text-blue-400">{currentPort ?? '…'}</span>
          {' · '}
          <span className="text-slate-500">http://localhost:{currentPort ?? '…'}</span>
        </p>
      </div>

      <div className="p-6 space-y-5">

        {/* Port input row */}
        <div>
          <label className="block text-sm font-semibold mb-2">Port Number</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1024}
              max={65535}
              value={inputPort}
              onChange={e => { setInputPort(e.target.value); setPortStatus(null); setSaveResult(null); }}
              className="w-32 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm
                         font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="3000"
            />
            <button
              onClick={handleCheckPort}
              disabled={checking || !inputPort}
              className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50
                         rounded transition"
            >
              {checking ? 'Checking…' : 'Check'}
            </button>
            <button
              onClick={handleFindAvailable}
              disabled={scanning}
              className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50
                         rounded transition"
            >
              {scanning ? 'Scanning…' : 'Find free port'}
            </button>
            <button
              onClick={handleSavePort}
              disabled={saving || !portChanged}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                         rounded font-semibold transition ml-auto"
            >
              {saving ? 'Saving…' : 'Apply'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">Range 1024 – 65535. Restart required after changing.</p>
        </div>

        {/* Port check result */}
        {portStatus && (
          <div className={`text-sm px-3 py-2 rounded ${
            portStatus.available
              ? 'bg-green-900/30 border border-green-700 text-green-300'
              : 'bg-red-900/30 border border-red-700 text-red-300'
          }`}>
            Port {portStatus.port} is {portStatus.available ? '✓ available' : '✗ in use'}
          </div>
        )}

        {/* Save result */}
        {saveResult && (
          <div className={`text-sm px-3 py-2 rounded ${
            saveResult.success
              ? 'bg-green-900/30 border border-green-700 text-green-300'
              : 'bg-red-900/30 border border-red-700 text-red-300'
          }`}>
            {saveResult.success ? '✓ ' : '✗ '}{saveResult.message}
          </div>
        )}

        {/* Windows Firewall section */}
        <div className="border-t border-slate-700 pt-5">
          <h3 className="text-sm font-semibold mb-3">Windows Defender Firewall</h3>

          {firewallLoading ? (
            <p className="text-sm text-slate-400">Checking firewall…</p>
          ) : firewallStatus?.platform && firewallStatus.platform !== 'win32' ? (
            <p className="text-sm text-slate-400">Firewall management is Windows-only.</p>
          ) : (
            <>
              <div className={`flex items-center gap-3 text-sm px-3 py-2 rounded mb-3 ${
                firewallStatus?.exists
                  ? 'bg-green-900/30 border border-green-700 text-green-300'
                  : 'bg-amber-900/30 border border-amber-700 text-amber-300'
              }`}>
                <span>{firewallStatus?.exists ? '✓' : '⚠️'}</span>
                <span>
                  {firewallStatus?.exists
                    ? `Inbound rule exists for port ${currentPort}`
                    : `No inbound rule found for port ${currentPort} — the app may be blocked`}
                </span>
              </div>

              <div className="flex gap-2">
                {!firewallStatus?.exists && (
                  <button
                    onClick={handleAddFirewallRule}
                    disabled={firewallLoading}
                    className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700
                               disabled:opacity-50 rounded font-semibold transition"
                  >
                    Allow in Windows Defender
                  </button>
                )}
                {firewallStatus?.ruleFound && (
                  <button
                    onClick={handleRemoveFirewallRule}
                    disabled={firewallLoading}
                    className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600
                               disabled:opacity-50 rounded transition"
                  >
                    Remove rule
                  </button>
                )}
                <button
                  onClick={loadFirewallStatus}
                  disabled={firewallLoading}
                  className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600
                             disabled:opacity-50 rounded transition"
                >
                  Refresh
                </button>
              </div>
            </>
          )}

          {/* Manual firewall instructions (UAC declined) */}
          {manualInstructions && (
            <div className="mt-3 bg-slate-900 rounded-lg p-4 border border-slate-600">
              <p className="text-sm font-semibold text-amber-300 mb-2">
                Administrator access required — run this command manually:
              </p>
              <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap overflow-x-auto">
                {manualInstructions.join('\n')}
              </pre>
              <button
                onClick={() => setManualInstructions(null)}
                className="mt-2 text-xs text-slate-500 hover:text-slate-300"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PortSettings;
