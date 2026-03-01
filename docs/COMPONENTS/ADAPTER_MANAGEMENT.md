# WiFi Adapter Management System

This document describes the external WiFi adapter support in WiFi Sentry, enabling power users and security professionals to use external USB adapters for advanced WiFi monitoring and packet capture.

## Overview

WiFi Sentry now supports external USB WiFi adapters on both Windows and Android platforms, allowing:

- **Windows Users**: Better range, sensitivity, and compatibility with packet sniffing tools
- **Android Users (with USB OTG)**: Forensic WiFi monitoring via external adapters
- **Rooted Phones**: Advanced modes (monitor mode, promiscuous mode) for packet capture

## System Architecture

### Platform-Specific Implementation

#### Windows (Electron Desktop App)

**Technology Stack**:
- Netsh commands for built-in WiFi adapter enumeration
- WMI queries for USB device detection
- Native Windows APIs for adapter control

**Key Files**:
- [`desktop/windows-adapter-manager.js`](desktop/windows-adapter-manager.js) - Core Windows adapter management
- [`desktop/adapter-ipc-handlers.js`](desktop/adapter-ipc-handlers.js) - IPC bridge to renderer process
- [`desktop/preload.js`](desktop/preload.js) - Secure API exposure to React renderer

**Supported Adapters**:
- Any USB WiFi adapter with Windows drivers installed
- Both 2.4GHz and 5GHz capable adapters
- USB 2.0 and USB 3.0 adapters

#### Android (Capacitor Mobile App)

**Technology Stack**:
- Capacitor USB plugin for device enumeration
- Android native APIs for adapter control
- Optional root access for advanced modes

**Key Files**:
- [`mobile/android-usb-adapter-manager.ts`](mobile/android-usb-adapter-manager.ts) - Core Android USB management
- Integration with Capacitor USB bridge in React Native

**Supported Adapters** (9 Known Vendors):
- Realtek (RTL8811AU, RTL8812AE)
- Atheros (AR9271, AR7010)
- Ralink (RT5370)
- TP-Link (WN722N)
- ASUS (A6210)
- D-Link, Buffalo, Edimax

**Requirements**:
- Android 5.0+ for USB OTG support
- USB OTG cable (USB-C or Micro USB)
- Root access (optional, for monitor/promiscuous modes)

#### Backend API

**Technology Stack**:
- Express.js REST API
- MongoDB for settings persistence
- Platform-aware response handling

**Key File**:
- [`api/adapters.js`](api/adapters.js) - RESTful adapter management endpoints

## API Reference

### REST Endpoints

All adapter management endpoints are prefixed with `/api/adapters`.

#### List Available Adapters

```bash
GET /api/adapters?platform=windows|android|web
```

**Response** (Windows):
```json
{
  "platform": "windows",
  "adapters": [
    {
      "id": "adapter-0",
      "name": "WiFi Adapter #1",
      "type": "built-in",
      "vendor": "Intel",
      "model": "Wireless-AC",
      "isExternal": false,
      "status": "connected",
      "signalStrength": 85
    },
    {
      "id": "adapter-1",
      "name": "TP-Link USB Adapter",
      "type": "external-usb",
      "vendor": "TP-Link",
      "model": "WN722N",
      "isExternal": true,
      "status": "connected",
      "signalStrength": 75
    }
  ],
  "deviceInfo": {
    "totalAdapters": 2,
    "supportedCount": 2
  }
}
```

**Response** (Android):
```json
{
  "platform": "android",
  "adapters": [...],
  "deviceInfo": {
    "isRooted": true,
    "supportsUSBOTG": true,
    "totalAdapters": 1,
    "supportedCount": 1
  }
}
```

#### Get Adapter Details

```bash
GET /api/adapters/:id
```

Returns detailed information about a specific adapter including signal strength, channel, frequency, and auth type.

#### Select Active Adapter

```bash
POST /api/adapters/select
Content-Type: application/json

{
  "adapterId": "adapter-1",
  "aapterName": "TP-Link USB Adapter",
  "platform": "windows"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Adapter selected",
  "activeAdapter": { ... }
}
```

#### Get Current Settings

```bash
GET /api/adapters/settings
```

**Response**:
```json
{
  "settings": {
    "useExternalAdapter": true,
    "selectedAdapterId": "adapter-1",
    "autoDetectAdapters": true,
    "monitoringMode": "default"
  }
}
```

#### Update Settings

```bash
PUT /api/adapters/settings
Content-Type: application/json

{
  "platform": "android",
  "settings": {
    "useExternalAdapter": true,
    "selectedAdapterId": "adapter-1",
    "autoDetectAdapters": true,
    "monitoringMode": "monitor"
  }
}
```

#### Enable Monitor Mode (Android + Root)

```bash
POST /api/adapters/enable-monitor-mode
Content-Type: application/json

{
  "adapterId": "adapter-1"
}
```

**Requirements**:
- Android device must be rooted
- Adapter must support monitor mode
- Requires `su` permissions

