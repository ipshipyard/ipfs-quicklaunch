import { App } from './types/index.js';
import { storage } from './storage/index.js';
import { AppFlag } from './components/AppFlag.js';

class PopupManager {
  private apps: App[] = [];
  private filteredApps: App[] = [];
  private appFlags: Map<string, AppFlag> = new Map();

  constructor() {
    this.init();
  }

  private async init() {
    await storage.init();
    await this.loadApps();
    this.setupEventListeners();
    this.render();
  }

  private async loadApps() {
    this.apps = await storage.getAllApps();
    this.filteredApps = [...this.apps];
  }

  private setupEventListeners() {
    const addButton = document.getElementById('addButton');
    const searchBox = document.getElementById('searchBox') as HTMLInputElement;
    const addAppModal = document.getElementById('addAppModal');
    const closeModal = document.getElementById('closeModal');
    const cancelButton = document.getElementById('cancelButton');
    const addAppForm = document.getElementById('addAppForm') as HTMLFormElement;

    addButton?.addEventListener('click', () => this.showAddModal());
    searchBox?.addEventListener('input', (e) => this.handleSearch((e.target as HTMLInputElement).value));
    closeModal?.addEventListener('click', () => this.hideAddModal());
    cancelButton?.addEventListener('click', () => this.hideAddModal());
    addAppForm?.addEventListener('submit', (e) => this.handleAddApp(e));

    // Close modal when clicking outside
    addAppModal?.addEventListener('click', (e) => {
      if (e.target === addAppModal) {
        this.hideAddModal();
      }
    });
  }

  private showAddModal() {
    const modal = document.getElementById('addAppModal');
    if (modal) {
      modal.style.display = 'block';
      const petnameInput = document.getElementById('petname') as HTMLInputElement;
      petnameInput?.focus();
    }
  }

  private hideAddModal() {
    const modal = document.getElementById('addAppModal');
    if (modal) {
      modal.style.display = 'none';
      this.resetForm();
    }
  }

  private resetForm() {
    const form = document.getElementById('addAppForm') as HTMLFormElement;
    form?.reset();
  }

  private handleSearch(query: string) {
    const searchTerm = query.toLowerCase();
    this.filteredApps = this.apps.filter(app => 
      app.petname.toLowerCase().includes(searchTerm) ||
      app.description?.toLowerCase().includes(searchTerm) ||
      app.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
      app.versions.some(version => 
        version.name.toLowerCase().includes(searchTerm) ||
        version.url.toLowerCase().includes(searchTerm) ||
        (version.cid && version.cid.toLowerCase().includes(searchTerm))
      )
    );
    this.render();
  }

  private async handleAddApp(e: Event) {
    e.preventDefault();
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const petname = formData.get('petname') as string;
    const url = formData.get('url') as string;
    const description = formData.get('description') as string;

    if (!petname || !url) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const newApp = await storage.createApp({
        petname,
        url,
        description: description || undefined
      });

      this.apps.push(newApp);
      this.filteredApps = [...this.apps];
      this.render();
      this.hideAddModal();
    } catch (error) {
      console.error('Failed to create app:', error);
      alert('Failed to create app. Please try again.');
    }
  }

  private async handleAppLaunch(app: App, versionId?: string) {
    let version = app.versions.find(v => v.isDefault) || app.versions[0];
    
    if (versionId) {
      version = app.versions.find(v => v.id === versionId) || version;
    }
    
    if (version) {
      try {
        await chrome.tabs.create({ url: version.url });
        await storage.updateLastUsed(app.id);
      } catch (error) {
        console.error('Failed to open app:', error);
      }
    }
  }

  private async handleAppEdit(app: App) {
    // TODO: Show edit app modal
    console.log('Edit app:', app.petname);
  }

  private async handleAppDelete(app: App) {
    try {
      await storage.deleteApp(app.id);
      await this.loadApps();
      this.render();
    } catch (error) {
      console.error('Failed to delete app:', error);
    }
  }

  private render() {
    const appGrid = document.getElementById('appGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (!appGrid || !emptyState) return;

    if (this.filteredApps.length === 0) {
      appGrid.style.display = 'none';
      emptyState.style.display = 'block';
    } else {
      appGrid.style.display = 'grid';
      emptyState.style.display = 'none';
      
      // Clear existing flags
      appGrid.innerHTML = '';
      this.appFlags.clear();
      
      // Create new app flags
      this.filteredApps.forEach(app => {
        const appFlag = new AppFlag(app, {
          onLaunch: (app, versionId) => this.handleAppLaunch(app, versionId),
          onEdit: (app) => this.handleAppEdit(app),
          onDelete: (app) => this.handleAppDelete(app)
        });
        
        this.appFlags.set(app.id, appFlag);
        appGrid.appendChild(appFlag.getElement());
      });
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});