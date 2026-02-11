# AdapterSettings Component Documentation

## Overview

The `AdapterSettings` component is a React component that provides a comprehensive UI for WiFi adapter management across all platforms (Windows desktop, Android mobile, and web PWA).

**Location**: [`web-app/src/components/AdapterSettings.tsx`](web-app/src/components/AdapterSettings.tsx)

## Features

- **Cross-Platform Support**: Works on Windows (Electron), Android (Capacitor), and Web (PWA)
- **Real-Time Adapter Detection**: Automatically detects connected USB WiFi adapters
- **Adapter Selection**: Simple UI to switch between built-in and external adapters
- **Root Access Detection**: Identifies rooted Android devices and shows available advanced modes
- **Monitoring Mode Control**: Enable monitor mode and promiscuous mode (Android with root)
- **Settings Persistence**: Automatically saves user preferences
- **Error Handling**: User-friendly error messages and status updates
- **Responsive Design**: Works on desktop, tablet, and mobile screens

## Platform Support

### Windows (Electron Desktop)

```
✅ List available adapters (built-in + USB)
✅ Select active adapter
✅ View adapter details (signal strength, channel, frequency)
✅ Get adapter statistics (bytes, packets)
✅ Start/stop adapter monitoring
✅ Export/import adapter configuration
```

### Android (Capacitor Mobile)

```
✅ List available adapters (built-in + USB OTG)
✅ Select active adapter
✅ Detect root access
✅ Enable monitor mode (root required)
✅ Enable promiscuous mode (root required)
✅ View device capabilities
✅ Save settings per user
```

### Web (Next.js PWA)

```
✅ List available adapters (read-only)
✅ View adapter details
✅ Change adapter selection (via API)
✅ Show adapter status
⚠️ Limited advanced features (no root/monitor node)
```

## Component Props

The component doesn't require any props, but it uses the following globals:

### `window.electron` (Windows Only)

Electron IPC methods for adapter management:

```typescript
window.electron.getAvailableAdapters(): Promise<{ adapters: Adapter[] }>
window.electron.selectAdapter(name: string): Promise<{ success: boolean }>
```

### `window.Capacitor` (Android Only)

Capacitor bridge for native Android calls.

## Usage Examples

### Basic Integration

```tsx
import WiFiAdapterSettings from '@/components/AdapterSettings';

export default function Dashboard() {
  return (
    <div className="dashboard">
      <h1>WiFi Security Dashboard</h1>
      <WiFiAdapterSettings />
    </div>
  );
}
```

### With Parent State Management

```tsx
import WiFiAdapterSettings from '@/components/AdapterSettings';
import { useState } from 'react';

export default function Settings() {
  const [selectedAdapter, setSelectedAdapter] = useState(null);

  return (
    <div>
      <h2>WiFi Adapter Settings</h2>
      <WiFiAdapterSettings />
      {selectedAdapter && (
        <div className="adapter-info">
          <p>Active: {selectedAdapter.name}</p>
          <p>Type: {selectedAdapter.type}</p>
        </div>
      )}
    </div>
  );
}
```

### With Custom Styling

```tsx
import WiFiAdapterSettings from '@/components/AdapterSettings';

export default function ThemedSettings() {
  return (
    <div className="custom-adapter-container">
      <style>{`
        .custom-adapter-container .p-6 {
          padding: 2rem;
          background: #f5f5f5;
        }
      `}</style>
      <WiFiAdapterSettings />
    </div>
  );
}
```

## Component Interface

### State Variables

```typescript
adapters: Adapter[]                     // Available adapters
selectedAdapter: Adapter | null         // Currently selected adapter
settings: AdapterSettings               // Current user settings
isRooted: boolean                       // Android root status
loading: boolean                        // Loading state
error: string | null                    // Error messages
platform: 'web' | 'windows' | 'android' // Detected platform
```

### Types

```typescript
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
```

## Methods

### `detectPlatform()`

Determines the runtime platform by checking for Electron or Capacitor globals.

```typescript
detectPlatform(): void
// Sets platform to 'windows' | 'android' | 'web'
```

### `loadAdapters()`

Loads available adapters from the backend or IPC.

```typescript
loadAdapters(): Promise<void>
// Fetches adapters based on platform
// Updates state with adapter list
```

### `loadSettings()`

Retrieves current user adapter settings from backend.

```typescript
loadSettings(): Promise<void>
// Gets saved settings from /api/adapters/settings
// Updates component state
```

### `handleAdapterSelect(adapter)`

Handles adapter selection and notifies backend.

```typescript
handleAdapterSelect(adapter: Adapter): Promise<void>
// Sends POST to /api/adapters/select
// Updates active adapter in UI
```

### `handleMonitoringModeChange(mode)`

