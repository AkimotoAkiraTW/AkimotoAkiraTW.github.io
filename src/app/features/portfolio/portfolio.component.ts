import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DataService } from '../../core/services/data.service';
import { SITE_CONFIG } from '../../core/config/site.config';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [MatCardModule, MatChipsModule, MatButtonModule, MatIconModule],
  template: `
    <div class="content-container">
      <header class="page-header">
        <h1>{{ cfg.navLabels.portfolio }}</h1>
        <p>精選專案與實作成果展示。</p>
      </header>

      <div class="portfolio-grid">
        @for (item of portfolio(); track item.id) {
          <mat-card class="portfolio-card" appearance="outlined">
            @if (item.image) {
              <img mat-card-image [src]="item.image" [alt]="item.title" />
            }
            <mat-card-header>
              <mat-card-title>{{ item.title }}</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <p>{{ item.description }}</p>
              <mat-chip-set class="tags">
                @for (tag of item.tags; track tag) {
                  <mat-chip>{{ tag }}</mat-chip>
                }
              </mat-chip-set>
            </mat-card-content>
            <mat-card-actions align="end">
              @if (item.demoUrl) {
                <a mat-button [href]="item.demoUrl" target="_blank">
                  <mat-icon>open_in_new</mat-icon> 預覽
                </a>
              }
              @if (item.sourceUrl) {
                <a mat-button [href]="item.sourceUrl" target="_blank">
                  <mat-icon>code</mat-icon> 原始碼
                </a>
              }
            </mat-card-actions>
          </mat-card>
        }
      </div>
    </div>
  `,
  styles: [`
    .portfolio-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 32px;
      padding-bottom: 48px;
    }
    .portfolio-card {
      transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .portfolio-card:hover {
      transform: translateY(-4px);
    }
    .portfolio-card img {
      height: 200px;
      object-fit: cover;
      border-bottom: 1px solid color-mix(in srgb, currentColor 8%, transparent);
    }
    mat-card-header {
      padding: 24px 24px 0 !important;
    }
    mat-card-content {
      padding: 16px 24px !important;
      flex-grow: 1;
    }
    mat-card-actions {
      padding: 8px 24px 24px !important;
    }
    .tags { margin-top: 16px; }
    @media (max-width: 600px) {
      .portfolio-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class PortfolioComponent {
  readonly cfg = SITE_CONFIG;
  private dataService = inject(DataService);
  portfolio = toSignal(this.dataService.getPortfolio(), { initialValue: [] });
}
