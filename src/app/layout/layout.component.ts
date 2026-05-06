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
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    AsyncPipe,
  ],
  template: `
    <mat-sidenav-container class="app-container">
      <mat-sidenav #sidenav mode="over" [opened]="false" class="mobile-nav">
        <mat-nav-list>
          @for (item of navItems; track item.route) {
            <a mat-list-item
               [routerLink]="item.route"
               routerLinkActive="active-link"
               [routerLinkActiveOptions]="{ exact: item.route === '/' }"
               (click)="sidenav.close()">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="app-toolbar">
          @if (isMobile$ | async) {
            <button mat-icon-button (click)="sidenav.toggle()" aria-label="開啟選單">
              <mat-icon>menu</mat-icon>
            </button>
          }

          <a routerLink="/" 
             class="brand" 
             [class.hidden-logo]="isHomePage()">
            {{ cfg.displayName }}
          </a>

          <span class="spacer"></span>

          @if (!(isMobile$ | async)) {
            <nav class="desktop-nav">
              @for (item of navItems; track item.route) {
                <a mat-button
                   [routerLink]="item.route"
                   routerLinkActive="active-link"
                   [routerLinkActiveOptions]="{ exact: item.route === '/' }">
                  {{ item.label }}
                </a>
              }
            </nav>
            <div class="nav-divider"></div>
          }

          @for (action of toolbarActions; track action.label) {
            @if (action.show) {
              <button mat-icon-button
                      [attr.aria-label]="action.label"
                      [title]="action.label"
                      (click)="action.action()">
                @if (action.icon) {
                  <mat-icon>{{ action.icon() }}</mat-icon>
                } @else if (action.svgIcon) {
                  <mat-icon [svgIcon]="action.svgIcon"></mat-icon>
                }
              </button>
            }
          }
        </mat-toolbar>

        <main class="main-content">
          <router-outlet />
        </main>

        <footer class="app-footer">
          <div class="content-container footer-inner">
            <span class="footer-text">
              <code>&lt;/&gt;</code> with ☕ by <strong>{{ cfg.displayName }}</strong> © {{ cfg.copyrightYear }}
              <span class="license">Licensed under MIT</span>
            </span>
          </div>
        </footer>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .app-container {
      height: 100%;
    }

    /* ── Toolbar ── */
    .app-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
      backdrop-filter: blur(8px);
      background-color: color-mix(in srgb, var(--mat-toolbar-container-background-color) 90%, transparent);
    }

    .brand {
      font-weight: 600;
      font-size: 1.2rem;
      letter-spacing: -0.03em;
      cursor: pointer;
      padding: 0 4px;
      transition: all 300ms ease;
      &:hover { opacity: 0.75; }
    }

    .hidden-logo {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: translateX(-10px);
    }

    .spacer { flex: 1 1 auto; }

    /* ── Desktop Nav ── */
    .desktop-nav {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    @media (max-width: 959px) {
      .desktop-nav, .nav-divider {
        display: none;
      }
    }

    .desktop-nav a {
      font-size: 0.875rem;
      font-weight: 500;
      letter-spacing: 0.01em;
      min-width: unset;
      padding: 0 12px;
    }

    .nav-divider {
      width: 1px;
      height: 20px;
      background: color-mix(in srgb, currentColor 20%, transparent);
      margin: 0 8px;
    }

    .active-link {
      font-weight: 600;
      opacity: 1;
    }

    /* ── Mobile Sidenav ── */
    .mobile-nav {
      width: 260px;
    }

    /* ── Main content ── */
    .main-content {
      min-height: calc(100vh - 64px - 56px);
      padding: 40px 0 32px;
    }

    /* ── Footer ── */
    .app-footer {
      border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      padding: 18px 0;
    }

    .footer-inner {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .footer-text {
      font-size: 0.8rem;
      opacity: 0.55;
      letter-spacing: 0.01em;
    }

    .footer-text code {
      font-family: 'Fira Code', monospace;
      color: var(--mat-sys-primary);
      margin-right: 4px;
    }

    .license {
      margin-left: 12px;
      padding-left: 12px;
      border-left: 1px solid currentColor;
      font-style: italic;
    }
  `],
})
export class LayoutComponent {
  readonly cfg = SITE_CONFIG;
  themeService = inject(ThemeService);
  private router = inject(Router);
  private breakpointObserver = inject(BreakpointObserver);
  private iconRegistry = inject(MatIconRegistry);
  private sanitizer = inject(DomSanitizer);

  /** 偵測當前是否為首頁，用於控制 Logo 顯示 */
  isHomePage = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.router.url === '/' || this.router.url === '/home'),
    ),
    { initialValue: true }
  );

  constructor() {
    // 註冊 GitHub SVG 圖示
    const githubIcon = `<svg viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`;
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
      label: '切換深色/淺色模式',
      show: true,
      icon: () => this.themeService.theme() === 'dark' ? 'light_mode' : 'dark_mode',
      action: () => this.themeService.toggle(),
    },
    {
      label: '前往 GitHub',
      show: true,
      svgIcon: 'github',
      action: () => window.open(`https://github.com/${this.cfg.githubUsername}`, '_blank'),
    },
  ];

  isMobile$ = this.breakpointObserver
    .observe([Breakpoints.Handset])
    .pipe(map(result => result.matches));
}

