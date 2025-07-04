export type Theme = 'light' | 'dark' | 'auto';

export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: Theme = 'light';
  private onThemeChange: ((theme: Theme) => void)[] = [];

  private constructor() {
    this.init();
  }

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  private init(): void {
    // Check for saved theme preference or default to 'auto'
    const savedTheme = localStorage.getItem('theme') as Theme;
    this.currentTheme = savedTheme || 'auto';
    this.applyTheme(this.currentTheme);
  }

  setTheme(theme: Theme): void {
    this.currentTheme = theme;
    localStorage.setItem('theme', theme);
    this.applyTheme(theme);
    this.notifyThemeChange(theme);
  }

  getTheme(): Theme {
    return this.currentTheme;
  }

  private applyTheme(theme: Theme): void {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('light-theme', 'dark-theme');
    
    if (theme === 'auto') {
      // Use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark-theme' : 'light-theme');
    } else {
      root.classList.add(`${theme}-theme`);
    }
  }

  onThemeChanged(callback: (theme: Theme) => void): void {
    this.onThemeChange.push(callback);
  }

  private notifyThemeChange(theme: Theme): void {
    this.onThemeChange.forEach(callback => callback(theme));
  }

  // Listen for system theme changes when using auto mode
  setupSystemThemeListener(): void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (this.currentTheme === 'auto') {
        this.applyTheme('auto');
      }
    });
  }
}

export const themeManager = ThemeManager.getInstance();