# Windows WSL2 Advanced WiFi Monitoring

This document explains how WiFi Sentry on Windows supports advanced monitoring modes (monitor mode and promiscuous mode) through Windows Subsystem for Linux 2 (WSL2) integration.

## Overview

While Windows doesn't natively support packet sniffing monitor modes like Linux does, WSL2 allows you to run Linux tools directly from Windows. WiFi Sentry leverages this to provide:

- **Monitor Mode**: Listen to all WiFi packets on a channel without connecting
- **Promiscuous Mode**: Capture unsecured/unencrypted network traffic
- **Packet Analysis**: Analyze captured traffic for threats
- **Automated Threat Detection**: Real-time threat identification

## System Architecture

### Components

1. **Windows Layer** (Host)
   - Electron UI with adapter selection
   - IPC communication
   - Configuration management

2. **WSL2 Layer** (Linux)
   - Aircrack-ng suite (monitor mode)
   - tcpdump/Wireshark (packet capture)
   - Bettercap (network analysis)
   - Traffic analysis tools

3. **Bridge Layer**
   - `windows-adapter-manager.js` - Main adapter management
   - `windows-wsl2-adapter-manager.js` - WSL2 integration layer
   - `adapter-ipc-handlers.js` - Electron IPC communication

```
┌─────────────────────────────────────────────────────────────┐
│                      Windows 10/11                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   WiFi Sentry (Electron)             │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │  Adapter Settings UI                         │   │  │
│  │  │  - Select adapter                            │   │  │
│  │  │  - Enable Monitor Mode                       │   │  │
│  │  │  - Start Capture                             │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │  ↓                                                   │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │  Adapter IPC Handlers                        │   │  │
│  │  │  (adapter-ipc-handlers.js)                   │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │  ↓                                                   │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │  Windows Adapter Manager                     │   │  │
│  │  │  (windows-adapter-manager.js)                │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │  ↓                                                   │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │  WSL2 Adapter Manager                        │   │  │
│  │  │  (windows-wsl2-adapter-manager.js)           │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  WSL2 Ubuntu/Debian instance                        │  │
│  │                                                      │  │
│  │  airmon-ng │ tcpdump │ tshark │ bettercap        │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                 ↓                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Windows Drivers & USB WiFi Adapter                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                 ↓                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Physical WiFi Adapter (External USB or Built-in)   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Windows Requirements

- **Windows 10 Build 19041+** or **Windows 11**
- **WSL2** installed and configured
- **Administrator privileges** (for packet capture)
- Optional: External USB WiFi adapter for better range

### WSL2 Distribution

Install one of these Linux distributions in WSL2:

```bash
# Windows PowerShell (Administrator)
wsl --install -d Ubuntu
# or
wsl --install -d Kali-Linux  # Pre-includes hacking tools
# or
wsl --install -d Debian
```

### Required Linux Tools

Inside your WSL2 distribution:

```bash
sudo apt-get update

# Monitor Mode Support
sudo apt-get install aircrack-ng

# Packet Capture
sudo apt-get install tcpdump

# Optional: Advanced Analysis
sudo apt-get install wireshark-common  # For tshark
sudo apt-get install bettercap         # For advanced network scanning

# Verify installation
which airmon-ng tcpdump tshark bettercap
```

## Configuration

### 1. Enable WSL2 (First Time Only)

```powershell
# Windows PowerShell (Administrator)
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Restart Windows

# Set WSL default version to 2
wsl --set-default-version 2

# Verify
wsl --list --verbose
```

### 2. Configure WiFi Sentry

Update `.env` file:

```bash
# WSL2 Configuration
WSL2_ADAPTER_SUPPORT=true
WSL2_DISTRO=Ubuntu              # or Kali, Debian
WSL2_USERNAME=root              # or your WSL username

# Adapter Management
ADAPTER_MANAGEMENT_ENABLED=true
ADAPTER_MONITOR_MODE_ENABLED=true
ADAPTER_PROMISCUOUS_MODE_ENABLED=true
ADAPTER_PACKET_CAPTURE_ENABLED=true