#### Enable Promiscuous Mode (Android + Root)

```bash
POST /api/adapters/enable-promiscuous-mode
Content-Type: application/json

{
  "adapterId": "adapter-1"
}
```

**Requirements**:
- Android device must be rooted
- Adapter must support promiscuous mode
- Enables packet capture for unencrypted traffic

#### Get Adapter Statistics

```bash
GET /api/adapters/stats/:id
```

Returns real-time statistics:
- Bytes transmitted/received
- Packets transmitted/received
- Signal strength
- Connection status
- Error count

#### Get Device Capabilities

```bash
GET /api/adapters/device-info
```

Returns device capabilities and available features.

### Electron IPC Handlers

For Windows Electron app, use these IPC methods from React renderer:

```typescript
// Get all available adapters
const adapters = await window.electron.getAvailableAdapters();

// Get currently active adapter
const active = await window.electron.getActiveAdapter();

// Select an adapter
const result = await window.electron.selectAdapter('TP-Link USB Adapter');

// Get adapter details
const details = await window.electron.getAdapterDetails('TP-Link USB Adapter');

// Get adapter statistics
const stats = await window.electron.getAdapterStats('TP-Link USB Adapter');

// Listen for real-time adapter updates
window.electron.onAdapterUpdate((data) => {
  console.log('Adapters updated:', data);
});

// Listen for errors
window.electron.onAdapterError((error) => {
  console.error('Adapter error:', error);
});
```

### Capacitor Integration (Android)

For Android Capacitor app:

```typescript
import { CapacitorHttp } from '@capacitor/core';

// Get adapters
const response = await CapacitorHttp.get({
  url: 'http://localhost:3000/api/adapters?platform=android'
});

// Select adapter
await CapacitorHttp.post({
  url: 'http://localhost:3000/api/adapters/select',
  data: {
    adapterId: 'usb-adapter-1',
    platform: 'android'
  }
});
```

## Configuration

### Windows Configuration

No special configuration required. The system automatically detects USB WiFi adapters using netsh and WMI queries.

**Environment Variables** (optional):
```bash
# Enable/disable external adapter support
ADAPTER_MANAGEMENT_ENABLED=true

# Auto-detect adapters on startup
ADAPTER_AUTO_DETECT_WINDOWS=true

# Adapter monitoring interval (ms)
ADAPTER_MONITOR_INTERVAL=5000
```

### Android Configuration

**USB OTG Requirements**:
1. Device must support USB OTG (Android 5.0+)
2. USB OTG cable required (USB Type-C or Micro USB)
3. WiFi adapter must be compatible with Android

**Environment Variables**:
```bash
# Require root for advanced modes
ANDROID_ADAPTER_ROOT_REQUIRED=true

# Enable monitor/promiscuous modes if root available
ANDROID_ADAPTER_ADVANCED_MODES=true

# USB detection method
ANDROID_USB_DETECTION_METHOD=capacitor
```

**Root Access (Optional)**:

To enable advanced monitoring modes on rooted Android:

1. Root your device using Magisk or SuperSU
2. Grant WiFi Sentry root permissions when prompted
3. Advanced modes become available in settings

## Usage Guide

### Windows Desktop (Electron)

1. **Enable Adapter Management**:
   - Open WiFi Sentry desktop app
   - Navigate to Settings → WiFi Adapters
   - Check "Use external USB adapter if available"

2. **Select External Adapter**:
   - Connect USB WiFi adapter
   - Click "Refresh Adapters"
   - Select adapter from list
   - Click "Save Settings"

3. **Start Monitoring**:
   - Adapter will automatically be used for WiFi scans
   - Monitor real-time adapter statistics in dashboard
   - Signal strength, channel, frequency displayed

### Android Mobile (USB OTG)

#### Without Root (Standard Mode)

1. Connect USB OTG cable to phone
2. Connect USB WiFi adapter to OTG cable
3. Open WiFi Sentry app
4. Go to Settings → WiFi Adapters
5. Tap "Refresh Adapters" - external adapter will be detected
6. Select external adapter from list
7. Monitoring mode remains "Standard WiFi"

#### With Root (Advanced Modes)

1. After completing steps 1-6 above
2. Tap "Enable Monitor Mode" for packet sniffing
3. Grant root permissions when prompted
4. Or tap "Enable Promiscuous Mode" for unencrypted packet capture
5. Advanced modes now available for forensic WiFi analysis

### Web PWA (Limited)

The web version has limited adapter support:
- View available adapters on network
- Change adapter selection
- View statistics
- Advanced modes not available via web

## Performance & Limitations

### Windows

**Advantages**:
- Full native API support
- Real-time adapter monitoring
- No performance overhead
- Compatible with most adapters

**Limitations**:
- Requires adapter drivers installed
- Some adapters may not be detected
- Monitor mode not available (Windows limitation)

**Performance**:
- Adapter enumeration: ~200-500ms
- Adapter switching: ~500ms-1s
- Minimal CPU/memory impact

