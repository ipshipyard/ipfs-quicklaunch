import { storage } from './storage/index.js';
import { DNSLinkProbe } from './utils/dnslink.js';

class BackgroundManager {
  private defaultIcon = {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png'
  };

  constructor() {
    this.init();
  }

  private async init() {
    await storage.init();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener(async (details) => {
      if (details.reason === 'install') {
        console.log('App Launcher extension installed');
        // Initialize storage with default settings
        await storage.init();
      }
    });

    // Handle extension startup
    chrome.runtime.onStartup.addListener(async () => {
      console.log('App Launcher extension started');
      await storage.init();
    });

    // Handle messages from popup or content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Handle tab updates for DNSLink detection
    chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        await this.checkTabForDNSLink(tab);
      }
    });

    // Handle tab activation to update icon
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab.url) {
        await this.checkTabForDNSLink(tab);
      }
    });
  }

  private async handleMessage(request: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    try {
      switch (request.type) {
        case 'GET_APPS':
          const apps = await storage.getAllApps();
          sendResponse({ success: true, data: apps });
          break;
        
        case 'CREATE_APP':
          const newApp = await storage.createApp(request.data);
          sendResponse({ success: true, data: newApp });
          break;
        
        case 'UPDATE_APP':
          const updatedApp = await storage.updateApp(request.data);
          sendResponse({ success: true, data: updatedApp });
          break;
        
        case 'DELETE_APP':
          const deleted = await storage.deleteApp(request.data.id);
          sendResponse({ success: true, data: deleted });
          break;
        
        case 'CREATE_VERSION':
          const appWithNewVersion = await storage.createVersion(request.data);
          sendResponse({ success: true, data: appWithNewVersion });
          break;
        
        case 'UPDATE_LAST_USED':
          await storage.updateLastUsed(request.data.appId);
          sendResponse({ success: true });
          break;
        
        case 'GET_SETTINGS':
          const settings = await storage.getSettings();
          sendResponse({ success: true, data: settings });
          break;
        
        case 'UPDATE_SETTINGS':
          const updatedSettings = await storage.updateSettings(request.data);
          sendResponse({ success: true, data: updatedSettings });
          break;
        
        case 'CHECK_DNSLINK':
          try {
            const result = await DNSLinkProbe.probe(request.data.domain);
            sendResponse({ success: true, data: result });
          } catch (error) {
            sendResponse({ success: false, error: error instanceof Error ? error.message : 'DNSLink check failed' });
          }
          break;
        
        case 'GET_CURRENT_TAB':
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.url) {
              const url = new URL(tabs[0].url);
              sendResponse({ success: true, data: { domain: url.hostname, url: tabs[0].url } });
            } else {
              sendResponse({ success: false, error: 'No active tab found' });
            }
          } catch (error) {
            sendResponse({ success: false, error: error instanceof Error ? error.message : 'Failed to get current tab' });
          }
          break;
        
        
        case 'IPFS_PATH_DETECTED':
          // Content script detected IPFS path header
          console.log('IPFS path detected:', request.data);
          // We could store this information or trigger notifications here
          sendResponse({ success: true });
          break;
        
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Check tab for DNSLink and update extension icon accordingly
   */
  private async checkTabForDNSLink(tab: chrome.tabs.Tab): Promise<void> {
    if (!tab.url || !tab.id) return;

    try {
      const url = new URL(tab.url);
      
      // Skip non-web URLs
      if (!url.hostname || url.protocol !== 'https:' && url.protocol !== 'http:') {
        await this.setDefaultIcon(tab.id);
        return;
      }

      // Check for DNSLink and x-ipfs-path
      const dnslinkResult = await DNSLinkProbe.probe(url.hostname);
      
      if (dnslinkResult.hasDNSLink || dnslinkResult.hasIPFSPath) {
        await this.setDNSLinkIcon(tab.id);
        
        // Update action badge based on detection method
        const badgeIcon = dnslinkResult.detectionMethod === 'x-ipfs-path' ? '📁' : '🔗';
        await chrome.action.setBadgeText({
          text: badgeIcon,
          tabId: tab.id
        });
        
        await chrome.action.setBadgeBackgroundColor({
          color: '#3498db',
          tabId: tab.id
        });
        
        // Update title based on detection method
        const detectionType = dnslinkResult.detectionMethod === 'x-ipfs-path' ? 'IPFS content' : 'DNSLink';
        await chrome.action.setTitle({
          title: `IPFS App Launcher - ${detectionType} detected on ${url.hostname}`,
          tabId: tab.id
        });
      } else {
        await this.setDefaultIcon(tab.id);
        await chrome.action.setBadgeText({
          text: '',
          tabId: tab.id
        });
        
        await chrome.action.setTitle({
          title: 'IPFS App Launcher',
          tabId: tab.id
        });
      }
    } catch (error) {
      console.error('Error checking tab for DNSLink:', error);
      if (tab.id) {
        await this.setDefaultIcon(tab.id);
      }
    }
  }

  /**
   * Set default extension icon
   */
  private async setDefaultIcon(tabId: number): Promise<void> {
    try {
      await chrome.action.setIcon({
        path: this.defaultIcon,
        tabId
      });
    } catch (error) {
      console.error('Failed to set default icon:', error);
    }
  }

  /**
   * Set DNSLink detected icon (highlighted version)
   */
  private async setDNSLinkIcon(tabId: number): Promise<void> {
    try {
      // For now, we'll use the same icon but with badge
      // In the future, we could create special "highlighted" versions
      await chrome.action.setIcon({
        path: this.defaultIcon,
        tabId
      });
    } catch (error) {
      console.error('Failed to set DNSLink icon:', error);
    }
  }
}

// Initialize background manager
new BackgroundManager();