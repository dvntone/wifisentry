'use client';

import React, { useState, useEffect } from 'react';

export default function UIPlayground() {
  const [htmlCode, setHtmlCode] = useState<string>(`
<div class="p-8 bg-gradient-to-br from-blue-900 to-black min-h-screen text-white">
  <div class="max-w-md mx-auto bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-blue-500/30">
    <div class="p-6">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
          WiFi Sentry
        </h1>
        <div class="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]"></div>
      </div>
      
      <div class="space-y-4">
        <div class="bg-gray-800/50 p-4 rounded-2xl border border-gray-700">
          <p class="text-gray-400 text-sm mb-1">Active Network</p>
          <p class="text-xl font-semibold">SkyNet_5G</p>
          <div class="flex items-center mt-2 text-green-400 text-sm">
            <span class="mr-2">●</span> Secure Connection
          </div>
        </div>

        <button class="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all rounded-2xl font-bold text-lg shadow-lg shadow-blue-900/20">
          Start Scan
        </button>
      </div>
    </div>
  </div>
</div>
  `);

  const [renderedContent, setRenderedContent] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('preview');

  useEffect(() => {
    setRenderedContent(htmlCode);
  }, []);

  const handleRender = () => {
    setRenderedContent(htmlCode);
    setActiveTab('preview');
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
        <h2 className="text-lg font-bold text-blue-400">UI Playground</h2>
        <div className="flex space-x-2">
          <button 
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors \${activeTab === 'editor' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
          >
            Code
          </button>
          <button 
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors \${activeTab === 'preview' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'editor' ? (
          <div className="flex-1 flex flex-col p-4 space-y-4">
            <textarea
              className="flex-1 w-full bg-gray-950 text-green-400 font-mono p-4 rounded-xl border border-gray-800 focus:border-blue-500 outline-none resize-none text-sm"
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
              spellCheck={false}
              placeholder="Enter Tailwind HTML here..."
            />
            <button 
              onClick={handleRender}
              className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-white transition-all active:scale-95 shadow-lg shadow-green-900/20"
            >
              Render Changes
            </button>
          </div>
        ) : (
          <div className="flex-1 bg-gray-100 overflow-auto">
             <div dangerouslySetInnerHTML={{ __html: renderedContent }} />
          </div>
        )}
      </div>

      {/* Footer / Quick Tips */}
      <div className="p-3 bg-gray-900 border-t border-gray-800 text-[10px] text-gray-500 flex justify-around">
        <span>Use Tailwind classes</span>
        <span>Mobile-first design</span>
        <span>Tap Render to update</span>
      </div>
    </div>
  );
}
