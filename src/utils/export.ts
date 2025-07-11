import { AppStorage } from '../types/index.js';
import { storage } from '../storage/index.js';

export interface ExportData {
  version: string;
  exportDate: string;
  data: AppStorage;
}

export class ExportManager {
  private static readonly EXPORT_VERSION = '1.0.0';
  private static readonly FILE_NAME = 'ipfs-app-launcher-backup.json';

  static async exportData(): Promise<void> {
    try {
      const appStorage = await storage.getAllApps();
      const settings = await storage.getSettings();
      
      const exportData: ExportData = {
        version: this.EXPORT_VERSION,
        exportDate: new Date().toISOString(),
        data: {
          apps: appStorage.reduce((acc, app) => {
            acc[app.id] = app;
            return acc;
          }, {} as Record<string, any>),
          settings,
          gatewayConfig: await storage.getGatewayConfig(),
          dnslinkCache: await storage.getDNSLinkCache()
        }
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = this.FILE_NAME;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
      throw new Error('Failed to export data. Please try again.');
    }
  }

  static async importData(file: File): Promise<{ success: boolean; message: string; appsImported?: number }> {
    try {
      const fileContent = await this.readFile(file);
      const exportData = JSON.parse(fileContent) as ExportData;

      // Validate export data structure
      if (!this.isValidExportData(exportData)) {
        return {
          success: false,
          message: 'Invalid backup file format. Please select a valid backup file.'
        };
      }

      // Check version compatibility
      if (!this.isCompatibleVersion(exportData.version)) {
        return {
          success: false,
          message: `Backup file version (${exportData.version}) is not compatible with current version.`
        };
      }

      // Import data
      const importResult = await this.performImport(exportData.data);
      
      return {
        success: true,
        message: `Successfully imported ${importResult.appsImported} apps and settings.`,
        appsImported: importResult.appsImported
      };
    } catch (error) {
      console.error('Failed to import data:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import data. Please check the file format.'
      };
    }
  }

  private static readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  }

  private static isValidExportData(data: any): data is ExportData {
    return (
      data &&
      typeof data.version === 'string' &&
      typeof data.exportDate === 'string' &&
      data.data &&
      typeof data.data.apps === 'object' &&
      data.data.settings
    );
  }

  private static isCompatibleVersion(version: string): boolean {
    // For now, accept version 1.x.x
    return version.startsWith('1.');
  }

  private static async performImport(importData: AppStorage): Promise<{ appsImported: number }> {
    try {
      // Get current data
      const currentApps = await storage.getAllApps();
      const currentAppsMap = currentApps.reduce((acc, app) => {
        acc[app.id] = app;
        return acc;
      }, {} as Record<string, any>);

      // Merge imported apps (avoid duplicates by ID)
      const importedApps = Object.values(importData.apps);
      let appsImported = 0;

      for (const app of importedApps) {
        if (!currentAppsMap[app.id]) {
          // Ensure timestamps are numbers (backward compatibility)
          if (typeof app.createdAt === 'string') {
            app.createdAt = new Date(app.createdAt).getTime();
          }
          if (typeof app.lastUsed === 'string') {
            app.lastUsed = new Date(app.lastUsed).getTime();
          }
          app.versions.forEach(version => {
            if (typeof version.createdAt === 'string') {
              version.createdAt = new Date(version.createdAt).getTime();
            }
          });

          await storage.createApp({
            petname: app.petname,
            cid: app.versions.find(v => v.isDefault)?.cid || app.versions[0]?.cid || '',
            description: app.description,
            tags: app.tags,
            versionName: app.versions.find(v => v.isDefault)?.name || app.versions[0]?.name
          });

          // Add additional versions if any
          const additionalVersions = app.versions.filter(v => !v.isDefault);
          for (const version of additionalVersions) {
            await storage.createVersion({
              appId: app.id,
              name: version.name,
              cid: version.cid,
              hash: version.hash,
              makeDefault: false
            });
          }

          appsImported++;
        }
      }

      // Update settings (merge with current settings)
      if (importData.settings) {
        await storage.updateSettings(importData.settings);
      }

      // Import DNSLink cache if present
      if (importData.dnslinkCache) {
        const dnslinkEntries = Object.values(importData.dnslinkCache);
        for (const entry of dnslinkEntries) {
          await storage.updateDNSLinkCache(entry.domain, entry.lastCID, entry.associatedAppId);
        }
      }

      return { appsImported };
    } catch (error) {
      console.error('Error during import:', error);
      throw new Error('Failed to import data into storage');
    }
  }

  static createImportInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    return input;
  }
}