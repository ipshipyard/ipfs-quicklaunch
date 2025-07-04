import { App } from './types/index.js';
import { storage } from './storage/index.js';
import { AppFlag } from './components/AppFlag.js';
import { themeManager, Theme } from './utils/theme.js';
import { ExportManager } from './utils/export.js';

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
    this.initializeTheme();
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
    const themeToggle = document.getElementById('themeToggle');
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModal = document.getElementById('closeSettingsModal');
    const exportButton = document.getElementById('exportButton');
    const importButton = document.getElementById('importButton');
    const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;

    addButton?.addEventListener('click', () => this.showAddModal());
    searchBox?.addEventListener('input', (e) => this.handleSearch((e.target as HTMLInputElement).value));
    closeModal?.addEventListener('click', () => this.hideAddModal());
    cancelButton?.addEventListener('click', () => this.hideAddModal());
    addAppForm?.addEventListener('submit', (e) => this.handleAddApp(e));
    themeToggle?.addEventListener('click', () => this.toggleTheme());
    settingsButton?.addEventListener('click', () => this.showSettingsModal());
    closeSettingsModal?.addEventListener('click', () => this.hideSettingsModal());
    exportButton?.addEventListener('click', () => this.handleExport());
    importButton?.addEventListener('click', () => this.handleImport());
    themeSelect?.addEventListener('change', (e) => this.handleThemeChange((e.target as HTMLSelectElement).value as Theme));

    // Close modal when clicking outside
    addAppModal?.addEventListener('click', (e) => {
      if (e.target === addAppModal) {
        this.hideAddModal();
      }
    });

    settingsModal?.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        this.hideSettingsModal();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
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

  private initializeTheme(): void {
    themeManager.setupSystemThemeListener();
    this.updateThemeToggleIcon();
  }

  private toggleTheme(): void {
    const currentTheme = themeManager.getTheme();
    const themes: Theme[] = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    
    themeManager.setTheme(nextTheme);
    this.updateThemeToggleIcon();
  }

  private updateThemeToggleIcon(): void {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    const currentTheme = themeManager.getTheme();
    const icons = {
      light: '🌙',
      dark: '☀️',
      auto: '🌓'
    };
    
    themeToggle.textContent = icons[currentTheme];
    themeToggle.title = `Current theme: ${currentTheme}. Click to switch.`;
  }

  private showSettingsModal(): void {
    const settingsModal = document.getElementById('settingsModal');
    const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
    
    if (settingsModal && themeSelect) {
      // Update theme select to current value
      themeSelect.value = themeManager.getTheme();
      settingsModal.style.display = 'block';
    }
  }

  private hideSettingsModal(): void {
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
      settingsModal.style.display = 'none';
    }
  }

  private handleThemeChange(theme: Theme): void {
    themeManager.setTheme(theme);
    this.updateThemeToggleIcon();
  }

  private async handleExport(): Promise<void> {
    try {
      await ExportManager.exportData();
      // Show success message
      this.showTemporaryMessage('Data exported successfully!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showTemporaryMessage('Failed to export data. Please try again.', 'error');
    }
  }

  private async handleImport(): Promise<void> {
    const input = ExportManager.createImportInput();
    document.body.appendChild(input);

    input.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      
      if (file) {
        try {
          const result = await ExportManager.importData(file);
          
          if (result.success) {
            this.showTemporaryMessage(result.message, 'success');
            // Reload apps after import
            await this.loadApps();
            this.render();
          } else {
            this.showTemporaryMessage(result.message, 'error');
          }
        } catch (error) {
          console.error('Import failed:', error);
          this.showTemporaryMessage('Failed to import data. Please try again.', 'error');
        }
      }
      
      document.body.removeChild(input);
    });

    input.click();
  }

  private showTemporaryMessage(message: string, type: 'success' | 'error'): void {
    const messageEl = document.createElement('div');
    messageEl.className = `temporary-message ${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      z-index: 10000;
      max-width: 300px;
      background: ${type === 'success' ? 'var(--success)' : 'var(--danger)'};
      box-shadow: 0 4px 12px var(--shadow-light);
    `;

    document.body.appendChild(messageEl);

    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 3000);
  }

  private handleKeyboardShortcuts(e: KeyboardEvent): void {
    // Cmd/Ctrl + N: Add new app
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      this.showAddModal();
      return;
    }

    // Cmd/Ctrl + S: Open settings
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      this.showSettingsModal();
      return;
    }

    // Escape: Close any open modal
    if (e.key === 'Escape') {
      const addModal = document.getElementById('addAppModal');
      const settingsModal = document.getElementById('settingsModal');
      
      if (addModal?.style.display === 'block') {
        this.hideAddModal();
      } else if (settingsModal?.style.display === 'block') {
        this.hideSettingsModal();
      }
      return;
    }

    // Cmd/Ctrl + F: Focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      const searchBox = document.getElementById('searchBox') as HTMLInputElement;
      searchBox?.focus();
      return;
    }

    // Cmd/Ctrl + T: Toggle theme
    if ((e.metaKey || e.ctrlKey) && e.key === 't') {
      e.preventDefault();
      this.toggleTheme();
      return;
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});