Enables monitor or promiscuous mode (Android with root).

```typescript
handleMonitoringModeChange(mode: string): Promise<void>
// Checks root access requirement
// POSTs to /api/adapters/enable-{mode}-mode
// Updates component state
```

### `handleSettingsUpdate()`

Saves current settings to backend.

```typescript
handleSettingsUpdate(): Promise<void>
// PUTs settings to /api/adapters/settings
// Shows success message
```

### `handleRefresh()`

Manually refresh the adapter list.

```typescript
handleRefresh(): void
// Calls loadAdapters()
// Shows loading state
```

## Event Handlers

### Adapter Selection

When user clicks on an adapter:

```typescript
onClick={() => handleAdapterSelect(adapter)}
// Adapter is selected via API/IPC
// UI updates to show active adapter with blue background
```

### Monitoring Mode Radio Buttons

For Android rooted phones:

```typescript
onChange={() => handleMonitoringModeChange(mode)}
// Validates root access required
// Enables monitoring mode via API
// Updates radio button state
```

### Settings Checkboxes

```typescript
onChange={(e) =>
  setSettings((prev) => ({
    ...prev,
    autoDetectAdapters: e.target.checked,
  }))
}
// Updates local state
// Not persisted until Save Settings button clicked
```

## UI Sections

### 1. Header

```
WiFi Adapter Settings
```

Simple title for the component.

### 2. Error Alert

```
[Error message if any operation fails]
```

Red alert box with error details, automatically dismissed when resolved.

### 3. Device Information

```
Platform: WINDOWS/ANDROID/WEB
Root Access: ✓ Enabled / ✗ Not Available
Available Adapters: 2
```

Shows device capabilities and adapter count.

### 4. Active Adapter Card

```
Adapter Name
[type] [vendor]
Signal Strength: 85%
```

Green card showing currently selected adapter with details.

### 5. Adapter Selection Grid

```
[Adapter 1] [Adapter 2]
[Adapter 3] [Adapter 4]
```

Clickable cards to select from available adapters. Active adapter has blue border.

### 6. Root Access Warning (Android Only)

```
⚠️ Root Access Required
Rooting enables:
- Monitor mode
- Promiscuous mode
```

Yellow warning shown if Android device not rooted.

### 7. Monitoring Mode Radio Buttons (Android + Root)

```
⚪ Standard WiFi
⚪ Monitor Mode (Sniff packets)
⚪ Promiscuous Mode (Requires root)
```

Radio buttons to select monitoring mode (only shown on rooted Android).

### 8. Settings

```
☐ Auto-detect external adapters
☐ Use external USB adapter if available (Windows)
```

Checkboxes for additional options.

### 9. Action Buttons

```
[Save Settings] [Refresh]
```

- **Save Settings**: Persists settings to backend
- **Refresh**: Reload adapter list

## Styling & CSS Classes

The component uses Tailwind CSS utility classes:

```css
/* Container */
.p-6              /* Padding: 1.5rem */
.max-w-4xl        /* Max width: 56rem */
.mx-auto          /* Horizontal centering */

/* Typography */
.text-3xl         /* Title font size */
.font-bold        /* Bold font weight */
.mb-6             /* Margin bottom: 1.5rem */

/* Colors */
.bg-blue-50       /* Light blue background */
.bg-red-100       /* Light red background */
.text-red-700     /* Red text */
.bg-green-50      /* Light green background */
.text-green-600   /* Green text */

/* Grid */
.grid              /* CSS Grid */
.grid-cols-1      /* 1 column (mobile) */
.md:grid-cols-2   /* 2 columns (desktop) */
.gap-3            /* Gap between items */

/* Buttons */
.px-6 .py-2       /* Padding: 0 1.5rem, 0.5rem */
.bg-blue-500      /* Blue button background */
.hover:bg-blue-600 /* Hover state */
.rounded-lg       /* Border radius: 0.5rem */
```

## API Integration

### Fetch Adapters (REST API)

```javascript
// Windows/Web
const response = await fetch('/api/adapters?platform=windows');
const data = await response.json();

// Android
const response = await fetch('/api/adapters?platform=android');
const data = await response.json();
// Includes: isRooted, supportsUSBOTG
```

### Select Adapter (REST API)

```javascript
const response = await fetch('/api/adapters/select', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    adapterId: 'adapter-1',
    aapterName: 'TP-Link USB',
    platform: 'windows'
  })
});
```

### Update Settings (REST API)

```javascript
const response = await fetch('/api/adapters/settings', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    platform: 'android',
    settings: { ... }
  })
});
```

### Enable Monitor Mode (REST API)

```javascript
const response = await fetch('/api/adapters/enable-monitor-mode', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    adapterId: 'adapter-1'
  })
});
```

## Error Handling

The component handles errors gracefully:

