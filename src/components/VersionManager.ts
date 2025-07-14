import { App, CreateVersionRequest } from '../types/index.js';
import { storage } from '../storage/index.js';
import { IPFSUtils } from '../utils/ipfs.js';

export class VersionManager {
  private app: App;
  private modal: HTMLElement;
  private onUpdate: (app: App) => void;

  constructor(app: App, onUpdate: (app: App) => void) {
    this.app = app;
    this.onUpdate = onUpdate;
    this.modal = this.createModal();
    this.setupEventListeners();
  }

  private createModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'modal version-manager-modal';
    modal.innerHTML = `
      <div class="modal-content large">
        <div class="modal-header">
          <div class="modal-title">Manage Versions - ${this.app.petname}</div>
          <button class="close-button" id="closeVersionModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="versions-list" id="versionsList">
            ${this.renderVersionsList()}
          </div>
          <div class="add-version-section">
            <h4>Add New Version</h4>
            <form id="addVersionForm">
              <div class="form-row vertical">
                <div class="form-group">
                  <label class="form-label" for="versionName">Version Name</label>
                  <input type="text" class="form-input" id="versionName" name="versionName" required placeholder="e.g., v1.2.0, Production">
                </div>
                <div class="form-group">
                  <label class="form-label" for="versionCid">IPFS CID</label>
                  <input type="text" class="form-input" id="versionCid" name="versionCid" required placeholder="bafy...">
                  <div class="form-help">Base32 CID format preferred.</div>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group checkbox-group">
                  <label class="checkbox-label">
                    <input type="checkbox" id="makeDefault" name="makeDefault"> Make this the default version
                  </label>
                </div>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn btn-primary">Add Version</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    return modal;
  }

  private renderVersionsList(): string {
    return this.app.versions.map(version => `
      <div class="version-item" data-version-id="${version.id}">
        <div class="version-header">
          <div class="version-info">
            <div class="version-name">
              ${version.name}
              ${version.isDefault ? '<span class="version-default-badge">Default</span>' : ''}
            </div>
            <div class="version-cid" title="${version.cid}">
              CID: ${this.formatCID(version.cid)}
              <button class="copy-cid-btn" title="Copy full CID to clipboard" data-action="copy-cid" data-cid="${version.cid}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </div>
            <div class="version-meta">
              Created: ${this.formatDate(version.createdAt)}
            </div>
          </div>
          <div class="version-actions">
            <button class="action-btn test-btn" title="Test this version" data-action="test" data-version-id="${version.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M7 7h10v10M7 17L17 7"/>
              </svg>
            </button>
            ${!version.isDefault ? `
              <button class="action-btn default-btn" title="Make default" data-action="make-default" data-version-id="${version.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                </svg>
              </button>
            ` : ''}
            ${this.app.versions.length > 1 ? `
              <button class="action-btn delete-btn" title="Delete version" data-action="delete" data-version-id="${version.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }


  private formatCID(cid: string): string {
    if (!cid) return '';
    if (cid.length > 20) {
      return cid.substring(0, 8) + '...' + cid.substring(cid.length - 8);
    }
    return cid;
  }

  private formatDate(timestamp: number): string {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  }

  private setupEventListeners(): void {
    const closeBtn = this.modal.querySelector('#closeVersionModal');
    const addVersionForm = this.modal.querySelector('#addVersionForm') as HTMLFormElement;
    const versionsList = this.modal.querySelector('#versionsList');

    closeBtn?.addEventListener('click', () => this.hide());
    addVersionForm?.addEventListener('submit', (e) => this.handleAddVersion(e));

    // Handle version actions
    versionsList?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest('.action-btn, .copy-cid-btn') as HTMLButtonElement;
      if (button) {
        const action = button.getAttribute('data-action');
        
        if (action === 'copy-cid') {
          const cid = button.getAttribute('data-cid');
          if (cid) {
            this.copyToClipboard(cid);
          }
        } else {
          const versionId = button.getAttribute('data-version-id');
          if (action && versionId) {
            this.handleVersionAction(action, versionId);
          }
        }
      }
    });


    // Validate CID input
    const cidInput = this.modal.querySelector('#versionCid') as HTMLInputElement;
    cidInput?.addEventListener('input', () => {
      const cid = cidInput.value.trim();
      if (cid && !IPFSUtils.isValidCID(cid)) {
        cidInput.setCustomValidity('Invalid CID format. Please use base32 format (e.g., bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi).');
      } else {
        cidInput.setCustomValidity('');
      }
    });

    // Close modal when clicking outside
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });
  }

  private async handleAddVersion(e: Event): Promise<void> {
    e.preventDefault();
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const name = formData.get('versionName') as string;
    const cid = (formData.get('versionCid') as string)?.trim();
    const makeDefault = formData.get('makeDefault') === 'on';

    if (!name || !cid) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate CID
    if (!IPFSUtils.isValidCID(cid)) {
      alert('Invalid CID format. Please use base32 format (e.g., bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi).');
      return;
    }

    try {
      const request: CreateVersionRequest = {
        appId: this.app.id,
        name,
        cid,
        makeDefault
      };

      const updatedApp = await storage.createVersion(request);
      if (updatedApp) {
        this.app = updatedApp;
        this.refreshVersionsList();
        this.onUpdate(updatedApp);
        form.reset();
      }
    } catch (error) {
      console.error('Failed to add version:', error);
      alert('Failed to add version. Please try again.');
    }
  }

  private async handleVersionAction(action: string, versionId: string): Promise<void> {
    const version = this.app.versions.find(v => v.id === versionId);
    if (!version) return;

    switch (action) {
      case 'test':
        try {
          const url = await storage.buildUrl(version.cid);
          await chrome.tabs.create({ url });
        } catch (error) {
          console.error('Failed to open version:', error);
        }
        break;

      case 'make-default':
        try {
          // Set all versions to non-default
          this.app.versions.forEach(v => v.isDefault = false);
          // Set selected version as default
          version.isDefault = true;
          
          const updatedApp = await storage.updateApp({
            id: this.app.id,
            petname: this.app.petname,
            description: this.app.description,
            tags: this.app.tags
          });
          
          if (updatedApp) {
            this.app = updatedApp;
            this.refreshVersionsList();
            this.onUpdate(updatedApp);
          }
        } catch (error) {
          console.error('Failed to update default version:', error);
        }
        break;

      case 'delete':
        if (confirm(`Are you sure you want to delete version "${version.name}"?`)) {
          try {
            this.app.versions = this.app.versions.filter(v => v.id !== versionId);
            
            // If we deleted the default version, make the first remaining version default
            if (version.isDefault && this.app.versions.length > 0) {
              this.app.versions[0].isDefault = true;
            }
            
            const updatedApp = await storage.updateApp({
              id: this.app.id,
              petname: this.app.petname,
              description: this.app.description,
              tags: this.app.tags
            });
            
            if (updatedApp) {
              this.app = updatedApp;
              this.refreshVersionsList();
              this.onUpdate(updatedApp);
            }
          } catch (error) {
            console.error('Failed to delete version:', error);
          }
        }
        break;
    }
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      // Visual feedback
      const copyButtons = this.modal.querySelectorAll('.copy-cid-btn');
      copyButtons.forEach(btn => {
        if (btn.getAttribute('data-cid') === text) {
          const originalTitle = btn.getAttribute('title');
          btn.setAttribute('title', 'Copied!');
          btn.classList.add('copied');
          setTimeout(() => {
            btn.setAttribute('title', originalTitle || 'Copy full CID to clipboard');
            btn.classList.remove('copied');
          }, 2000);
        }
      });
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback: select text for manual copy
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  private refreshVersionsList(): void {
    const versionsList = this.modal.querySelector('#versionsList');
    if (versionsList) {
      versionsList.innerHTML = this.renderVersionsList();
    }
  }

  public show(): void {
    document.body.appendChild(this.modal);
    this.modal.style.display = 'block';
    
    // Focus on version name input
    const nameInput = this.modal.querySelector('#versionName') as HTMLInputElement;
    nameInput?.focus();
  }

  public hide(): void {
    this.modal.style.display = 'none';
    this.modal.remove();
  }
}