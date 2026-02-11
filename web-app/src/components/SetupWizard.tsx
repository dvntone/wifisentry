'use client';

import React, { useEffect, useState } from 'react';

interface SetupGuide {
  environment: any;
  helper: any;
  guides: Record<string, any>;
}

interface SetupWizardProps {
  apiBase?: string;
  onSetupComplete?: () => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ 
  apiBase = 'http://localhost:3000/api',
  onSetupComplete 
}) => {
  const [step, setStep] = useState<'environment' | 'tools' | 'guide' | 'complete'>('environment');
  const [guide, setGuide] = useState<SetupGuide | null>(null);
  const [criticalTools, setCriticalTools] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [installScript, setInstallScript] = useState<any>(null);

  useEffect(() => {
    fetchEnvironmentInfo();
  }, []);

  const fetchEnvironmentInfo = async () => {
    try {
      setLoading(true);
      const [envRes, criticalRes] = await Promise.all([
        fetch(`${apiBase}/setup/environment`),
        fetch(`${apiBase}/setup/check-critical`)
      ]);

      const envData = await envRes.json();
      const criticalData = await criticalRes.json();

      setGuide(envData);
      setCriticalTools(criticalData);

      // If all critical tools present, show complete
      if (criticalData.allPresent) {
        setStep('complete');
      } else {
        setStep('tools');
      }
    } catch (error) {
      console.error('Failed to fetch environment info:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateScript = async () => {
    try {
      const response = await fetch(`${apiBase}/setup/install-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolIds: Array.from(selectedTools),
          update: true
        })
      });

      const script = await response.json();
      setInstallScript(script);
      setStep('guide');
    } catch (error) {
      console.error('Failed to generate script:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <span>Detecting environment...</span>
        </div>
      </div>
    );
  }

  if (!guide || !criticalTools) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-red-700 text-red-200">
        <p>Failed to detect environment</p>
      </div>
    );
  }

  // Step 1: Environment Detection
  if (step === 'environment') {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="p-6 bg-blue-900/20 border-b border-slate-700">
          <h3 className="text-lg font-bold mb-2">Environment Detection</h3>
          <p className="text-sm text-slate-300">WiFi Sentry has detected your system</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-700/30 rounded p-4">
              <p className="text-xs text-slate-400">OS</p>
              <p className="font-semibold">{guide.environment.os}</p>
            </div>
            <div className="bg-slate-700/30 rounded p-4">
              <p className="text-xs text-slate-400">Architecture</p>
              <p className="font-semibold">{guide.environment.arch}</p>
            </div>
            <div className="bg-slate-700/30 rounded p-4">
              <p className="text-xs text-slate-400">Platform</p>
              <p className="font-semibold capitalize">{guide.environment.environment}</p>
            </div>
            <div className="bg-slate-700/30 rounded p-4">
              <p className="text-xs text-slate-400">Environment</p>
              <p className="font-semibold">
                {guide.environment.isTermux ? '📱 Termux' :
                 guide.environment.isWSL2 ? '🐧 WSL2' :
                 guide.environment.isMac ? '🍎 macOS' :
                 guide.environment.isWindows ? '🪟 Windows' :
                 '🐧 Linux'}
              </p>
            </div>
          </div>

          <div className="bg-blue-900/20 rounded p-4">
            <h4 className="font-semibold mb-2">Recommended Setup Path:</h4>
            <p className="text-sm text-slate-300">
              {guide.helper.setupSteps?.map((step: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2 my-1">
                  <span className="text-blue-400">✓</span>
                  <span>{step}</span>
                </div>
              ))}
            </p>
          </div>

          <button
            onClick={() => setStep('tools')}
            className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded font-semibold transition"
          >
            Continue to Tool Selection →
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Tool Selection
  if (step === 'tools') {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="p-6 bg-orange-900/20 border-b border-slate-700">
          <h3 className="text-lg font-bold mb-2">Missing Tools Detection</h3>
          <p className="text-sm text-slate-300">
            {criticalTools.missing.length > 0 
              ? `${criticalTools.missing.length} critical tool(s) missing`
              : 'All tools installed!'}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {criticalTools.missing.length === 0 ? (
            <div className="bg-green-900/20 rounded p-4 text-green-200">
              ✓ All critical tools are installed!
            </div>
          ) : (
            <>
              <p className="text-sm">Select tools to install:</p>
              <div className="space-y-2">
                {criticalTools.missing.map((tool: string) => (
                  <label key={tool} className="flex items-center p-3 bg-slate-700/30 rounded cursor-pointer hover:bg-slate-700/50 transition">
                    <input
                      type="checkbox"
                      checked={selectedTools.has(tool)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedTools);
                        if (e.target.checked) {
                          newSelected.add(tool);
                        } else {
                          newSelected.delete(tool);
                        }
                        setSelectedTools(newSelected);
                      }}
                      className="w-4 h-4 rounded text-blue-500"
                    />
                    <span className="ml-3 font-semibold capitalize">{tool}</span>
                  </label>
                ))}
              </div>

              <button
                onClick={generateScript}
                disabled={selectedTools.size === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-4 py-3 rounded font-semibold transition"
              >
                Generate Installation Commands →
              </button>
            </>
          )}

          {criticalTools.missing.length === 0 && (
            <button
              onClick={() => setStep('guide')}
              className="w-full bg-green-600 hover:bg-green-700 px-4 py-3 rounded font-semibold transition"
            >
              View Setup Guide →
            </button>
          )}
        </div>
      </div>
    );
  }

  // Step 3: Installation Guide
  if (step === 'guide' && installScript) {
    const platformKey = installScript.platform;
    const guideData = guide.guides[platformKey];

    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="p-6 bg-green-900/20 border-b border-slate-700">
          <h3 className="text-lg font-bold mb-2">Installation Guide for {installScript.packageManager}</h3>
          <p className="text-sm text-slate-300">Follow these steps to install missing tools</p>
        </div>

        <div className="p-6 space-y-6">
          {guideData && (
            <>
              <div>
                <h4 className="font-semibold mb-2">Requirements:</h4>
                <ul className="text-sm space-y-1">
                  {guideData.requirements?.map((req: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {installScript.setupSteps?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Setup Steps:</h4>
                  <ul className="text-sm space-y-1">
                    {installScript.setupSteps.map((step: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-400">{idx + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {installScript.commands?.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Installation Commands:</h4>
              <div className="space-y-2">
                {installScript.commands.map((cmd: any, idx: number) => (
                  <div key={idx} className="bg-slate-900 rounded p-3">
                    <p className="text-xs text-slate-400 mb-1">{cmd.description}</p>
                    <div className="flex gap-2">
                      <code className="flex-1 text-xs font-mono bg-slate-950 p-2 rounded overflow-x-auto">
                        {cmd.command}
                      </code>
                      <button
                        onClick={() => copyToClipboard(cmd.command)}
                        className="bg-blue-600 hover:bg-blue-700 px-3 rounded font-semibold transition whitespace-nowrap"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {installScript.combinedScript && (
                <div className="bg-slate-900 rounded p-3">
                  <p className="text-xs text-slate-400 mb-1">Run all commands together:</p>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs font-mono bg-slate-950 p-2 rounded overflow-x-auto break-all">
                      {installScript.combinedScript}
                    </code>
                    <button
                      onClick={() => copyToClipboard(installScript.combinedScript)}
                      className="bg-blue-600 hover:bg-blue-700 px-3 rounded font-semibold transition whitespace-nowrap"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {guideData?.steps && (
            <div>
              <h4 className="font-semibold mb-2">Installation Steps:</h4>
              <ol className="text-sm space-y-2">
                {guideData.steps.map((step: string, idx: number) => (
                  <li key={idx} className="flex gap-3">
                    <span className="font-semibold flex-shrink-0">{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('tools')}
              className="flex-1 bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded font-semibold transition"
            >
              ← Back
            </button>
            <button
              onClick={() => {
                setStep('complete');
                if (onSetupComplete) onSetupComplete();
              }}
              className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-3 rounded font-semibold transition"
            >
              Done! →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Complete
  if (step === 'complete') {
    return (
      <div className="bg-slate-800 rounded-lg border border-green-700 overflow-hidden">
        <div className="p-6 bg-green-900/20 border-b border-slate-700">
          <h3 className="text-lg font-bold mb-2">✓ Setup Complete!</h3>
          <p className="text-sm text-slate-300">WiFi Sentry is ready to use</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-green-900/20 rounded p-4 text-green-200">
            <p className="font-semibold mb-2">Next steps:</p>
            <ul className="text-sm space-y-1">
              <li>✓ All dependencies installed</li>
              <li>✓ Environment configured</li>
              <li>→ Start monitoring WiFi networks</li>
              <li>→ Enable threat detection</li>
              <li>→ Review detected threats</li>
            </ul>
          </div>

          <button
            onClick={fetchEnvironmentInfo}
            className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded font-semibold transition"
          >
            Start WiFi Scanning →
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default SetupWizard;
