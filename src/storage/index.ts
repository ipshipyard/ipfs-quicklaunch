import { App, AppStorage, CreateAppRequest, CreateVersionRequest, UpdateAppRequest, UserSettings, GatewayConfig, DNSLinkCacheEntry } from '../types/index.js';
import { LocalGatewayProbe } from '../utils/localGateway.js';

const STORAGE_KEY = 'ipfs_spark_data';

export class StorageManager {
  private static instance: StorageManager;
  private cache: AppStorage | null = null;

  private constructor() {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  async init(): Promise<void> {
    const data = await this.load();
    this.cache = data;
  }

  private async load(): Promise<AppStorage> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] || this.getDefaultStorage();
    } catch (error) {
      console.error('Failed to load storage:', error);
      return this.getDefaultStorage();
    }
  }

  private async save(data: AppStorage): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: data });
      this.cache = data;
    } catch (error) {
      console.error('Failed to save storage:', error);
      throw error;
    }
  }

  private getDefaultStorage(): AppStorage {
    return {
      apps: {},
      settings: {
        theme: 'light',
        viewMode: 'grid',
        defaultVersionBehavior: 'launch'
      },
      gatewayConfig: {
        defaultGateway: 'inbrowser.link',
        customGateways: [
          'dweb.link',
          'inbrowser.link',
          'inbrowser.dev'
        ],
        preferLocalGateway: false,
        localGatewayUrl: 'http://localhost:8080'
      },
      dnslinkCache: {}
    };
  }

  async getAllApps(): Promise<App[]> {
    const data = this.cache || await this.load();
    return Object.values(data.apps);
  }

  async getApp(id: string): Promise<App | null> {
    const data = this.cache || await this.load();
    return data.apps[id] || null;
  }

  async createApp(request: CreateAppRequest): Promise<App> {
    const data = this.cache || await this.load();
    const now = Date.now();
    const appId = this.generateId();
    const versionId = this.generateId();

    const app: App = {
      id: appId,
      nickname: request.nickname,
      description: request.description,
      icon: undefined,
      versions: [{
        id: versionId,
        name: request.versionName || 'Default',
        cid: request.cid,
        hash: undefined,
        isDefault: true,
        createdAt: now
      }],
      tags: request.tags || [],
      createdAt: now,
      lastUsed: now
    };

    data.apps[appId] = app;
    await this.save(data);
    return app;
  }

  async updateApp(request: UpdateAppRequest): Promise<App | null> {
    const data = this.cache || await this.load();
    const app = data.apps[request.id];
    
    if (!app) {
      return null;
    }

    if (request.nickname !== undefined) app.nickname = request.nickname;
    if (request.description !== undefined) app.description = request.description;
    if (request.tags !== undefined) app.tags = request.tags;

    await this.save(data);
    return app;
  }

  async deleteApp(id: string): Promise<boolean> {
    const data = this.cache || await this.load();
    
    if (!data.apps[id]) {
      return false;
    }

    delete data.apps[id];
    await this.save(data);
    return true;
  }

  async createVersion(request: CreateVersionRequest): Promise<App | null> {
    const data = this.cache || await this.load();
    const app = data.apps[request.appId];
    
    if (!app) {
      return null;
    }

    const versionId = this.generateId();
    const newVersion = {
      id: versionId,
      name: request.name,
      cid: request.cid,
      hash: request.hash,
      isDefault: request.makeDefault || false,
      createdAt: Date.now()
    };

    if (request.makeDefault) {
      app.versions.forEach(v => v.isDefault = false);
    }

    app.versions.push(newVersion);
    await this.save(data);
    return app;
  }

  async updateLastUsed(appId: string): Promise<void> {
    const data = this.cache || await this.load();
    const app = data.apps[appId];
    
    if (app) {
      app.lastUsed = Date.now();
      await this.save(data);
    }
  }

  async getSettings(): Promise<UserSettings> {
    const data = this.cache || await this.load();
    return data.settings;
  }

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const data = this.cache || await this.load();
    data.settings = { ...data.settings, ...settings };
    await this.save(data);
    return data.settings;
  }

  async getGatewayConfig(): Promise<GatewayConfig> {
    const data = this.cache || await this.load();
    return data.gatewayConfig;
  }

  async updateGatewayConfig(config: Partial<GatewayConfig>): Promise<GatewayConfig> {
    const data = this.cache || await this.load();
    data.gatewayConfig = { ...data.gatewayConfig, ...config };
    await this.save(data);
    return data.gatewayConfig;
  }

  async buildUrl(cid: string): Promise<string> {
    const gatewayConfig = await this.getGatewayConfig();
    
    // Check if local gateway should be preferred and is available
    if (gatewayConfig.preferLocalGateway) {
      const localGatewayResult = await LocalGatewayProbe.probe();
      if (localGatewayResult.isAvailable) {
        return LocalGatewayProbe.buildLocalUrl(cid);
      }
    }
    
    const gateway = gatewayConfig.defaultGateway;
    
    // Check if it's a legacy path-based gateway format
    if (gateway.includes('/ipfs/')) {
      // Legacy format: https://gateway.com/ipfs/
      return `${gateway}${cid}`;
    }
    
    // Modern subdomain format: https://cid.ipfs.gateway.com
    const baseGateway = gateway.startsWith('http') ? gateway : `https://${gateway}`;
    const gatewayHost = new URL(baseGateway).hostname;
    return `https://${cid}.ipfs.${gatewayHost}`;
  }

  async getDNSLinkCache(): Promise<Record<string, DNSLinkCacheEntry>> {
    const data = this.cache || await this.load();
    return data.dnslinkCache || {};
  }

  async updateDNSLinkCache(domain: string, cid: string, appId?: string): Promise<void> {
    const data = this.cache || await this.load();
    if (!data.dnslinkCache) {
      data.dnslinkCache = {};
    }
    
    data.dnslinkCache[domain] = {
      domain,
      lastCID: cid,
      lastChecked: Date.now(),
      associatedAppId: appId
    };
    
    await this.save(data);
  }

  async getDNSLinkEntry(domain: string): Promise<DNSLinkCacheEntry | null> {
    const cache = await this.getDNSLinkCache();
    return cache[domain] || null;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export const storage = StorageManager.getInstance();