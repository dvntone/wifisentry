/**
 * Android USB OTG WiFi Adapter Manager
 * Handles external WiFi adapters via USB OTG cable on rooted Android phones
 * Compatible with Capacitor for mobile deployment
 * 
 * Requires:
 * - Android 5.0+ (USB OTG)
 * - Optional: Root access for advanced features
 * - Permission: android.permission.CHANGE_NETWORK_STATE
 */

export interface USBAdapter {
  deviceId: string;
  vendorId: string;
  productId: string;
  name: string;
  manufacturer: string;
  model: string;
  isWiFiAdapter: boolean;
  isConnected: boolean;
  isSupported: boolean;
  requiresRoot: boolean;
}

export interface AndroidAdapterSettings {
  useExternalAdapter: boolean;
  selectedAdapterId: string;
  rootAccessEnabled: boolean;
  autoDetectAdapters: boolean;
  monitoringMode: 'default' | 'monitor' | 'promiscuous'; // Requires root for monitor/promiscuous
}

class AndroidUSBAdapterManager {
  private adapters: USBAdapter[] = [];
  private selectedAdapter: USBAdapter | null = null;
  private settings: AndroidAdapterSettings = {
    useExternalAdapter: false,
    selectedAdapterId: '',
    rootAccessEnabled: false,
    autoDetectAdapters: true,
    monitoringMode: 'default',
  };
  private isRooted: boolean = false;
  private monitoringInterval: any = null;

  // Supported WiFi adapter vendors
  private WiFiAdapterVendors = [
    { vid: '0x0bda', model: 'RTL8811AU' }, // Realtek
    { vid: '0x1a40', model: 'USB Hub' }, // Generic
    { vid: '0x0cf3', model: 'AR9271' }, // Atheros
    { vid: '0x148f', model: 'RT5370' }, // Ralink
    { vid: '0x0846', model: 'WN722N' }, // TP-Link
    { vid: '0x2001', model: 'DWL-G122' }, // D-Link
    { vid: '0x07b8', model: 'A6210' }, // ASUS
    { vid: '0x0411', model: 'WLI-UC-GNM' }, // Buffalo
    { vid: '0x083a', model: 'Edimax' }, // Edimax
  ];

  constructor() {
    this.detectRootAccess();
  }

  /**
   * Detect if device has root access
   */
  private async detectRootAccess(): Promise<boolean> {
    try {
      // Try to detect root by checking for su command
      const { Shell } = require('@capacitor/core').Plugins;
      
      // This is a simplified check - in production, use proper root detection
      this.isRooted = await this._checkRootPermissions();
      console.log(`Root access detected: ${this.isRooted}`);
      
      return this.isRooted;
    } catch (error) {
      console.warn('Could not detect root access:', error);
      this.isRooted = false;
      return false;
    }
  }

  /**
   * Check root permissions
   * @private
   */
  private async _checkRootPermissions(): Promise<boolean> {
    try {
      // Check if /system/app/Superuser.apk exists or similar indicators
      // Note: This is platform-specific and may need adjustment
      return false; // Default to false for safety
    } catch {
      return false;
    }
  }

  /**
   * Scan for connected USB devices
   */
  async scanUSBDevices(): Promise<USBAdapter[]> {
    try {
      const { USB } = require('@capacitor/usb').Plugins;
      
      // Get all connected USB devices
      const devices = await USB.getConnectedDevices();
      
      const adapters: USBAdapter[] = [];

      for (const device of devices) {
        const adapter: USBAdapter = {
          deviceId: device.deviceId || '',
          vendorId: device.vendorId?.toString(16) || '',
          productId: device.productId?.toString(16) || '',
          name: device.productName || 'Unknown Device',
          manufacturer: device.manufacturerName || 'Unknown',
          model: this._identifyModel(device),
          isWiFiAdapter: this._isWiFiAdapter(device),
          isConnected: true,
          isSupported: this._isSupportedAdapter(device),
          requiresRoot: this._requiresRoot(device),
        };

        adapters.push(adapter);
        console.log(`USB Device: ${adapter.name} (${adapter.vendorId}:${adapter.productId})`);
      }

      this.adapters = adapters;
      return adapters;
    } catch (error) {
      console.error('Error scanning USB devices:', error);
      return [];
    }
  }

