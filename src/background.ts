import { storage } from './storage/index.js';
import { DNSLinkProbe } from './utils/dnslink.js';

class BackgroundManager {
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
        
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}

// Initialize background manager
new BackgroundManager();