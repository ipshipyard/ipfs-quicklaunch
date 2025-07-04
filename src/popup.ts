import { App } from './types';
import { storage } from './storage';

class PopupManager {
  private apps: App[] = [];
  private filteredApps: App[] = [];

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
      app.tags.some(tag => tag.toLowerCase().includes(searchTerm))
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

  private async handleAppClick(app: App) {
    const defaultVersion = app.versions.find(v => v.isDefault) || app.versions[0];
    if (defaultVersion) {
      try {
        await chrome.tabs.create({ url: defaultVersion.url });
        await storage.updateLastUsed(app.id);
      } catch (error) {
        console.error('Failed to open app:', error);
      }
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
      
      appGrid.innerHTML = this.filteredApps.map(app => this.renderAppFlag(app)).join('');
      
      // Add click listeners to app flags
      this.filteredApps.forEach(app => {
        const flagElement = document.getElementById(`app-${app.id}`);
        flagElement?.addEventListener('click', () => this.handleAppClick(app));
      });
    }
  }

  private renderAppFlag(app: App): string {
    const iconLetter = app.petname.charAt(0).toUpperCase();
    const versionCount = app.versions.length;
    const versionText = versionCount > 1 ? ` (${versionCount} versions)` : '';
    
    return `
      <div class="app-flag" id="app-${app.id}" title="${app.description || app.petname}${versionText}">
        <div class="app-icon">${iconLetter}</div>
        <div class="app-name">${app.petname}</div>
      </div>
    `;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});