# Monitoring defaults
ADAPTER_DEFAULT_METHOD=aircrack  # aircrack, iw, or iwconfig
ADAPTER_CAPTURE_FORMAT=pcap      # pcap or csv
```

### 3. WiFi Adapter Compatibility

**Recommended External USB Adapters** (for monitor mode):

| Adapter | Chipset | WSL2 Support | Monitor Mode | Notes |
|---------|---------|-------------|--------------|-------|
| TP-Link WN722N | AR9271 | ✅ Excellent | ✅ Yes | Budget friendly, reliable |
| Realtek RTL8811AU | RTL8811AU | ✅ Good | ✅ Yes | Newer, better drivers |
| Alfa AWUS036H | RTL8187 | ✅ Good | ✅ Yes | Professional grade |
| Alfa AWUS1900 | RTL8814AU | ✅ Excellent | ✅ Yes | Dual-band, powerful |
| ASUS USB-AC51 | RTL8811AU | ✅ Good | ✅ Yes | Compact form factor |

## Usage

### Enable Monitor Mode Via UI

1. Open WiFi Sentry desktop app
2. Navigate to **Settings → WiFi Adapters**
3. Select external USB adapter from list
4. **Click "Enable Monitor Mode"**
5. Grant administrator privileges when prompted
6. Monitor mode activated for advanced packet sniffing

### Enable Promiscuous Capture Via UI

1. Follow steps 1-3 above
2. **Click "Start Packet Capture"**
3. Specify capture filter (optional):
   - Leave empty for all traffic
   - Example: `tcp port 80` for HTTP only
   - Example: `not ssh` to exclude SSH
4. Capture starts in WSL2
5. **Click "Stop Capture"** to save PCAP file

### Command Line Usage (Advanced)

```bash
# Direct WSL2 commands

# Get monitor adapters
wsl airmon-ng

# Enable monitor mode
wsl sudo airmon-ng start wlan0

# Start packet capture
wsl sudo tcpdump -i wlan0mon -w /tmp/capture.pcap

# Using Wireshark
wsl sudo tshark -i wlan0mon -w /tmp/capture.pcap -c 1000

# Using Bettercap
wsl sudo bettercap -iface wlan0mon
```

## API Integration

### Backend Endpoints

#### Enable Monitor Mode

```bash
POST /api/adapters/enable-monitor-mode/windows
Content-Type: application/json

{
  "adapterId": "adapter-0",
  "interfaceName": "wlan0",
  "method": "aircrack"  // or "iw", "iwconfig"
}
```

**Response**:
```json
{
  "success": true,
  "method": "aircrack-ng (airmon-ng)",
  "originalInterface": "wlan0",
  "monitorInterface": "wlan0mon",
  "capabilities": {
    "packetCapture": true,
    "channelHopping": true,
    "powerControl": true,
    "deauthFrames": true
  }
}
```

#### Start Promiscuous Capture

```bash
POST /api/adapters/enable-promiscuous-mode/windows
Content-Type: application/json

{
  "interfaceName": "wlan0mon",
  "format": "pcap",
  "filter": "tcp port 80",
  "packetCount": 0  // 0 = unlimited
}
```

**Response**:
```json
{
  "success": true,
  "mode": "promiscuous",
  "tool": "tcpdump",
  "processId": "capture-1707000000000",
  "outputFile": "/tmp/wifi-sentry-capture-1707000000000.pcap",
  "interface": "wlan0mon",
  "capabilities": {
    "packetCapture": true,
    "filtering": true,
    "unencryptedDataCapture": true
  }
}
```

### IPC Methods (Electron)

```typescript
// Enable monitor mode
const result = await window.electron.enableMonitorMode('wlan0', 'aircrack');
console.log('Monitor Interface:', result.monitorInterface);

// Start capture
const capture = await window.electron.startPromiscuousCapture('wlan0mon', {
  format: 'pcap',
  filter: 'tcp port 443',
  packetCount: 1000
});

// Stop capture
await window.electron.stopPromiscuousCapture(capture.processId);

// Analyze capture file
const analysis = await window.electron.analyzeCaptureFile(capture.outputFile);
console.log('Analysis:', analysis);

