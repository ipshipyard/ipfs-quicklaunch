import { App } from './types/index.js';
import { storage } from './storage/index.js';
import { AppFlag } from './components/AppFlag.js';
import { themeManager, Theme } from './utils/theme.js';
import { ExportManager } from './utils/export.js';
import { formStateManager } from './utils/formState.js';

class PopupManager {
  private apps: App[] = [];
  private filteredApps: App[] = [];
  private appFlags: Map<string, AppFlag> = new Map();
  private formCleanupFunctions: Map<string, () => void> = new Map();
  private currentEditApp: App | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    await storage.init();
    await this.loadApps();
    this.setupEventListeners();
    this.initializeTheme();
    this.setupTooltips();
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
    const editAppModal = document.getElementById('editAppModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const cancelEditButton = document.getElementById('cancelEditButton');
    const editAppForm = document.getElementById('editAppForm') as HTMLFormElement;

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
    closeEditModal?.addEventListener('click', () => this.hideEditModal());
    cancelEditButton?.addEventListener('click', () => this.hideEditModal());
    editAppForm?.addEventListener('submit', (e) => this.handleEditApp(e));

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

    editAppModal?.addEventListener('click', (e) => {
      if (e.target === editAppModal) {
        this.hideEditModal();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
  }

  private async showAddModal() {
    const modal = document.getElementById('addAppModal');
    const form = document.getElementById('addAppForm') as HTMLFormElement;
    
    if (modal && form) {
      modal.style.display = 'block';
      
      // Restore form state if exists
      await this.restoreFormState('addAppForm', form);
      
      // Set up auto-save for this form
      this.setupFormAutoSave('addAppForm', form);
      
      const petnameInput = document.getElementById('petname') as HTMLInputElement;
      petnameInput?.focus();
    }
  }

  private hideAddModal() {
    const modal = document.getElementById('addAppModal');
    if (modal) {
      modal.style.display = 'none';
      this.cleanupFormAutoSave('addAppForm');
      this.resetForm();
    }
  }

  private async resetForm() {
    const form = document.getElementById('addAppForm') as HTMLFormElement;
    if (form) {
      form.reset();
      // Clear saved form state
      await formStateManager.clearFormState('addAppForm');
    }
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
      
      // Clear form state on successful submission
      await formStateManager.clearFormState('addAppForm');
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
    this.currentEditApp = app;
    await this.showEditModal();
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

  private async showEditModal(): Promise<void> {
    if (!this.currentEditApp) return;
    
    const modal = document.getElementById('editAppModal');
    const form = document.getElementById('editAppForm') as HTMLFormElement;
    
    if (modal && form) {
      modal.style.display = 'block';
      
      // Populate form with current app data
      const petnameInput = document.getElementById('editPetname') as HTMLInputElement;
      const descriptionInput = document.getElementById('editDescription') as HTMLInputElement;
      
      if (petnameInput) petnameInput.value = this.currentEditApp.petname;
      if (descriptionInput) descriptionInput.value = this.currentEditApp.description || '';
      
      // Set up auto-save for this form
      this.setupFormAutoSave('editAppForm', form);
      
      petnameInput?.focus();
    }
  }

  private hideEditModal(): void {
    const modal = document.getElementById('editAppModal');
    if (modal) {
      modal.style.display = 'none';
      this.cleanupFormAutoSave('editAppForm');
      this.currentEditApp = null;
    }
  }

  private async handleEditApp(e: Event): Promise<void> {
    e.preventDefault();
    
    if (!this.currentEditApp) return;
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const petname = formData.get('petname') as string;
    const description = formData.get('description') as string;

    if (!petname) {
      alert('Please fill in the app name');
      return;
    }

    try {
      const updatedApp = await storage.updateApp({
        id: this.currentEditApp.id,
        petname,
        description: description || undefined
      });

      if (updatedApp) {
        // Update the app in our local arrays
        const appIndex = this.apps.findIndex(app => app.id === updatedApp.id);
        if (appIndex !== -1) {
          this.apps[appIndex] = updatedApp;
          this.filteredApps = [...this.apps];
        }
        
        this.render();
        
        // Clear form state on successful submission
        await formStateManager.clearFormState('editAppForm');
        this.hideEditModal();
        
        this.showTemporaryMessage('App updated successfully!', 'success');
      }
    } catch (error) {
      console.error('Failed to update app:', error);
      alert('Failed to update app. Please try again.');
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
      } else {
        const editModal = document.getElementById('editAppModal');
        if (editModal?.style.display === 'block') {
          this.hideEditModal();
        }
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

  /**
   * Restore form state from storage
   */
  private async restoreFormState(formId: string, form: HTMLFormElement): Promise<void> {
    try {
      const savedData = await formStateManager.loadFormState(formId);
      if (savedData) {
        formStateManager.restoreFormData(form, savedData);
        // Show indication that draft was restored
        this.showTemporaryMessage('Draft restored', 'success');
      }
    } catch (error) {
      console.error('Failed to restore form state:', error);
    }
  }

  /**
   * Set up auto-save for a form
   */
  private setupFormAutoSave(formId: string, form: HTMLFormElement): void {
    // Clean up any existing auto-save first
    this.cleanupFormAutoSave(formId);
    
    // Set up new auto-save
    const cleanup = formStateManager.setupAutoSave(form, formId);
    this.formCleanupFunctions.set(formId, cleanup);

    // Listen for save events to show user feedback
    const handleSave = (event: CustomEvent) => {
      if (event.detail.formId === formId) {
        this.showSaveIndicator();
      }
    };

    document.addEventListener('formStateSaved', handleSave as EventListener);
    
    // Store the event listener cleanup as well
    const originalCleanup = cleanup;
    this.formCleanupFunctions.set(formId, () => {
      originalCleanup();
      document.removeEventListener('formStateSaved', handleSave as EventListener);
    });
  }

  /**
   * Clean up form auto-save
   */
  private cleanupFormAutoSave(formId: string): void {
    const cleanup = this.formCleanupFunctions.get(formId);
    if (cleanup) {
      cleanup();
      this.formCleanupFunctions.delete(formId);
    }
  }

  /**
   * Show visual indicator that form was auto-saved
   */
  private showSaveIndicator(): void {
    const indicator = document.createElement('div');
    indicator.textContent = '💾 Draft saved';
    indicator.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      padding: 8px 12px;
      background: var(--success);
      color: white;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10001;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    document.body.appendChild(indicator);

    // Animate in
    requestAnimationFrame(() => {
      indicator.style.opacity = '1';
    });

    // Animate out and remove
    setTimeout(() => {
      indicator.style.opacity = '0';
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
      }, 300);
    }, 1500);
  }

  private setupTooltips(): void {
    // Use event delegation to handle tooltips for dynamically created elements
    document.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement;
      if (target.hasAttribute('title')) {
        this.showTooltip(target);
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target as HTMLElement;
      // Check for elements that have active tooltips (title was moved to data-original-title)
      if (target.hasAttribute('title') || target.hasAttribute('data-original-title')) {
        this.hideTooltip(target);
      }
    });

    // Fallback: Global mouseleave cleanup for any orphaned tooltips
    document.addEventListener('mouseleave', () => {
      this.cleanupAllTooltips();
    });
  }

  private showTooltip(element: HTMLElement): void {
    const title = element.getAttribute('title');
    if (!title) return;

    // Check if tooltip already exists for this element
    const existingTooltipId = element.getAttribute('data-tooltip-id');
    if (existingTooltipId) {
      const existingTooltip = document.querySelector(`[data-tooltip-for="${existingTooltipId}"]`);
      if (existingTooltip) {
        return; // Tooltip already exists, don't create another
      }
    }

    // Remove the title attribute to prevent default tooltip
    element.removeAttribute('title');
    element.setAttribute('data-original-title', title);

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip-text';
    tooltip.textContent = title;
    tooltip.style.visibility = 'visible';
    tooltip.style.opacity = '1';

    document.body.appendChild(tooltip);

    // Position tooltip
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Position above the element by default
    let top = rect.top - tooltipRect.height - 8;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    
    // Adjust if tooltip goes outside viewport
    if (left < 8) {
      left = 8;
    } else if (left + tooltipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8;
    }
    
    // If tooltip goes above viewport, position below
    if (top < 8) {
      top = rect.bottom + 8;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    // Store reference for cleanup
    const tooltipId = Date.now().toString();
    element.setAttribute('data-tooltip-id', tooltipId);
    tooltip.setAttribute('data-tooltip-for', tooltipId);
  }

  private hideTooltip(element: HTMLElement): void {
    // Restore original title
    const originalTitle = element.getAttribute('data-original-title');
    if (originalTitle) {
      element.setAttribute('title', originalTitle);
      element.removeAttribute('data-original-title');
    }

    // Remove tooltip element
    const tooltipId = element.getAttribute('data-tooltip-id');
    if (tooltipId) {
      const tooltip = document.querySelector(`[data-tooltip-for="${tooltipId}"]`);
      if (tooltip) {
        tooltip.remove();
      }
      element.removeAttribute('data-tooltip-id');
    }

    // Clean up any orphaned tooltips (fallback safety measure)
    this.cleanupOrphanedTooltips();
  }

  private cleanupOrphanedTooltips(): void {
    const tooltips = document.querySelectorAll('.tooltip-text');
    tooltips.forEach(tooltip => {
      const tooltipFor = tooltip.getAttribute('data-tooltip-for');
      if (tooltipFor) {
        const associatedElement = document.querySelector(`[data-tooltip-id="${tooltipFor}"]`);
        if (!associatedElement) {
          // Tooltip has no associated element, remove it
          tooltip.remove();
        }
      }
    });
  }

  private cleanupAllTooltips(): void {
    // Remove all active tooltips
    const tooltips = document.querySelectorAll('.tooltip-text');
    tooltips.forEach(tooltip => tooltip.remove());
    
    // Restore title attributes for all elements with data-original-title
    const elementsWithOriginalTitle = document.querySelectorAll('[data-original-title]');
    elementsWithOriginalTitle.forEach(element => {
      const originalTitle = element.getAttribute('data-original-title');
      if (originalTitle) {
        element.setAttribute('title', originalTitle);
        element.removeAttribute('data-original-title');
        element.removeAttribute('data-tooltip-id');
      }
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});