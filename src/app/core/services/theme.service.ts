import { Injectable, signal, effect, Injector, inject } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private static readonly STORAGE_KEY = 'app-theme';
  readonly theme = signal<Theme>(this.getInitialTheme());
  private injector = inject(Injector);

  constructor() {
    effect(() => {
      const current = this.theme();
      document.documentElement.classList.toggle('dark-theme', current === 'dark');
      localStorage.setItem(ThemeService.STORAGE_KEY, current);
    }, { injector: this.injector });
  }

  toggle(): void {
    this.theme.update(t => t === 'light' ? 'dark' : 'light');
  }

  private getInitialTheme(): Theme {
    const stored = localStorage.getItem(ThemeService.STORAGE_KEY) as Theme | null;
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
