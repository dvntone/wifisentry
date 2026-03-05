# Android Development Cheatsheet for WiFi Sentry

This guide provides a consolidated reference for the specific Android APIs used in this project, with a focus on version-specific differences between Android 12 (API 31) and Android 15 (API 35).

---

## 🎯 Project Target Environment
- **Minimum SDK:** 31 (Android 12)
- **Target SDK:** 35 (Android 15)
- **Compile SDK:** 35
- **Build System:** Gradle (JDK 17)

---

## 🛰️ Wi-Fi Scanning (WifiManager)

### Key Classes
- `android.net.wifi.WifiManager`
- `android.net.wifi.ScanResult`
- `android.content.BroadcastReceiver`

### Permission Logic (API 31 vs 35)

| Version | Core Permission | Location Service | Context |
|---------|-----------------|------------------|---------|
| **Android 12 (API 31)** | `ACCESS_FINE_LOCATION` | Required (ON) | Legacy flow, results via Broadcast. |
| **Android 13+ (API 33)** | `NEARBY_WIFI_DEVICES` | **Not Required** | Only if using `neverForLocation` flag. |
| **Android 15 (API 35)** | `ACCESS_FINE_LOCATION` | Required (ON) | **Still required for scanning SSIDs.** Stricter enforcement. |

### Implementation Snippet (Modern Scanning)
```java
// Register Receiver
IntentFilter filter = new IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION);
context.registerReceiver(wifiReceiver, filter);

// Start Scan (Note: startScan() is deprecated but still works for now)
boolean success = wifiManager.startScan();
if (!success) {
    // Scan was throttled or failed
    List<ScanResult> results = wifiManager.getScanResults(); // Get old results
}
```

---

## 🔒 Permissions & Security

### Manifest Declarations
```xml
<!-- Required for Scanning (Must include both for maximum compatibility) -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Required for WiFi State -->
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />

<!-- Android 13+ Connectivity (Optional but recommended) -->
<uses-permission 
    android:name="android.permission.NEARBY_WIFI_DEVICES" 
    android:usesPermissionFlags="neverForLocation" />
```

### Android 15 Specifics
- **Restricted Settings:** If sideloaded, the user may need to "Allow restricted settings" in App Info before sensitive permissions can be toggled.
- **Background Location:** Requires a foreground service. Request foreground location *first*, then background.

---

## 🛠️ Foreground Services (Android 14/15)

In Android 14+, you **must** specify a service type in the manifest:
```xml
<service
    android:name=".services.ScanService"
    android:foregroundServiceType="specialUse" /> <!-- Or 'location' if tracking GPS -->
```

### Android 15 Timeout
- **6-Hour Limit:** Services of type `dataSync` and `mediaProcessing` now have a 6-hour execution timeout. For persistent background scanning, use a `WorkManager` or a properly categorized foreground service.

---

## 📡 Hardware & OUI Checks (Threat Detection)

### Locally Administered Bit
A BSSID (MAC address) is likely spoofed if the second character of the first octet is `2, 6, A, or E`.
- Example: `x2:xx:xx...`, `x6:xx:xx...`, `xA:xx:xx...`, `xE:xx:xx...`

### OUI Lookups
Native code should check the first 3 octets (e.g., `00:03:93`) against the `oui.txt` file included in the project assets.

---

## 🧪 Testing (Gradle)
- **Unit Tests:** `./gradlew :core:test`
- **Connected Tests:** `./gradlew :app:connectedAndroidTest`
- **Build APK:** `./gradlew assembleDebug`

---

## 📚 References
- [Android 15 Developer Documentation](https://developer.android.com/about/versions/15)
- [WifiManager API Reference](https://developer.android.com/reference/android/net/wifi/WifiManager)
- [Foreground Service Types](https://developer.android.com/about/versions/14/changes/fgs-types-required)
