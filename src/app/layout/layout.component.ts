import { Component, inject } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { Router, NavigationEnd, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { map, filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { ThemeService } from '../core/services/theme.service';
import { SITE_CONFIG } from '../core/config/site.config';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    MatToolbarModule, MatButtonModule, MatIconModule, MatSidenavModule, MatListModule,
    RouterLink, RouterLinkActive, RouterOutlet, AsyncPipe,
  ],
  template: `
    <mat-sidenav-container class="app-container">
      <mat-sidenav #sidenav mode="over" [opened]="false" class="mobile-nav">
        <mat-nav-list>
          @for (item of navItems; track item.route) {
            <a mat-list-item [routerLink]="item.route" routerLinkActive="active-link" (click)="sidenav.close()">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="app-toolbar">
          @if (isMobile$ | async) {
            <button mat-icon-button (click)="sidenav.toggle()"><mat-icon>menu</mat-icon></button>
          }
          <a routerLink="/" class="brand" [class.hidden-logo]="isHomePage()">{{ cfg.displayName }}</a>
          <span class="spacer"></span>
          @if (!(isMobile$ | async)) {
            <nav class="desktop-nav">
              @for (item of navItems; track item.route) {
                <a mat-button [routerLink]="item.route" routerLinkActive="active-link" 
                   [routerLinkActiveOptions]="{ exact: item.route === '/' }">{{ item.label }}</a>
              }
            </nav>
            <div class="nav-divider"></div>
          }
          @for (action of toolbarActions; track action.label) {
            <button mat-icon-button [title]="action.label" (click)="action.action()">
              @if (action.icon) { <mat-icon>{{ action.icon() }}</mat-icon> }
              @else if (action.svgIcon) { <mat-icon [svgIcon]="action.svgIcon"></mat-icon> }
            </button>
          }
        </mat-toolbar>

        <main class="main-content">
          <router-outlet />
        </main>

        <footer class="app-footer">
          <div class="footer-inner">
            <div class="footer-copyright">
              © 2016–2026 <strong>{{ cfg.displayName }}</strong>. All rights reserved.
            </div>
            <div class="footer-meta">
              MIT License · Powered by Angular & KC Toolkit
            </div>
          </div>
        </footer>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .app-container { height: 100vh; background-color: var(--bg-color); }
    mat-sidenav-content { display: flex; flex-direction: column; background-color: var(--bg-color); }
    .app-toolbar { position: sticky; top: 0; z-index: 1000; border-bottom: 1px solid var(--border-color); backdrop-filter: blur(12px); background-color: var(--glass-bg); color: var(--text-primary); }
    .brand { font-weight: 700; font-size: 1.15rem; letter-spacing: -0.04em; color: var(--text-primary); }
    .hidden-logo { opacity: 0; visibility: hidden; transform: translateX(-10px); }
    .spacer { flex: 1; }
    .desktop-nav { display: flex; gap: 4px; }
    .nav-divider { width: 1px; height: 18px; background: var(--border-color); margin: 0 12px; }
    .active-link { font-weight: 600; color: var(--accent-color) !important; }
    .main-content { flex: 1 0 auto; padding-bottom: 64px; }
    
    .app-footer {
      padding: 48px 24px;
      text-align: center;
      border-top: 1px solid var(--border-color);
      color: var(--text-muted);
      font-size: 13px;
      letter-spacing: 0.02em;
    }
    .footer-inner { display: flex; flex-direction: column; gap: 8px; }
    .footer-copyright { font-weight: 400; color: var(--text-secondary); }
    .footer-copyright strong { font-weight: 600; color: var(--text-primary); }
    .footer-meta { font-family: 'Inter', system-ui, sans-serif; opacity: 0.8; font-size: 12px; }
  `],
})
export class LayoutComponent {
  readonly cfg = SITE_CONFIG;
  themeService = inject(ThemeService);
  private router = inject(Router);
  private breakpointObserver = inject(BreakpointObserver);
  private iconRegistry = inject(MatIconRegistry);
  private sanitizer = inject(DomSanitizer);

  isHomePage = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.router.url === '/' || this.router.url === '/home'),
    ),
    { initialValue: true }
  );

  constructor() {
    const githubIcon = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`;
    this.iconRegistry.addSvgIconLiteral('github', this.sanitizer.bypassSecurityTrustHtml(githubIcon));
  }

  navItems: NavItem[] = [
    { label: this.cfg.navLabels.home,      route: '/',          icon: 'home'    },
    { label: this.cfg.navLabels.portfolio, route: '/portfolio', icon: 'work'    },
    { label: this.cfg.navLabels.blog,      route: '/blog',      icon: 'article' },
    { label: this.cfg.navLabels.tools,     route: '/tools',     icon: 'build'   },
  ];

  toolbarActions = [
    {
      label: '切換模式',
      icon: () => this.themeService.theme() === 'dark' ? 'light_mode' : 'dark_mode',
      action: () => this.themeService.toggle(),
    },
    {
      label: 'GitHub',
      svgIcon: 'github',
      action: () => window.open(`https://github.com/${this.cfg.githubUsername}`, '_blank'),
    },
  ];

  isMobile$ = this.breakpointObserver.observe([Breakpoints.Handset]).pipe(map(res => res.matches));
}
