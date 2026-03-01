'use client';

import React, { useEffect, useState } from 'react';

interface AiAnalysis {
  risk: string;
  details?: string;
}

interface Network {
  ssid: string;
  bssid: string;
  security: string;
  signal: number;
  frequency: number;
  channel: number;
  aiAnalysis?: AiAnalysis;
}

interface ScanResult {
  timestamp: string;
  networkCount: number;
  networks: Network[];
}

interface LiveScanResultsProps {
  techniques: string[];
}

const LiveScanResults: React.FC<LiveScanResultsProps> = ({ techniques }) => {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  useEffect(() => {
    let eventSource: EventSource | null = null;

    if (isMonitoring) {
      // Connect to the backend SSE stream
      // Assuming backend runs on port 3000. Adjust URL if needed.
      eventSource = new EventSource(`${API_URL}/api/monitoring-stream`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'scan-result') {
            setScanResult(data);
          } else if (data.type === 'error') {
            setError(data.message);
          }
        } catch (e) {
          console.error('Error parsing SSE data', e);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE Error', err);
        setError('Connection to monitoring stream lost.');
        eventSource?.close();
        setIsMonitoring(false);
      };
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [isMonitoring]);

  const startMonitoring = async () => {
    try {
      if (techniques.length === 0) {
        setError('Please select at least one detection technique from the sidebar.');
        return;
      }
      setError(null);
      const response = await fetch(`${API_URL}/api/start-monitoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ techniques }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to start monitoring');
      setIsMonitoring(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const stopMonitoring = async () => {
    try {
      await fetch(`${API_URL}/api/stop-monitoring`, { method: 'POST' });
      setIsMonitoring(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Live AI Scan Analysis</h2>
          <p className="text-sm text-gray-500">Real-time WiFi threat detection powered by Gemini</p>
        </div>
        <div className="space-x-3">
          {!isMonitoring ? (
            <button
              onClick={startMonitoring}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Start Live Scan
            </button>
          ) : (
            <button
              onClick={stopMonitoring}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center"
            >
              <span className="animate-pulse mr-2 h-2 w-2 bg-white rounded-full"></span>
              Stop Scan
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
          <strong>Error:</strong> {error}
        </div>
      )}

      {scanResult ? (
        <div>
          <div className="flex justify-between items-center mb-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
            <span>Last updated: <strong>{scanResult.timestamp}</strong></span>
            <span>Networks found: <strong>{scanResult.networkCount}</strong></span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SSID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BSSID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Signal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Security</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI Risk Assessment</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scanResult.networks && scanResult.networks.map((net, idx) => (
                  <tr key={`${net.bssid}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{net.ssid || '<Hidden>'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{net.bssid}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{net.signal} dBm</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{net.security}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        net.aiAnalysis?.risk === 'High' ? 'bg-red-100 text-red-800' : 
                        net.aiAnalysis?.risk === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-green-100 text-green-800'
                      }`}>
                        {net.aiAnalysis?.risk || 'Low'}
                      </span>
                      {net.aiAnalysis?.details && (
                        <p className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={net.aiAnalysis.details}>{net.aiAnalysis.details}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No scan data</h3>
          <p className="mt-1 text-sm text-gray-500">Start monitoring to see live WiFi traffic and AI analysis.</p>
        </div>
      )}
    </div>
  );
};

export default LiveScanResults;