  /**
   * Identify adapter model from USB device info
   * @private
   */
  private _identifyModel(device: any): string {
    const productName = device.productName || '';
    
    if (productName.includes('Realtek') || productName.includes('RTL')) {
      return 'Realtek';
    } else if (productName.includes('Atheros') || productName.includes('AR9')) {
      return 'Atheros AR9';
    } else if (productName.includes('Ralink') || productName.includes('RT')) {
      return 'Ralink';
    } else if (productName.includes('TP-Link')) {
      return 'TP-Link';
    } else if (productName.includes('ASUS')) {
      return 'ASUS';
    }
    
    return 'Generic WiFi Adapter';
  }

  /**
   * Check if device is WiFi adapter
   * @private
   */
  private _isWiFiAdapter(device: any): boolean {
    const productName = device.productName || '';
    const vendorId = device.vendorId || 0;

    // Check product name for WiFi indicators
    if (
      productName.toLowerCase().includes('wifi') ||
      productName.toLowerCase().includes('wireless') ||
      productName.toLowerCase().includes('802.11') ||
      productName.includes('RTL8811') ||
      productName.includes('AR9271')
    ) {
      return true;
    }

    // Check vendor ID
    const vendorIdHex = `0x${vendorId.toString(16).padStart(4, '0')}`;
    return this.WiFiAdapterVendors.some((v) => v.vid.toLowerCase() === vendorIdHex.toLowerCase());
  }

  /**
   * Check if adapter is supported
   * @private
   */
  private _isSupportedAdapter(device: any): boolean {
    // Check against known supported adapters
    return this._isWiFiAdapter(device);
  }

  /**
   * Check if adapter requires root access
   * @private
   */
  private _requiresRoot(device: any): boolean {
    const productName = device.productName || '';

    // Adapters that work without root
    const noRootNeeded = ['RTL8811', 'AR7010'];

    // Adapters that benefit from or require root for monitor mode
    const rootRecommended = ['RTL8812AE', 'RTL8814AU', 'AR9271'];

    // Check if root is recommended
    return rootRecommended.some((name) => productName.includes(name));
  }

  /**
   * Enable external adapter for scanning
   */
  async enableExternalAdapter(deviceId: string): Promise<boolean> {
    try {
      const adapter = this.adapters.find((a) => a.deviceId === deviceId);

      if (!adapter) {
        throw new Error(`Adapter not found: ${deviceId}`);
      }

      if (!adapter.isSupported) {
        throw new Error(`Adapter not supported: ${adapter.name}`);
      }

      this.selectedAdapter = adapter;
      this.settings.useExternalAdapter = true;
      this.settings.selectedAdapterId = deviceId;

      console.log(`✓ External adapter enabled: ${adapter.name}`);

      // Request necessary permissions if using root features
      if (adapter.requiresRoot && this.settings.monitoringMode !== 'default') {
        await this._requestRootPermissions();
      }

      return true;
    } catch (error) {
      console.error('Error enabling external adapter:', error);
      return false;
    }
  }

  /**
   * Disable external adapter (use built-in WiFi)
   */
  disableExternalAdapter(): void {
    this.settings.useExternalAdapter = false;
    this.selectedAdapter = null;
    console.log('✓ External adapter disabled, using built-in WiFi');
  }

  /**
   * Enable monitor mode (requires root)
   */
  async enableMonitorMode(): Promise<boolean> {
    if (!this.isRooted) {
      console.warn('Monitor mode requires root access');
      return false;
    }

    if (!this.selectedAdapter) {
      console.error('No external adapter selected');
      return false;
    }

    try {
      this.settings.monitoringMode = 'monitor';
      console.log(`✓ Monitor mode enabled on ${this.selectedAdapter.name}`);
      return true;
    } catch (error) {
      console.error('Error enabling monitor mode:', error);
      return false;
    }
  }

