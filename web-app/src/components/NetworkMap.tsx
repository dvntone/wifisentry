'use client';

/**
 * NetworkMap — interactive map of scanned WiFi networks and detected threats.
 *
 * Defaults to free OpenStreetMap tiles (Leaflet) — zero API key required.
 * When a Google Maps API key is configured (via Settings → Map), the component
 * switches to Google Maps tile layers automatically with no code changes needed.
 *
 * Provider upgrade path:
 *   leaflet-osm  → works today, free, no key
 *   google       → set MAP_PROVIDER=google + MAP_API_KEY in .env / desktop Settings
 *   mapbox       → set MAP_PROVIDER=mapbox + MAP_API_KEY
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Network {
  ssid: string;
  bssid: string;
  security?: string;
  signal?: number;
  frequency?: number;
  channel?: number;
  latitude?: number;
  longitude?: number;
  threats?: Array<{ type: string; severity: string; description: string }>;
  isFlagged?: boolean;
  detectedAt?: string;
}

interface MapConfig {
  provider: string;
  apiKey: string;
  tileUrl: string;
  defaultCenter: { lat: number; lng: number };
  defaultZoom: number;
}

interface NetworkMapProps {
  networks?: Network[];
  /** If true, attempts to load map config from window.electron (desktop app). */
  useDesktopConfig?: boolean;
  className?: string;
}

// ── Severity colour helpers ───────────────────────────────────────────────────

const SEVERITY_COLOURS: Record<string, string> = {
  Critical: '#dc2626',
  High:     '#ea580c',
  Medium:   '#ca8a04',
  Low:      '#16a34a',
};

function markerColour(network: Network): string {
  if (!network.isFlagged || !network.threats?.length) return '#3b82f6';
  const order = ['Critical', 'High', 'Medium', 'Low'];
  for (const sev of order) {
    if (network.threats.some(t => t.severity === sev)) return SEVERITY_COLOURS[sev];
  }
  return '#3b82f6';
}

// ── Default OSM config (no API key required) ──────────────────────────────────

