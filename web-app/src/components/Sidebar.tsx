'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Dashboard', icon: '🛡️' },
    { href: '/history', label: 'Scan History', icon: '📡' },
    { href: '/about', label: 'About', icon: 'ℹ️' },
    { href: '/faq', label: 'FAQ & Help', icon: '❓' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="w-64 bg-slate-900 border-r border-cyan-900/50 flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-cyan-900/50">
        <h1 className="text-2xl font-bold text-cyan-400 tracking-wider flex items-center gap-2">
          <span className="text-3xl">📡</span> SENTRY
        </h1>
        <p className="text-xs text-slate-400 mt-1 font-mono">v1.2.7 // ACTIVE</p>
      </div>
      
      <nav className="flex-1 py-6">
        <ul className="space-y-2 px-4">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <li key={link.href}>
                <Link 
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 font-mono text-sm ${
                    isActive 
                      ? 'bg-cyan-900/30 text-cyan-300 border border-cyan-700/50 shadow-[0_0_10px_rgba(6,182,212,0.15)]' 
                      : 'text-slate-400 hover:text-cyan-100 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-lg">{link.icon}</span>
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-cyan-900/50">
        <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
          <p className="text-xs text-slate-400 font-mono mb-2">SYSTEM STATUS</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
            <span className="text-sm font-semibold text-emerald-400">ONLINE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