### Android

**Advantages**:
- Universal USB OTG support (Android 5.0+)
- Advanced modes available on rooted devices
- Real-time packet capture possible

**Limitations**:
- Requires USB OTG cable
- Not all adapters supported
- Root required for advanced modes
- Battery drain with continuous monitoring

**Performance**:
- USB device enumeration: ~1-2s
- Adapter switching: ~500ms
- Advanced mode startup: ~2-5s (with root)
- Monitor mode uses 15-25% CPU
- Promiscuous mode uses 20-30% CPU

## Troubleshooting

### Windows

**Adapter Not Detected**:
1. Ensure USB adapter has Windows drivers installed
2. Check Device Manager for unknown devices
3. Update chipset drivers
4. Try different USB port (USB 3.0 if available)
5. Restart WiFi Sentry app

**Adapter Detected But Inactive**:
1. Right-click adapter in Device Manager → Update driver
2. Restart the application
3. Try manual adapter selection

**Poor Signal Strength**:
1. Move adapter closer to WiFi source
2. Adjust antenna position (if external)
3. Try adapter on different USB port
4. Check for interference (USB 3.0 devices, microwaves)

### Android

**USB OTG Not Working**:
1. Ensure phone supports USB OTG
2. Try different USB OTG cable
3. Check if adapter uses too much power (get powered USB hub)
4. Restart phone and reconnect adapter

**Adapter Not Detected**:
1. Verify adapter is in supported vendor list
2. Try adapter on computer first to verify functionality
3. Check USB permissions: Settings → Apps → WiFi Sentry → Permissions
4. For rooted phones, ensure root access granted to WiFi Sentry

**Root Access Not Detected**:
1. Verify device is properly rooted with Magisk/SuperSU
2. Grant WiFi Sentry root permissions
3. Restart WiFi Sentry app
4. Check SuperSU logs for permission requests

**Monitor Mode Fails**:
1. Ensure device is rooted
2. Verify adapter supports monitor mode (not all adapters do)
3. Disable any VPNs or firewalls
4. Check kernel logs: `adb logcat | grep 'monitor'`

**Promiscuous Mode Fails**:
1. Same as monitor mode troubleshooting
2. Verify nearby networks are broadcasting SSID
3. Try on known open WiFi first
4. Check file permissions on `/data/local/tmp/`

## Development

### Adding Support for New Adapters

**Windows**:
1. Identify adapter USB Vendor ID (VID)
2. Add to `WindowsAdapterManager._getUSBAdapters()` detection logic
3. Test enumeration with `netsh wlan show interfaces`

**Android**:
1. Get adapter USB VID and Product ID (PID)
2. Add to `AndroidUSBAdapterManager.KNOWN_ADAPTERS` database
3. Test with `adb shell lsusb`

### Extending Monitoring Modes

**Adding Custom Monitoring Mode**:
1. Update `AndroidAdapterSettings.monitoringMode` enum
2. Implement mode handler in `android-usb-adapter-manager.ts`
3. Add API endpoint in `api/adapters.js`
4. Update React component options

## Security Considerations

### Windows
- Uses only built-in system tools (netsh, WMI)
- No privilege escalation required
- Config stored in app database
- No sensitive adapter info exposed

### Android
- Root access verified before enabling advanced modes
- USB permissions handled via Android permission system
- Captured packets never automatically uploaded
- Monitor mode limited to local forensics

### General
- All API endpoints require same authentication as main app
- Settings persisted per-user in database
- Real-time updates sent only to authorized clients
- No adapter credentials stored

## API Integration Examples

### JavaScript/React

```javascript
import WiFiAdapterSettings from '@/components/AdapterSettings';

export default function Dashboard() {
  return (
    <div>
      <h1>WiFi Security Monitor</h1>
      <WiFiAdapterSettings />
    </div>
  );
}
```

### TypeScript/Angular

```typescript
import { AdapterService } from './services/adapter.service';

export class AdapterComponent {
  adapters$ = this.adapterService.getAvailableAdapters();
  
  constructor(private adapterService: AdapterService) {}
  
  selectAdapter(id: string) {
    this.adapterService.selectAdapter(id).subscribe(
      result => console.log('Adapter selected', result)
    );
  }
}
```

## References

- [Windows WMI Classes and Methods](https://docs.microsoft.com/en-us/windows/win32/wmisdk/)
- [Android USB OTG Documentation](https://developer.android.com/guide/topics/connectivity/usb)
- [Capacitor USB Plugin](https://github.com/capacitor-community/usb)
- [Electron IPC Security](https://www.electronjs.org/docs/tutorial/security)

## Support

For issues or questions about adapter management:

1. Check Troubleshooting section above
2. Review application logs in `~/.wifisentry/logs/`
3. Report issues with:
   - OS version
   - Adapter model/vendor
   - Error message from logs
   - Steps to reproduce

---

**Last Updated**: 2024
**Version**: 1.0.0
