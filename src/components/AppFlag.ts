import { App } from '../types/index.js';
import { VersionManager } from './VersionManager.js';

export class AppFlag {
  private app: App;
  private element: HTMLElement;
  private onLaunch: (app: App, version?: string) => void;
  private onEdit: (app: App) => void;
  private onDelete: (app: App) => void;

  constructor(
    app: App, 
    callbacks: {
      onLaunch: (app: App, version?: string) => void;
      onEdit: (app: App) => void;
      onDelete: (app: App) => void;
    }
  ) {
    this.app = app;
    this.onLaunch = callbacks.onLaunch;
    this.onEdit = callbacks.onEdit;
    this.onDelete = callbacks.onDelete;
    this.element = this.createElement();
    this.setupEventListeners();
  }

  private createElement(): HTMLElement {
    const flag = document.createElement('div');
    flag.className = 'app-flag';
    flag.id = `app-${this.app.id}`;
    flag.setAttribute('data-app-id', this.app.id);
    
    const defaultVersion = this.app.versions.find(v => v.isDefault) || this.app.versions[0];
    const versionCount = this.app.versions.length;
    
    flag.innerHTML = `
      <div class="app-flag-content">
        <div class="app-icon">${this.getAppIcon()}</div>
        <div class="app-details">
          <div class="app-name" title="${this.app.petname}">${this.app.petname}</div>
          <div class="app-url" title="${defaultVersion?.url || ''}">${this.formatUrl(defaultVersion?.url || '')}</div>
          ${versionCount > 1 ? `<div class="app-versions">${versionCount} versions</div>` : ''}
        </div>
        <div class="app-actions">
          <button class="action-btn launch-btn" title="Launch ${this.app.petname}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M7 7h10v10M7 17L17 7"/>
            </svg>
          </button>
          ${versionCount > 1 ? `
            <button class="action-btn versions-btn" title="Manage versions">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </button>
          ` : ''}
          <button class="action-btn menu-btn" title="More options">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="12" cy="5" r="1"/>
              <circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    return flag;
  }

  private getAppIcon(): string {
    if (this.app.icon) {
      return `<img src="${this.app.icon}" alt="${this.app.petname}" class="app-icon-img">`;
    }
    return this.app.petname.charAt(0).toUpperCase();
  }

  private formatUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  }

  private setupEventListeners(): void {
    const launchBtn = this.element.querySelector('.launch-btn');
    const versionsBtn = this.element.querySelector('.versions-btn');
    const menuBtn = this.element.querySelector('.menu-btn');

    launchBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onLaunch(this.app);
    });

    versionsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showVersionsMenu(e);
    });

    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showContextMenu(e);
    });

    // Double-click to launch
    this.element.addEventListener('dblclick', () => {
      this.onLaunch(this.app);
    });
  }

  private showVersionsMenu(event: Event): void {
    event.stopPropagation();
    
    const menu = document.createElement('div');
    menu.className = 'context-menu versions-menu';
    menu.innerHTML = `
      <div class="menu-header">Select Version</div>
      ${this.app.versions.map(version => `
        <button class="menu-item version-item ${version.isDefault ? 'default' : ''}" 
                data-version-id="${version.id}">
          <div class="version-name">${version.name}</div>
          <div class="version-url">${this.formatUrl(version.url)}</div>
          ${version.isDefault ? '<span class="default-badge">Default</span>' : ''}
        </button>
      `).join('')}
      <div class="menu-separator"></div>
      <button class="menu-item add-version-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Version
      </button>
    `;

    this.showMenu(menu, event);

    // Add event listeners to version items
    menu.querySelectorAll('.version-item').forEach(item => {
      item.addEventListener('click', () => {
        const versionId = item.getAttribute('data-version-id');
        this.onLaunch(this.app, versionId || undefined);
        this.hideMenu();
      });
    });

    menu.querySelector('.add-version-item')?.addEventListener('click', () => {
      this.hideMenu();
      this.showVersionManager();
    });
  }

  private showContextMenu(event: Event): void {
    event.stopPropagation();
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
      <button class="menu-item" data-action="edit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Edit App
      </button>
      <button class="menu-item" data-action="copy-url">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copy URL
      </button>
      <button class="menu-item" data-action="manage-versions">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        Manage Versions
      </button>
      <div class="menu-separator"></div>
      <button class="menu-item danger" data-action="delete">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        Delete App
      </button>
    `;

    this.showMenu(menu, event);

    // Add event listeners to menu items
    menu.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.getAttribute('data-action');
        this.handleContextAction(action);
        this.hideMenu();
      });
    });
  }

  private showMenu(menu: HTMLElement, event: Event): void {
    document.body.appendChild(menu);
    
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 5}px`;
    
    // Close menu when clicking outside
    const closeHandler = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        this.hideMenu();
        document.removeEventListener('click', closeHandler);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 0);
  }

  private hideMenu(): void {
    const menus = document.querySelectorAll('.context-menu');
    menus.forEach(menu => menu.remove());
  }

  private handleContextAction(action: string | null): void {
    switch (action) {
      case 'edit':
        this.onEdit(this.app);
        break;
      case 'copy-url':
        const defaultVersion = this.app.versions.find(v => v.isDefault) || this.app.versions[0];
        if (defaultVersion) {
          navigator.clipboard.writeText(defaultVersion.url);
        }
        break;
      case 'manage-versions':
        this.showVersionManager();
        break;
      case 'delete':
        if (confirm(`Are you sure you want to delete "${this.app.petname}"?`)) {
          this.onDelete(this.app);
        }
        break;
    }
  }

  private showVersionManager(): void {
    const versionManager = new VersionManager(this.app, (updatedApp) => {
      this.update(updatedApp);
    });
    versionManager.show();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public update(app: App): void {
    this.app = app;
    const newElement = this.createElement();
    this.setupEventListeners();
    this.element.replaceWith(newElement);
    this.element = newElement;
  }
}