// Get capabilities
const caps = await window.electron.getCapabilities();
console.log('WSL2 Tools Available:', caps.wsl2.tools);
```

## Troubleshooting

### WSL2 Not Available

**Error**: "WSL2 not available"

**Solutions**:
1. Install WSL2: `wsl --install`
2. Set as default: `wsl --set-default-version 2`
3. Update Linux kernel: `wsl --update`
4. Restart Windows

### Monitor Mode Fails

**Error**: "airmon-ng: command not found"

**Solutions**:
1. Install aircrack-ng: `sudo apt-get install aircrack-ng`
2. Verify: `which airmon-ng`
3. Check WSL distro is set correctly in config

**Error**: "Permission denied"

**Solutions**:
1. Run WiFi Sentry as Administrator
2. Grant sudo permissions: `sudo chmod 4755 /usr/bin/airmon-ng`
3. Check WSL username in config

### Adapter Not Found in WSL2

**Issue**: Adapter visible in Windows but not in WSL2

**Solutions**:
1. Restart WSL2: `wsl --shutdown`
2. Check USB adapter drivers installed on Windows
3. Try different USB port
4. Verify adapter supports Linux drivers

### Capture Not Starting

**Error**: "tcpdump not found"

**Solutions**:
1. Install tcpdump: `sudo apt-get install tcpdump`
2. Verify: `which tcpdump`
3. Check file permissions: `/tmp` must be writable

### Performance Issues

**Problem**: Slow packet capture

**Solutions**:
1. Close other WSL processes
2. Allocate more memory to WSL in `.wslconfig`
3. Use tcpdump instead of bettercap (lighter)
4. Reduce packet count or use filters

## Performance Characteristics

### Monitor Mode

- **Startup Time**: 2-5 seconds
- **CPU Usage**: 5-10%
- **Memory Usage**: 50-100 MB
- **Supported Adapters**: 1-4 per interface

### Promiscuous Capture

- **Startup Time**: <1 second
- **CPU Usage**: 10-25% (depends on traffic)
- **Memory Usage**: 100-500 MB
- **File Size**: ~1-10 MB per 10k packets
- **Max Packet Rate**: 100k+ packets/sec (depends on hardware)

## Security Considerations

### Privileges

- Monitor mode requires **Administrator** on Windows
- tcpdump requires **sudo** in WSL2
- Recommend running WiFi Sentry in Administrator mode

### Captured Data

- All captured packets stored locally in `/tmp/wifi-sentry-*.pcap`
- Can contain unencrypted passwords, messages, credentials
- **Never share PCAP files without sanitization**
- Enable automatic cleanup of files after analysis

### Usage Guidelines

- Only capture on networks you own or have permission to analyze
- Complies with local laws regarding packet capture
- Use for legitimate security research only

## Advanced Configuration

### Custom WSL2 Settings

Edit `C:\Users\<USERNAME>\.wslconfig`:

```ini
[wsl2]
memory=2GB          # Allocate 2GB RAM to WSL2
processors=4        # Use 4 CPU cores
swap=1GB            # Enable 1GB swap
localhostForwarding=true

[interop]
enabled=true        # Allow Windows to call WSL
appendWindowsPath=true
```

### Multiple Adapters

Configure multiple external adapters for parallel monitoring:

```javascript
const adapters = await manager.getMonitorModeAdapters();

// Enable monitor on all adapters
for (const adapter of adapters.adapters) {
  await manager.enableMonitorMode(adapter.interface, 'aircrack');
}
```

### Automated Analysis Pipeline

```bash
#!/bin/bash
# analyze.sh - Run in WSL2

CAPTURE_FILE=$1

# Extract HTTP traffic
tcpdump -r "$CAPTURE_FILE" 'tcp port 80' -w http.pcap

# Extract DNS queries
tcpdump -r "$CAPTURE_FILE" 'udp port 53' -w dns.pcap

# Extract credentials (basic)
strings "$CAPTURE_FILE" | grep -i password | head -20

# Analyze with Zeek IDS
zeek -r "$CAPTURE_FILE" local
```

## References

- [Aircrack-ng Documentation](https://www.aircrack-ng.org/)
- [tcpdump Manual](https://www.tcpdump.org/papers/sniffing-faq.html)
- [Wireshark Documentation](https://www.wireshark.org/docs/)
- [Bettercap Project](https://www.bettercap.org/)
- [WSL2 Documentation](https://docs.microsoft.com/en-us/windows/wsl/)

---

**Version**: 1.0.0
**Last Updated**: 2024
**Maintainer**: WiFi Sentry Team
