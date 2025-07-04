export interface FormData {
  [key: string]: string;
}

export interface FormState {
  formId: string;
  data: FormData;
  timestamp: number;
}

export class FormStateManager {
  private static readonly STORAGE_KEY = 'ipfs_launcher_form_drafts';
  private static readonly DEBOUNCE_DELAY = 500; // ms
  private debounceTimers: Map<string, number> = new Map();

  /**
   * Save form data to browser storage with debouncing
   */
  async saveFormState(formId: string, formData: FormData): Promise<void> {
    // Clear existing debounce timer for this form
    const existingTimer = this.debounceTimers.get(formId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced save
    const timer = window.setTimeout(async () => {
      try {
        const formState: FormState = {
          formId,
          data: formData,
          timestamp: Date.now()
        };

        const existingDrafts = await this.getAllFormStates();
        existingDrafts[formId] = formState;

        await chrome.storage.local.set({ [FormStateManager.STORAGE_KEY]: existingDrafts });
        
        // Emit save event for UI feedback
        this.emitSaveEvent(formId);
      } catch (error) {
        console.error('Failed to save form state:', error);
      }
      
      this.debounceTimers.delete(formId);
    }, FormStateManager.DEBOUNCE_DELAY);

    this.debounceTimers.set(formId, timer);
  }

  /**
   * Load form data from browser storage
   */
  async loadFormState(formId: string): Promise<FormData | null> {
    try {
      const allStates = await this.getAllFormStates();
      const formState = allStates[formId];
      
      if (!formState) {
        return null;
      }

      // Check if draft is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in ms
      if (Date.now() - formState.timestamp > maxAge) {
        await this.clearFormState(formId);
        return null;
      }

      return formState.data;
    } catch (error) {
      console.error('Failed to load form state:', error);
      return null;
    }
  }

  /**
   * Clear specific form data from storage
   */
  async clearFormState(formId: string): Promise<void> {
    try {
      const existingDrafts = await this.getAllFormStates();
      delete existingDrafts[formId];
      
      await chrome.storage.local.set({ [FormStateManager.STORAGE_KEY]: existingDrafts });
      
      // Clear any pending debounce timer
      const timer = this.debounceTimers.get(formId);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(formId);
      }
    } catch (error) {
      console.error('Failed to clear form state:', error);
    }
  }

  /**
   * Clear all form drafts (for cleanup)
   */
  async clearAllFormStates(): Promise<void> {
    try {
      await chrome.storage.local.remove(FormStateManager.STORAGE_KEY);
      
      // Clear all pending timers
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();
    } catch (error) {
      console.error('Failed to clear all form states:', error);
    }
  }

  /**
   * Get all saved form states
   */
  private async getAllFormStates(): Promise<Record<string, FormState>> {
    try {
      const result = await chrome.storage.local.get(FormStateManager.STORAGE_KEY);
      return result[FormStateManager.STORAGE_KEY] || {};
    } catch (error) {
      console.error('Failed to get form states:', error);
      return {};
    }
  }

  /**
   * Extract form data from HTML form element
   */
  extractFormData(form: HTMLFormElement): FormData {
    const nativeFormData = new FormData(form);
    const data: FormData = {};
    
    // Use forEach instead of entries() for better browser compatibility
    nativeFormData.forEach((value, key) => {
      if (typeof value === 'string') {
        data[key] = value;
      }
    });
    
    return data;
  }

  /**
   * Restore form data to HTML form element
   */
  restoreFormData(form: HTMLFormElement, data: FormData): void {
    for (const [key, value] of Object.entries(data)) {
      const input = form.querySelector(`[name="${key}"]`) as HTMLInputElement;
      if (input && value) {
        input.value = value;
      }
    }
  }

  /**
   * Set up auto-save for a form
   */
  setupAutoSave(form: HTMLFormElement, formId: string): () => void {
    const handleInput = () => {
      const formData = this.extractFormData(form);
      this.saveFormState(formId, formData);
    };

    // Add event listeners to all form inputs
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      input.addEventListener('input', handleInput);
      input.addEventListener('change', handleInput);
    });

    // Return cleanup function
    return () => {
      inputs.forEach(input => {
        input.removeEventListener('input', handleInput);
        input.removeEventListener('change', handleInput);
      });
      
      // Clear any pending timer for this form
      const timer = this.debounceTimers.get(formId);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(formId);
      }
    };
  }

  /**
   * Check if form has saved draft
   */
  async hasDraft(formId: string): Promise<boolean> {
    const data = await this.loadFormState(formId);
    return data !== null;
  }

  /**
   * Emit custom event when form is saved (for UI feedback)
   */
  private emitSaveEvent(formId: string): void {
    const event = new CustomEvent('formStateSaved', {
      detail: { formId, timestamp: Date.now() }
    });
    document.dispatchEvent(event);
  }
}

// Export singleton instance
export const formStateManager = new FormStateManager();