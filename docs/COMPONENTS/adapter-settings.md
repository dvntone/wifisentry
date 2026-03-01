# WiFi Adapter Settings Component

The `AdapterSettings` component is a central part of WiFi Sentry, allowing users to configure and manage their WiFi hardware for threat detection.

## 📱 Platform-Specific Behavior

The component automatically detects the platform it is running on and adjusts its features accordingly.

- **Windows (Electron)**: Supports built-in and external USB adapters. Includes advanced "Capture Backend" selection (Npcap, WSL2, AirPcap).
- **Android (Capacitor)**: Supports the device's built-in WiFi and USB OTG external adapters. Advanced modes (Monitor, Promiscuous) require **Root Access**.
- **Web (Standard)**: Limited to standard WiFi scanning capabilities provided by the backend server.

## 🛠️ Key Features

### 1. Adapter Selection
Displays a list of all detected WiFi adapters. Users can click on an adapter to select it for active monitoring.
- **Built-in**: The device's internal WiFi card.
- **External-USB**: WiFi adapters connected via USB. Highly recommended for monitor mode.

### 2. Monitoring Modes
- **Default**: Standard WiFi scanning. Works on all platforms without special privileges.
- **Monitor Mode**: Captures raw 802.11 frames without connecting to an access point. Requires a compatible adapter and Root (Android) or a specialized driver (Windows).
- **Promiscuous Mode**: Captures all traffic on the network the adapter is connected to. Requires Root (Android).

### 3. Capture Backends (Windows Only)
Allows users to select the method used for raw frame capture:
- **Auto-detect (Recommended)**: Automatically tries available backends in order.
- **Npcap**: The industry-standard packet capture library for Windows.
- **WSL2**: Uses the Windows Subsystem for Linux 2 for capture (see [WSL2 Guide](../SETUP/windows-wsl2.md)).
- **AirPcap**: For legacy AirPcap hardware.

### 4. Android Root Detection
On Android, the component checks for root access. If the device is not rooted, advanced monitoring modes are disabled, and a warning is displayed explaining the benefits of root access for security research.

## ⚙️ Configuration Settings

- **Auto-detect external adapters**: When enabled, the app will automatically refresh the adapter list when a new USB device is connected.
- **Prefer external USB adapter**: (Windows only) If enabled, the app will automatically switch to an external adapter when one is plugged in.
- **Adapter Refresh Interval**: How often the app polls for adapter status changes.

## 🔌 API Integration

The component interacts with the following backend endpoints:
- `GET /api/adapters`: Lists available adapters.
- `POST /api/adapters/select`: Selects an adapter for monitoring.
- `GET /api/adapters/settings`: Retrieves saved adapter settings.
- `PUT /api/adapters/settings`: Updates adapter settings.
- `POST /api/adapters/enable-[mode]-mode`: Attempts to enable a specific monitoring mode.
