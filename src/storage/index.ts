import { App, AppStorage, CreateAppRequest, CreateVersionRequest, UpdateAppRequest, UserSettings } from '../types/index.js';
import { IPFSUtils } from '../utils/ipfs.js';

const STORAGE_KEY = 'app_launcher_data';

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
      }
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
    const now = new Date();
    const appId = this.generateId();
    const versionId = this.generateId();

    const app: App = {
      id: appId,
      petname: request.petname,
      description: request.description,
      icon: undefined,
      versions: [{
        id: versionId,
        name: request.versionName || 'Default',
        url: request.url,
        cid: IPFSUtils.extractCIDFromUrl(request.url) || undefined,
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

    if (request.petname !== undefined) app.petname = request.petname;
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
      url: request.url,
      cid: request.cid || IPFSUtils.extractCIDFromUrl(request.url) || undefined,
      hash: request.hash,
      isDefault: request.makeDefault || false,
      createdAt: new Date()
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
      app.lastUsed = new Date();
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

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export const storage = StorageManager.getInstance();