### Error Display

```typescript
if (error) {
  // Shows red alert box with error message
  return <div className="bg-red-100 border border-red-400...">
    {error}
  </div>
}
```

### Common Errors

1. **Adapter Detection Failed**
   - Message: `Failed to load adapters: {error}`
   - Solution: Check backend is running, network connectivity

2. **Root Access Required**
   - Message: `Root access required for monitor mode`
   - Solution: Root your Android device

3. **Adapter Select Failed**
   - Message: `Failed to select adapter`
   - Solution: Check adapter is still connected

4. **Settings Save Failed**
   - Message: `Failed to save settings`
   - Solution: Check backend availability

## Performance Considerations

### Loading

- Component initializes with `loading: true` state
- Shows "Loading adapters..." message during initial fetch
- Adapter detection takes 200-500ms on Windows, 1-2s on Android

### Re-renders

- Component re-renders only when state changes
- Each adapter selection triggers one render
- Settings updates trigger one render

### Optimization Tips

```typescript
// Memoize to prevent unnecessary re-renders
const AdapterCard = React.memo(({ adapter, onSelect }) => {...});

// Use useCallback for event handlers
const handleSelect = useCallback((adapter) => {
  // Don't recreate function on every render
}, []);
```

## Browser Compatibility

### Desktop Platforms

| Browser | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Electron | ✅ Full | ⚠️ Partial | ⚠️ Partial |
| Chrome | N/A | N/A | N/A |
| Firefox | N/A | N/A | N/A |

### Mobile Platforms

| Platform | Support | Notes |
|----------|---------|-------|
| Android | ✅ Full | Requires USB OTG for external adapters |
| iOS | ❌ None | No USB support |
| Web (PWA) | ✅ Limited | Can't detect/enable advanced modes |

## Accessibility

The component includes:

- Semantic HTML (`<label>`, `<input>`)
- Color-coded feedback (green for success, red for errors)
- Clear button labels ("Save Settings", "Refresh")
- Checkbox and radio button labels
- Loading state messaging

**TODO**: Add ARIA labels for screen readers

## Testing

### Unit Test Example

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import WiFiAdapterSettings from './AdapterSettings';

describe('WiFiAdapterSettings', () => {
  it('should render adapter list', () => {
    render(<WiFiAdapterSettings />);
    expect(screen.getByText('WiFi Adapter Settings')).toBeInTheDocument();
  });

  it('should select adapter on click', async () => {
    render(<WiFiAdapterSettings />);
    const adapterButton = screen.getByText('WiFi Adapter #1');
    fireEvent.click(adapterButton);
    // Assert API was called
  });
});
```

### Integration Test Example

```typescript
// Test with mock backend
const mockServer = setupServer(
  rest.get('/api/adapters', (req, res, ctx) => {
    return res(ctx.json({
      adapters: [{ id: '1', name: 'Test Adapter', type: 'built-in' }]
    }));
  })
);

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());
```

## Troubleshooting

### Component Not Loading

**Issue**: "Loading adapters..." message doesn't go away

**Solutions**:
1. Check if backend server is running (`http://localhost:3000`)
2. Check browser console for API errors
3. Verify `/api/adapters` endpoint is accessible
4. Check network tab in DevTools for failed requests

### Adapters Not Detected

**Windows**:
1. Ensure USB WiFi adapter has drivers installed
2. Check Device Manager for unknown devices
3. Restart the Electron app

**Android**:
1. Verify USB OTG cable is properly connected
2. Check Android permissions: Settings → Apps → WiFi Sentry → Permissions
3. Try different USB port on adapter

### Root Access Not Detected

**Android**:
1. Verify device is properly rooted
2. Open SuperSU app and check for WiFi Sentry permission requests
3. Manually grant WiFi Sentry root access in SuperSU
4. Restart WiFi Sentry app

## Contributing

When modifying this component:

1. Maintain platform compatibility (Windows, Android, Web)
2. Update types when adding new features
3. Add error handling for new API calls
4. Test UI on all platforms before committing
5. Update this documentation

## Related Files

- Backend API: [`api/adapters.js`](../../api/adapters.js)
- Windows Manager: [`desktop/windows-adapter-manager.js`](../../desktop/windows-adapter-manager.js)
- Android Manager: [`mobile/android-usb-adapter-manager.ts`](../../mobile/android-usb-adapter-manager.ts)
- Electron IPC: [`desktop/adapter-ipc-handlers.js`](../../desktop/adapter-ipc-handlers.js)
- Preload Script: [`desktop/preload.js`](../../desktop/preload.js)
- Documentation: [`ADAPTER_MANAGEMENT.md`](../../ADAPTER_MANAGEMENT.md)

---

**Last Updated**: 2024
**Version**: 1.0.0
