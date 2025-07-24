import { App } from './types/index.js';
import { storage } from './storage/index.js';
import { AppFlag } from './components/AppFlag.js';
import { themeManager, Theme } from './utils/theme.js';
import { ExportManager } from './utils/export.js';
import { formStateManager } from './utils/formState.js';
import { DNSLinkResult } from './utils/dnslink.js';

class PopupManager {
  private apps: App[] = [];
  private filteredApps: App[] = [];
  private appFlags: Map<string, AppFlag> = new Map();
  private formCleanupFunctions: Map<string, () => void> = new Map();
  private currentEditApp: App | null = null;
  private currentDNSLinkResult: DNSLinkResult | null = null;
  private pendingDNSLinkAssociation: DNSLinkResult | null = null;
  private currentTabUrl: string | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    await storage.init();
    await this.loadApps();
    this.setupEventListeners();
    this.initializeTheme();
    await this.checkCurrentTabForDNSLink(); // Check tab first to get URL
    this.render(); // Then render with highlighting
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
    const gatewaySelect = document.getElementById('gatewaySelect') as HTMLSelectElement;
    const saveCustomGateway = document.getElementById('saveCustomGateway');
    const editAppModal = document.getElementById('editAppModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const cancelEditButton = document.getElementById('cancelEditButton');
    const editAppForm = document.getElementById('editAppForm') as HTMLFormElement;
    const preferLocalGateway = document.getElementById('preferLocalGateway') as HTMLInputElement;

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
    gatewaySelect?.addEventListener('change', (e) => this.handleGatewayChange((e.target as HTMLSelectElement).value));
    saveCustomGateway?.addEventListener('click', () => this.handleSaveCustomGateway());
    closeEditModal?.addEventListener('click', () => this.hideEditModal());
    cancelEditButton?.addEventListener('click', () => this.hideEditModal());
    editAppForm?.addEventListener('submit', (e) => this.handleEditApp(e));
    preferLocalGateway?.addEventListener('change', (e) => this.handleLocalGatewayToggle((e.target as HTMLInputElement).checked));

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
      
      const nicknameInput = document.getElementById('nickname') as HTMLInputElement;
      nicknameInput?.focus();
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
      app.nickname.toLowerCase().includes(searchTerm) ||
      app.description?.toLowerCase().includes(searchTerm) ||
      app.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
      app.versions.some(version => 
        version.name.toLowerCase().includes(searchTerm) ||
        version.cid.toLowerCase().includes(searchTerm)
      )
    );
    this.render();
  }

  private async handleAddApp(e: Event) {
    e.preventDefault();
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const nickname = formData.get('nickname') as string;
    const cid = formData.get('cid') as string;
    const description = formData.get('description') as string;

    if (!nickname || !cid) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const newApp = await storage.createApp({
        nickname,
        cid,
        description: description || undefined
      });

      // Associate with DNSLink cache if this came from DNSLink detection
      if (this.pendingDNSLinkAssociation && this.pendingDNSLinkAssociation.cid === cid) {
        await storage.updateDNSLinkCache(
          this.pendingDNSLinkAssociation.domain,
          this.pendingDNSLinkAssociation.cid,
          newApp.id
        );
        this.pendingDNSLinkAssociation = null;
      }

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
        const url = await storage.buildUrl(version.cid);
        await chrome.tabs.create({ url });
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
        
        // Check if this app matches the current tab and add active class
        const flagElement = appFlag.getElement();
        if (this.isCurrentTabApp(app)) {
          flagElement.classList.add('active');
        }
        
        this.appFlags.set(app.id, appFlag);
        appGrid.appendChild(flagElement);
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

  private async showSettingsModal(): Promise<void> {
    const settingsModal = document.getElementById('settingsModal');
    const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
    const gatewaySelect = document.getElementById('gatewaySelect') as HTMLSelectElement;
    const preferLocalGateway = document.getElementById('preferLocalGateway') as HTMLInputElement;
    
    if (settingsModal && themeSelect && gatewaySelect && preferLocalGateway) {
      // Update theme select to current value
      themeSelect.value = themeManager.getTheme();
      
      // Update gateway select to current value
      try {
        const gatewayConfig = await storage.getGatewayConfig();
        const currentGateway = gatewayConfig.defaultGateway;
        
        // Update local gateway preference
        preferLocalGateway.checked = gatewayConfig.preferLocalGateway || false;
        
        // Check if current gateway is in the predefined options
        const predefinedOptions = ['dweb.link', 'inbrowser.link', 'inbrowser.dev'];
        
        if (predefinedOptions.includes(currentGateway)) {
          gatewaySelect.value = currentGateway;
        } else {
          // It's a custom gateway - add it to the options if not already there
          const existingOption = Array.from(gatewaySelect.options).find(opt => opt.value === currentGateway);
          if (!existingOption) {
            const option = document.createElement('option');
            option.value = currentGateway;
            option.textContent = `Custom: ${currentGateway}`;
            // Insert before the "Custom Gateway" option
            gatewaySelect.insertBefore(option, gatewaySelect.lastElementChild);
          }
          gatewaySelect.value = currentGateway;
        }
      } catch (error) {
        console.error('Failed to load gateway config:', error);
      }
      
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
      const nicknameInput = document.getElementById('editNickname') as HTMLInputElement;
      const descriptionInput = document.getElementById('editDescription') as HTMLInputElement;
      
      if (nicknameInput) nicknameInput.value = this.currentEditApp.nickname;
      if (descriptionInput) descriptionInput.value = this.currentEditApp.description || '';
      
      // Set up auto-save for this form
      this.setupFormAutoSave('editAppForm', form);
      
      nicknameInput?.focus();
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
    
    const nickname = formData.get('nickname') as string;
    const description = formData.get('description') as string;

    if (!nickname) {
      alert('Please fill in the app name');
      return;
    }

    try {
      const updatedApp = await storage.updateApp({
        id: this.currentEditApp.id,
        nickname,
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

  private async handleGatewayChange(gateway: string): Promise<void> {
    const customGatewayRow = document.getElementById('customGatewayRow');
    
    if (gateway === 'custom') {
      customGatewayRow!.style.display = 'block';
      return;
    } else {
      customGatewayRow!.style.display = 'none';
    }

    try {
      await storage.updateGatewayConfig({ defaultGateway: gateway });
      this.showTemporaryMessage('Gateway updated successfully!', 'success');
    } catch (error) {
      console.error('Failed to update gateway:', error);
      this.showTemporaryMessage('Failed to update gateway', 'error');
    }
  }

  private async handleSaveCustomGateway(): Promise<void> {
    const customGatewayInput = document.getElementById('customGatewayInput') as HTMLInputElement;
    const gatewaySelect = document.getElementById('gatewaySelect') as HTMLSelectElement;
    const customGateway = customGatewayInput.value.trim();

    if (!customGateway) {
      this.showTemporaryMessage('Please enter a custom gateway domain', 'error');
      return;
    }

    // Validate domain format
    try {
      // Remove protocol if present
      const cleanDomain = customGateway.replace(/^https?:\/\//, '');
      
      // Basic domain validation
      if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) {
        this.showTemporaryMessage('Please enter a valid domain name (e.g., gateway.com)', 'error');
        return;
      }
      
      // Test if it's a valid hostname by creating a URL with it
      new URL(`https://${cleanDomain}`);
      
      // Use clean domain (without protocol)
      const finalDomain = cleanDomain;
      
      await storage.updateGatewayConfig({ defaultGateway: finalDomain });
      
      // Add custom gateway to the select options if not already there
      const existingOption = Array.from(gatewaySelect.options).find(opt => opt.value === finalDomain);
      if (!existingOption) {
        const option = document.createElement('option');
        option.value = finalDomain;
        option.textContent = `Custom: ${finalDomain}`;
        // Insert before the "Custom Gateway" option
        gatewaySelect.insertBefore(option, gatewaySelect.lastElementChild);
      }
      
      gatewaySelect.value = finalDomain;
      document.getElementById('customGatewayRow')!.style.display = 'none';
      customGatewayInput.value = '';
      
      this.showTemporaryMessage('Custom gateway saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save custom gateway:', error);
      this.showTemporaryMessage('Please enter a valid domain name', 'error');
    }
  }

  private async handleLocalGatewayToggle(enabled: boolean): Promise<void> {
    try {
      await storage.updateGatewayConfig({ preferLocalGateway: enabled });
      this.showTemporaryMessage(
        enabled ? 'Local gateway preference enabled' : 'Local gateway preference disabled',
        'success'
      );
    } catch (error) {
      console.error('Failed to update local gateway preference:', error);
      this.showTemporaryMessage('Failed to update preference', 'error');
    }
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
   * Check if the current tab URL matches any of the stored apps
   */
  private isCurrentTabApp(app: App): boolean {
    if (!this.currentTabUrl) return false;

    try {
      const currentUrl = new URL(this.currentTabUrl);
      
      // Check each version of the app
      for (const version of app.versions) {
        try {
          // Check if the current URL contains the CID in various formats
          
          // 1. Check subdomain format: {cid}.ipfs.{gateway}
          const cidInSubdomain = currentUrl.hostname.startsWith(version.cid + '.ipfs.');
          if (cidInSubdomain) {
            return true;
          }
          
          // 2. Check path-based gateway format: /{gateway}/ipfs/{cid}
          if (currentUrl.pathname.includes(`/ipfs/${version.cid}`)) {
            return true;
          }
          
          // 3. Check if hostname directly contains CID (for some gateway formats)
          if (currentUrl.hostname.includes(version.cid)) {
            return true;
          }
          
          // 4. Check for local gateway format
          if (currentUrl.hostname === 'localhost' && currentUrl.pathname.includes(`/ipfs/${version.cid}`)) {
            return true;
          }
          
          // 5. Check for direct CID access (e.g., {cid}.ipfs.inbrowser.link)
          const hostParts = currentUrl.hostname.split('.');
          if (hostParts.length >= 3 && hostParts[0] === version.cid && hostParts[1] === 'ipfs') {
            return true;
          }
          
        } catch (error) {
          // Continue checking other versions if URL parsing fails
          continue;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check current tab for DNSLink
   */
  private async checkCurrentTabForDNSLink(): Promise<void> {
    try {
      // Get current tab info from background script
      const tabResponse = await this.sendMessageToBackground('GET_CURRENT_TAB', {});
      if (!tabResponse.success || !tabResponse.data?.domain) {
        return;
      }

      const { domain, url } = tabResponse.data;
      this.currentTabUrl = url;
      
      // Skip non-web URLs
      if (domain.startsWith('chrome://') || domain.startsWith('moz-extension://') || domain.startsWith('chrome-extension://')) {
        return;
      }

      // Check for DNSLink
      const dnslinkResponse = await this.sendMessageToBackground('CHECK_DNSLINK', { domain });
      if (dnslinkResponse.success && dnslinkResponse.data) {
        this.currentDNSLinkResult = dnslinkResponse.data;
        if ((this.currentDNSLinkResult?.hasDNSLink || this.currentDNSLinkResult?.hasIPFSPath) && this.currentDNSLinkResult.cid) {
          await this.handleDNSLinkDetection(this.currentDNSLinkResult);
        }
      }
    } catch (error) {
      console.error('Failed to check DNSLink:', error);
    }
  }

  /**
   * Handle DNSLink detection with cache checking and version suggestions
   */
  private async handleDNSLinkDetection(dnslinkResult: DNSLinkResult): Promise<void> {
    if (!dnslinkResult.cid) return;

    // Get cached DNSLink entry
    const cachedEntry = await storage.getDNSLinkEntry(dnslinkResult.domain);
    
    if (cachedEntry) {
      // Check if CID has changed
      if (cachedEntry.lastCID !== dnslinkResult.cid) {
        console.log('DNSLink CID updated for domain:', dnslinkResult.domain);
        
        // Update cache with new CID
        await storage.updateDNSLinkCache(dnslinkResult.domain, dnslinkResult.cid, cachedEntry.associatedAppId);
        
        // If there's an associated app, suggest adding new version
        if (cachedEntry.associatedAppId) {
          const app = await storage.getApp(cachedEntry.associatedAppId);
          if (app) {
            this.showVersionUpdateSuggestion(app, dnslinkResult);
            return;
          }
        }
      } else {
        // Same CID, but check if we should still show notification for this session
        console.debug('DNSLink CID unchanged for domain:', dnslinkResult.domain);
        
        // If there's an associated app, don't show notification
        // If no associated app, show notification to allow adding it
        if (!cachedEntry.associatedAppId) {
          console.log('CID unchanged but no associated app - showing notification');
          this.showDNSLinkNotification();
        }
        return;
      }
    }

    // Check if this domain/CID is already saved
    const isAlreadySaved = this.isDNSLinkAlreadySaved(dnslinkResult);
    console.log('DNSLink detection - already saved?', isAlreadySaved, 'for domain:', dnslinkResult.domain);
    
    if (!isAlreadySaved) {
      // Update cache for new domain
      await storage.updateDNSLinkCache(dnslinkResult.domain, dnslinkResult.cid);
      console.log('Showing DNSLink notification for:', dnslinkResult.domain);
      this.showDNSLinkNotification();
    } else {
      console.log('DNSLink already saved, not showing notification');
      // Find the app and associate it with the cache entry
      const existingApp = this.findAppForDNSLink(dnslinkResult);
      if (existingApp) {
        await storage.updateDNSLinkCache(dnslinkResult.domain, dnslinkResult.cid, existingApp.id);
      }
    }
  }

  /**
   * Find existing app that matches DNSLink result
   */
  private findAppForDNSLink(dnslinkResult: DNSLinkResult): App | null {
    // Check by CID first
    const appByCID = this.apps.find(app => 
      app.versions.some(version => version.cid === dnslinkResult.cid)
    );
    if (appByCID) return appByCID;

    // Check by domain name
    const appByDomain = this.apps.find(app => 
      app.nickname.toLowerCase() === dnslinkResult.domain.toLowerCase() ||
      app.description?.toLowerCase().includes(dnslinkResult.domain.toLowerCase())
    );
    
    return appByDomain || null;
  }

  /**
   * Show suggestion to add new version for updated DNSLink
   */
  private showVersionUpdateSuggestion(app: App, dnslinkResult: DNSLinkResult): void {
    const notification = document.createElement('div');
    notification.className = 'version-update-notification';
    notification.innerHTML = `
      <div class="version-update-content">
        <div class="version-update-icon">🔄</div>
        <div class="version-update-text">
          <strong>DNSLink Updated!</strong><br>
          ${app.nickname} has a new version available
        </div>
        <button class="version-update-add-btn" id="addVersionUpdate">Add Version</button>
        <button class="version-update-close-btn" id="closeVersionUpdate">×</button>
      </div>
    `;
    notification.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: var(--warning);
      color: white;
      padding: 12px 16px;
      z-index: 10002;
      box-shadow: 0 2px 8px var(--shadow-light);
    `;

    const content = notification.querySelector('.version-update-content') as HTMLElement;
    content.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 400px;
      margin: 0 auto;
    `;

    const icon = notification.querySelector('.version-update-icon') as HTMLElement;
    icon.style.cssText = `
      font-size: 20px;
      flex-shrink: 0;
    `;

    const text = notification.querySelector('.version-update-text') as HTMLElement;
    text.style.cssText = `
      flex: 1;
      font-size: 13px;
      line-height: 1.3;
    `;

    const addBtn = notification.querySelector('.version-update-add-btn') as HTMLElement;
    addBtn.style.cssText = `
      background: white;
      color: var(--warning);
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
    `;

    const closeBtn = notification.querySelector('.version-update-close-btn') as HTMLElement;
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `;

    document.body.insertBefore(notification, document.body.firstChild);

    // Add event listeners
    addBtn.addEventListener('click', async () => {
      await this.handleAddVersionUpdate(app, dnslinkResult);
      document.body.removeChild(notification);
    });

    closeBtn.addEventListener('click', () => {
      document.body.removeChild(notification);
    });

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 10000);
  }

  /**
   * Handle adding new version for updated DNSLink
   */
  private async handleAddVersionUpdate(app: App, dnslinkResult: DNSLinkResult): Promise<void> {
    if (!dnslinkResult.cid) return;

    try {
      const updatedApp = await storage.createVersion({
        appId: app.id,
        name: `Updated ${new Date().toLocaleDateString()}`,
        cid: dnslinkResult.cid,
        makeDefault: true
      });

      if (updatedApp) {
        // Update local apps array
        const appIndex = this.apps.findIndex(a => a.id === app.id);
        if (appIndex !== -1) {
          this.apps[appIndex] = updatedApp;
          this.filteredApps = [...this.apps];
        }
        
        this.render();
        this.showTemporaryMessage('New version added successfully!', 'success');
      }
    } catch (error) {
      console.error('Failed to add version:', error);
      this.showTemporaryMessage('Failed to add new version', 'error');
    }
  }

  /**
   * Check if DNSLink result is already saved as an app
   */
  private isDNSLinkAlreadySaved(dnslinkResult: DNSLinkResult): boolean {
    if ((!dnslinkResult.hasDNSLink && !dnslinkResult.hasIPFSPath) || !dnslinkResult.cid) return false;

    // Check if any app has this CID
    const existingAppByCID = this.apps.find(app => 
      app.versions.some(version => version.cid === dnslinkResult.cid)
    );

    if (existingAppByCID) {
      console.debug('DNSLink CID already saved in app:', existingAppByCID.nickname);
      return true;
    }

    // Check if any app has this domain name
    const existingAppByDomain = this.apps.find(app => 
      app.nickname.toLowerCase() === dnslinkResult.domain.toLowerCase() ||
      app.description?.toLowerCase().includes(dnslinkResult.domain.toLowerCase())
    );

    if (existingAppByDomain) {
      console.debug('DNSLink domain already saved in app:', existingAppByDomain.nickname);
      return true;
    }

    return false;
  }

  /**
   * Send message to background script
   */
  private async sendMessageToBackground(type: string, data: any): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, data }, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }

  /**
   * Show DNSLink detection notification
   */
  private showDNSLinkNotification(): void {
    console.log('showDNSLinkNotification called with:', this.currentDNSLinkResult);
    
    if (!this.currentDNSLinkResult || (!this.currentDNSLinkResult.hasDNSLink && !this.currentDNSLinkResult.hasIPFSPath)) {
      console.log('Not showing notification - no valid DNSLink result');
      return;
    }

    const notification = document.createElement('div');
    notification.className = 'dnslink-notification';
    const detectionType = this.currentDNSLinkResult.detectionMethod === 'x-ipfs-path' ? 'IPFS content' : 'DNSLink';
    const notificationIcon = this.currentDNSLinkResult.detectionMethod === 'x-ipfs-path' ? '📁' : '🔗';
    
    notification.innerHTML = `
      <div class="dnslink-content">
        <div class="dnslink-icon">${notificationIcon}</div>
        <div class="dnslink-text">
          <strong>${detectionType} detected!</strong><br>
          ${this.currentDNSLinkResult.domain} has IPFS content
        </div>
        <button class="dnslink-add-btn" id="addDNSLinkApp">Add App</button>
        <button class="dnslink-close-btn" id="closeDNSLinkNotification">×</button>
      </div>
    `;
    notification.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: var(--accent-primary);
      color: white;
      padding: 12px 16px;
      z-index: 99999;
      box-shadow: 0 2px 8px var(--shadow-light);
    `;
    
    console.log('Inserting DNSLink notification into DOM');

    const content = notification.querySelector('.dnslink-content') as HTMLElement;
    content.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 400px;
      margin: 0 auto;
    `;

    const iconElement = notification.querySelector('.dnslink-icon') as HTMLElement;
    iconElement.style.cssText = `
      font-size: 20px;
      flex-shrink: 0;
    `;

    const text = notification.querySelector('.dnslink-text') as HTMLElement;
    text.style.cssText = `
      flex: 1;
      font-size: 13px;
      line-height: 1.3;
    `;

    const addBtn = notification.querySelector('.dnslink-add-btn') as HTMLElement;
    addBtn.style.cssText = `
      background: white;
      color: var(--accent-primary);
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
    `;

    const closeBtn = notification.querySelector('.dnslink-close-btn') as HTMLElement;
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `;

    document.body.insertBefore(notification, document.body.firstChild);

    // Add event listeners
    addBtn.addEventListener('click', () => {
      this.handleAddDNSLinkApp();
      document.body.removeChild(notification);
    });

    closeBtn.addEventListener('click', () => {
      document.body.removeChild(notification);
    });

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 10000);
  }

  /**
   * Handle adding DNSLink app
   */
  private async handleAddDNSLinkApp(): Promise<void> {
    if (!this.currentDNSLinkResult || (!this.currentDNSLinkResult.hasDNSLink && !this.currentDNSLinkResult.hasIPFSPath)) return;

    await this.showAddModal();
    
    // Pre-fill the form with DNSLink data
    const nicknameInput = document.getElementById('nickname') as HTMLInputElement;
    const cidInput = document.getElementById('cid') as HTMLInputElement;
    const descriptionInput = document.getElementById('description') as HTMLInputElement;

    if (nicknameInput) nicknameInput.value = this.currentDNSLinkResult.domain;
    if (cidInput && this.currentDNSLinkResult.cid) cidInput.value = this.currentDNSLinkResult.cid;
    if (descriptionInput) descriptionInput.value = `IPFS site for ${this.currentDNSLinkResult.domain}`;
    
    // Store the DNSLink result for later association
    this.pendingDNSLinkAssociation = this.currentDNSLinkResult;
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

}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});