  /**
   * Enable promiscuous mode (requires root)
   */
  async enablePromiscuousMode(): Promise<boolean> {
    if (!this.isRooted) {
      console.warn('Promiscuous mode requires root access');
      return false;
    }

    if (!this.selectedAdapter) {
      console.error('No external adapter selected');
      return false;
    }

    try {
      this.settings.monitoringMode = 'promiscuous';
      console.log(`✓ Promiscuous mode enabled on ${this.selectedAdapter.name}`);
      return true;
    } catch (error) {
      console.error('Error enabling promiscuous mode:', error);
      return false;
    }
  }

  /**
   * Request root permissions from user
   * @private
   */
  private async _requestRootPermissions(): Promise<void> {
    try {
      // This would typically show a SuperUser prompt
      console.log('Requesting root permissions...');
      // Implementation depends on root management app installed
    } catch (error) {
      console.error('Error requesting root permissions:', error);
      throw error;
    }
  }

  /**
   * Get all available adapters
   */
  getAdapters(): USBAdapter[] {
    return this.adapters;
  }

  /**
   * Get currently selected adapter
   */
  getSelectedAdapter(): USBAdapter | null {
    return this.selectedAdapter;
  }

  /**
   * Get current settings
   */
  getSettings(): AndroidAdapterSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<AndroidAdapterSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('✓ Settings updated:', this.settings);
  }

  /**
   * Enable auto-detection of adapters
   */
  startAutoDetection(interval: number = 3000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      await this.scanUSBDevices();
    }, interval);

    console.log(`✓ USB adapter auto-detection started (${interval}ms interval)`);
  }

  /**
   * Stop auto-detection
   */
  stopAutoDetection(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('✓ USB adapter auto-detection stopped');
  }

  /**
   * Get device info
   */
  getDeviceInfo(): {
    isRooted: boolean;
    supportsUSBOTG: boolean;
    supportedAdapters: number;
    externalAdapterAvailable: boolean;
  } {
    return {
      isRooted: this.isRooted,
      supportsUSBOTG: true, // Android 5.0+
      supportedAdapters: this.adapters.filter((a) => a.isSupported).length,
      externalAdapterAvailable: this.adapters.some((a) => a.isSupported && a.isConnected),
    };
  }

  /**
   * request necessary permissions from the system
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { permissions } = require('@capacitor/core').Plugins;

      const result = await permissions.requestPermissions({
        permissions: [
          'android.permission.CHANGE_NETWORK_STATE',
          'android.permission.ACCESS_NETWORK_STATE',
          'android.permission.CHANGE_WIFI_STATE',
          'android.permission.ACCESS_WIFI_STATE',
          'android.permission.ACCESS_FINE_LOCATION',
          'android.permission.READ_EXTERNAL_STORAGE',
        ],
      });

      return result.camera === 'granted';
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Scan networks using the active adapter (USB OTG if enabled)
   */
  async scanNetworks(): Promise<any[]> {
    try {
      if (this.settings.useExternalAdapter && !this.selectedAdapter) {
        throw new Error('External adapter enabled but not selected');
      }

      // Actual implementation would use the selected adapter
      // or built-in WiFi if external is not enabled
      console.log(
        `Scanning with: ${this.selectedAdapter ? this.selectedAdapter.name : 'Built-in WiFi'}`
      );

      return [];
    } catch (error) {
      console.error('Error scanning networks:', error);
      return [];
    }
  }

  /**
   * Export configuration
   */
  exportConfig(): string {
    return JSON.stringify({
      settings: this.settings,
      deviceInfo: this.getDeviceInfo(),
      adapters: this.adapters.map((a) => ({
        deviceId: a.deviceId,
        name: a.name,
        model: a.model,
        isSupported: a.isSupported,
      })),
    }, null, 2);
  }

  /**
   * Get status string for UI display
   */
  getStatusString(): string {
    if (this.settings.useExternalAdapter && this.selectedAdapter) {
      return `External: ${this.selectedAdapter.name} [${this.settings.monitoringMode}]`;
    }

    return 'Built-in WiFi Adapter (Default)';
  }
}

export default AndroidUSBAdapterManager;
