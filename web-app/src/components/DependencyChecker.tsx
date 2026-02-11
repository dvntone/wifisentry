'use client';

import React, { useEffect, useState } from 'react';

interface Dependency {
  name: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  installed: boolean;
  installationInstructions?: {
    platform: string;
    commands: Array<{
      type: string;
      command: string;
      description: string;
    }>;
    notes: string[];
  };
}

interface DependencyReport {
  platform: string;
  os: string;
  arch: string;
  timestamp: string;
  stats: {
    total: number;
    installed: number;
    missing: number;
  };
  dependencies: Record<string, Dependency>;
}

interface DependencyCheckerProps {
  apiBase?: string;
  onComplete?: (report: DependencyReport) => void;
}

const DependencyChecker: React.FC<DependencyCheckerProps> = ({ 
  apiBase = 'http://localhost:3000/api',
  onComplete 
}) => {
  const [report, setReport] = useState<DependencyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<Record<string, any>>({});
  const [showDetails, setShowDetails] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  useEffect(() => {
    checkDependencies();
  }, []);

  const checkDependencies = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/dependencies/check`);
      const data = await response.json();
      setReport(data);
      if (onComplete) {
        onComplete(data);
      }
    } catch (error) {
      console.error('Failed to check dependencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const installDependency = async (toolId: string) => {
    try {
      setInstalling(toolId);
      const response = await fetch(`${apiBase}/dependencies/${toolId}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useWSL: report?.platform === 'win32' })
      });
      const result = await response.json();
      setInstallStatus(prev => ({ ...prev, [toolId]: result }));
      
      // Re-check dependencies after install
      setTimeout(() => {
        checkDependencies();
      }, 2000);
    } catch (error) {
      setInstallStatus(prev => ({ 
        ...prev, 
        [toolId]: { 
          success: false, 
          error: 'Installation failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      }));
    } finally {
      setInstalling(null);
    }
  };

  const toggleExpanded = (toolId: string) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(toolId)) {
      newExpanded.delete(toolId);
    } else {
      newExpanded.add(toolId);
    }
    setExpandedTools(newExpanded);
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <span>Checking system dependencies...</span>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-red-700 text-red-200">
        <p>Failed to check dependencies</p>
      </div>
    );
  }

  const criticalMissing = Object.entries(report.dependencies).filter(
    ([, dep]) => dep.priority === 'critical' && !dep.installed
  );

  const hasMissing = report.stats.missing > 0;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className={`p-6 border-b border-slate-700 ${
        criticalMissing.length > 0 ? 'bg-red-900/20' : 'bg-slate-700/30'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              {criticalMissing.length > 0 ? (
                <>
                  <span className="text-red-500">⚠️</span>
                  Critical Dependencies Missing
                </>
              ) : (
                <>
                  <span className="text-green-500">✓</span>
                  System Dependencies
                </>
              )}
            </h3>
            <p className="text-sm text-slate-300">
              {report.stats.installed}/{report.stats.total} dependencies installed
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {report.os} • {report.arch} • {report.platform}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
              <div className="text-center">
                <div className="text-xl font-bold text-green-400">
                  {Math.round((report.stats.installed / report.stats.total) * 100)}%
                </div>
                <div className="text-xs text-slate-400">Complete</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Missing Warning */}
      {criticalMissing.length > 0 && (
        <div className="bg-red-900/30 border-b border-red-700 p-6">
          <h4 className="font-semibold text-red-200 mb-3">Critical Tools Missing:</h4>
          <p className="text-sm text-red-100 mb-4">
            These tools are required for WiFi Sentry to work properly:
          </p>
          <div className="space-y-2">
            {criticalMissing.map(([toolId, dep]) => (
              <div key={toolId} className="bg-slate-800 rounded p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{dep.name}</p>
                  <p className="text-sm text-slate-300">{dep.description}</p>
                </div>
                <button
                  onClick={() => installDependency(toolId)}
                  disabled={installing === toolId}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-4 py-2 rounded font-semibold transition whitespace-nowrap ml-4"
                >
                  {installing === toolId ? '⏳ Installing...' : '📥 Install'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Installation Status Messages */}
      {Object.entries(installStatus).map(([toolId, status]) => (
        <div key={toolId} className={`p-4 border-b border-slate-700 ${
          status.success ? 'bg-green-900/20 text-green-200' : 'bg-red-900/20 text-red-200'
        }`}>
          <p className="text-sm">
            {status.success ? '✓' : '✗'} {status.message || status.error}
          </p>
          {status.hint && <p className="text-xs mt-1 opacity-75">{status.hint}</p>}
        </div>
      ))}

      {/* Summary Stats */}
      <div className="p-6 border-b border-slate-700 bg-slate-700/20">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-bold text-blue-400">{report.stats.total}</div>
            <div className="text-xs text-slate-400">Total Dependencies</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">{report.stats.installed}</div>
            <div className="text-xs text-slate-400">Installed</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${report.stats.missing > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {report.stats.missing}
            </div>
            <div className="text-xs text-slate-400">Missing</div>
          </div>
        </div>
      </div>

      {/* Detailed List */}
      <div className="p-6">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full text-left py-2 font-semibold flex items-center justify-between hover:text-blue-400 transition"
        >
          <span>View All Dependencies {showDetails ? '▼' : '▶'}</span>
          <span className="text-sm">({hasMissing ? `${report.stats.missing} missing` : 'all good'})</span>
        </button>

        {showDetails && (
          <div className="mt-4 space-y-2">
            {Object.entries(report.dependencies).map(([toolId, dep]) => (
              <div key={toolId} className="border border-slate-700 rounded bg-slate-700/30">
                {/* Tool Header */}
                <button
                  onClick={() => toggleExpanded(toolId)}
                  className="w-full p-3 flex items-center justify-between hover:bg-slate-700/50 transition"
                >
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <span className="text-xl">
                      {dep.installed ? '✓' : '○'}
                    </span>
                    <div>
                      <p className="font-semibold">{dep.name}</p>
                      <p className="text-xs text-slate-400">{dep.description}</p>
                    </div>
                    <span className={`ml-auto px-2 py-1 rounded text-xs font-semibold ${
                      dep.priority === 'critical' ? 'bg-red-600/30 text-red-300' :
                      dep.priority === 'high' ? 'bg-orange-600/30 text-orange-300' :
                      dep.priority === 'medium' ? 'bg-yellow-600/30 text-yellow-300' :
                      'bg-blue-600/30 text-blue-300'
                    }`}>
                      {dep.priority}
                    </span>
                  </div>
                  <span className="ml-2">{expandedTools.has(toolId) ? '▼' : '▶'}</span>
                </button>

                {/* Tool Details */}
                {expandedTools.has(toolId) && !dep.installed && dep.installationInstructions && (
                  <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                    <div className="mb-4">
                      <h5 className="font-semibold text-sm mb-2">Installation Instructions:</h5>
                      <div className="space-y-2">
                        {dep.installationInstructions.commands.map((cmd, idx) => (
                          <div key={idx} className="bg-slate-900 rounded p-3">
                            <p className="text-xs font-semibold text-slate-300 mb-1">
                              {cmd.description}
                            </p>
                            <code className="text-xs bg-slate-950 p-2 block rounded font-mono overflow-x-auto">
                              {cmd.command}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>

                    {dep.installationInstructions.notes.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-slate-300 mb-2">Notes:</p>
                        <ul className="text-xs text-slate-400 space-y-1">
                          {dep.installationInstructions.notes.map((note, idx) => (
                            <li key={idx} className="list-disc list-inside">{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={() => installDependency(toolId)}
                      disabled={installing === toolId}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-4 py-2 rounded font-semibold transition"
                    >
                      {installing === toolId ? '⏳ Installing...' : '📥 Install Now'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-6 bg-slate-700/20 border-t border-slate-700 flex gap-3 justify-end">
        <button
          onClick={checkDependencies}
          disabled={loading}
          className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 px-4 py-2 rounded font-semibold transition"
        >
          🔄 Re-check
        </button>
        {hasMissing && (
          <button
            onClick={() => setShowDetails(true)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold transition"
          >
            📥 Install Missing
          </button>
        )}
      </div>
    </div>
  );
};

export default DependencyChecker;