const DEFAULT_CONFIG: MapConfig = {
  provider:      'leaflet-osm',
  apiKey:        '',
  tileUrl:       'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  defaultCenter: { lat: 37.7749, lng: -122.4194 },
  defaultZoom:   13,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function NetworkMap({ networks = [], useDesktopConfig = false, className = '' }: NetworkMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<unknown>(null);    // L.Map instance
  const markersRef      = useRef<unknown[]>([]);    // L.CircleMarker[]
  const tileLayerRef    = useRef<unknown>(null);    // L.TileLayer

  const [mapConfig, setMapConfig] = useState<MapConfig>(DEFAULT_CONFIG);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load map config (desktop IPC or env defaults) ────────────────────────────

  useEffect(() => {
    async function loadConfig() {
      if (useDesktopConfig && typeof window !== 'undefined' && (window as any).electron?.getMapConfig) {
        try {
          const cfg = await (window as any).electron.getMapConfig();
          if (cfg) setMapConfig(cfg);
        } catch { /* fallback to default */ }
      }
    }
    loadConfig();
  }, [useDesktopConfig]);

  // ── Dynamically load Leaflet (local package — no CDN dependency) ────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Inject Leaflet CSS once (loaded from node_modules via Next.js public copy)
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id   = 'leaflet-css';
      link.rel  = 'stylesheet';
      link.href = '/leaflet/leaflet.css';  // served from public/leaflet/ (see next.config)
      document.head.appendChild(link);
    }

    import('leaflet').then((L) => {
      // Fix Leaflet default icon path broken by webpack/next bundler
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/images/marker-icon-2x.png',
        iconUrl:       '/leaflet/images/marker-icon.png',
        shadowUrl:     '/leaflet/images/marker-shadow.png',
      });
      (window as any)._L = L;
      setLeafletLoaded(true);
    }).catch(err => setError(`Failed to load map: ${err.message}`));
  }, []);

  // ── Initialise map once Leaflet is ready ─────────────────────────────────────

  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapRef.current) return;
    const L = (window as any)._L;
    if (!L) return;

    try {
      const map = L.map(mapContainerRef.current).setView(
        [mapConfig.defaultCenter.lat, mapConfig.defaultCenter.lng],
        mapConfig.defaultZoom,
      );

      const tileLayer = L.tileLayer(mapConfig.tileUrl, {
        attribution: mapConfig.provider === 'leaflet-osm'
          ? '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          : `© ${mapConfig.provider.charAt(0).toUpperCase() + mapConfig.provider.slice(1)}`,
        maxZoom: 19,
        subdomains: mapConfig.provider === 'google' || mapConfig.provider === 'google-sat'
          ? ['0', '1', '2', '3']
          : ['a', 'b', 'c'],
      }).addTo(map);

      mapRef.current    = map;
      tileLayerRef.current = tileLayer;
    } catch (err: any) {
      setError(`Map init failed: ${err.message}`);
    }

    return () => {
      if (mapRef.current) {
        (mapRef.current as any).remove();
        mapRef.current = null;
        markersRef.current = [];
        tileLayerRef.current = null;
      }
    };
  }, [leafletLoaded, mapConfig]);

  // ── Swap tile layer when provider/key changes ────────────────────────────────

  useEffect(() => {
    const L = (window as any)?._L;
    if (!mapRef.current || !L || !tileLayerRef.current) return;
    (tileLayerRef.current as any).setUrl(mapConfig.tileUrl);
  }, [mapConfig.tileUrl]);

  // ── Plot network markers ─────────────────────────────────────────────────────

  const plotMarkers = useCallback(() => {
    const L = (window as any)?._L;
    if (!mapRef.current || !L) return;

    // Remove existing markers
    markersRef.current.forEach(m => (m as any).remove());
    markersRef.current = [];

    const georeferenced = networks.filter(n => n.latitude && n.longitude);

    georeferenced.forEach(net => {
      const colour = markerColour(net);
      const marker = L.circleMarker([net.latitude!, net.longitude!], {
        radius:      net.isFlagged ? 10 : 7,
        fillColor:   colour,
        color:       colour,
        weight:      net.isFlagged ? 2 : 1,
        opacity:     1,
        fillOpacity: 0.7,
      });

      const threatList = net.threats?.length
        ? `<ul style="margin:4px 0;padding-left:16px">${net.threats.map(t =>
            `<li><span style="color:${SEVERITY_COLOURS[t.severity] || '#666'}">${t.severity}</span>: ${t.type}</li>`
          ).join('')}</ul>`
        : '<p style="color:#16a34a;margin:4px 0">No threats detected</p>';

      marker.bindPopup(`
        <div style="min-width:200px;font-family:system-ui,sans-serif">
          <strong style="font-size:14px">${net.ssid || '(Hidden SSID)'}</strong>
          <p style="color:#666;font-size:11px;margin:2px 0">${net.bssid}</p>
          <hr style="border:0;border-top:1px solid #e5e7eb;margin:6px 0"/>
          <p style="margin:2px 0"><b>Security:</b> ${net.security || 'Unknown'}</p>
          <p style="margin:2px 0"><b>Signal:</b> ${net.signal ?? '?'} dBm</p>
          <p style="margin:2px 0"><b>Channel:</b> ${net.channel ?? '?'} (${net.frequency ?? '?'} MHz)</p>
          <p style="margin:4px 0"><b>Threats:</b></p>
          ${threatList}
        </div>
      `);

      marker.addTo(mapRef.current as any);
      markersRef.current.push(marker);
    });

    // Auto-fit bounds if we have points
    if (georeferenced.length > 1) {
      const bounds = L.latLngBounds(georeferenced.map(n => [n.latitude!, n.longitude!]));
      (mapRef.current as any).fitBounds(bounds, { padding: [30, 30] });
    } else if (georeferenced.length === 1) {
      (mapRef.current as any).setView([georeferenced[0].latitude!, georeferenced[0].longitude!], 15);
    }
  }, [networks]);

  useEffect(() => { plotMarkers(); }, [plotMarkers]);

  // ── Legend ───────────────────────────────────────────────────────────────────

  const flaggedCount = networks.filter(n => n.isFlagged).length;
  const geoCount     = networks.filter(n => n.latitude && n.longitude).length;

  return (
    <div className={`relative flex flex-col ${className}`} style={{ minHeight: 400 }}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗺️</span>
          <span className="font-semibold text-white">Network Map</span>
          <span className="text-xs text-gray-400 ml-1">
            {geoCount}/{networks.length} located · {flaggedCount} flagged
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {Object.entries(SEVERITY_COLOURS).map(([sev, col]) => (
            <span key={sev} className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col }} />
              {sev}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
            Clean
          </span>
        </div>
      </div>

      {/* Map container */}
      {error ? (
        <div className="flex-1 flex items-center justify-center bg-gray-800 text-red-400 p-8 text-center">
          <div>
            <div className="text-4xl mb-3">🗺️</div>
            <p className="font-medium">{error}</p>
            <p className="text-sm text-gray-500 mt-1">Map requires an internet connection to load tiles.</p>
          </div>
        </div>
      ) : (
        <div ref={mapContainerRef} className="flex-1" style={{ minHeight: 360, zIndex: 0 }}>
          {!leafletLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-gray-400 z-10">
              <div className="text-center">
                <div className="animate-spin text-3xl mb-2">🌐</div>
                <p>Loading map…</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No location data notice */}
      {networks.length > 0 && geoCount === 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-gray-900/90 text-gray-300 text-xs px-4 py-2 rounded-full shadow border border-gray-700">
          Enable location tracking to plot networks on the map
        </div>
      )}

      {/* Provider badge */}
      <div className="absolute bottom-2 right-2 bg-gray-900/80 text-gray-500 text-xs px-2 py-0.5 rounded z-10">
        {mapConfig.provider === 'leaflet-osm' ? 'OpenStreetMap' : mapConfig.provider}
        {mapConfig.provider !== 'leaflet-osm' && mapConfig.apiKey && ' ✓'}
      </div>
    </div>
  );
}
