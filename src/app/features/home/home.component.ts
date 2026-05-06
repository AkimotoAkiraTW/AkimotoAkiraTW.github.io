import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { DataService } from '../../core/services/data.service';
import { SITE_CONFIG } from '../../core/config/site.config';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatChipsModule, MatDividerModule],
  template: `
    <div class="content-container">

      <!-- ── Hero ── -->
      <section class="hero">
        @if (resume(); as r) {
          <p class="hero-eyebrow">{{ r.title }}</p>
          <h1 class="hero-title">{{ cfg.displayName }}</h1>
          <p class="hero-summary">{{ r.summary }}</p>
          <div class="hero-contacts">
            @if (r.contact?.email) {
              <a [href]="'mailto:' + r.contact.email" class="contact-chip">
                <mat-icon>email</mat-icon>{{ r.contact.email }}
              </a>
            }
            @if (r.contact?.github) {
              <a [href]="'https://github.com/' + r.contact.github" target="_blank" class="contact-chip">
                <mat-icon>code</mat-icon>{{ r.contact.github }}
              </a>
            }
            @if (r.contact?.location) {
              <span class="contact-chip">
                <mat-icon>location_on</mat-icon>{{ r.contact.location }}
              </span>
            }
          </div>
          <div class="hero-actions">
            <a mat-flat-button color="primary" routerLink="/portfolio" class="hero-btn">
              <mat-icon>work</mat-icon>{{ cfg.navLabels.portfolio }}
            </a>
            <a mat-stroked-button routerLink="/blog" class="hero-btn">
              <mat-icon>article</mat-icon>{{ cfg.navLabels.blog }}
            </a>
          </div>
        }
      </section>

      <mat-divider></mat-divider>

      @if (resume(); as r) {
        <!-- ── Skills ── -->
        <section class="cv-section">
          <h2 class="cv-heading"><mat-icon>psychology</mat-icon>技術能力</h2>
          <div class="skills-grid">
            @for (group of r.skills; track group.category) {
              <div class="skill-group">
                <p class="skill-cat">{{ group.category }}</p>
                <mat-chip-set>
                  @for (item of group.items; track item) {
                    <mat-chip>{{ item }}</mat-chip>
                  }
                </mat-chip-set>
              </div>
            }
          </div>
        </section>

        <mat-divider></mat-divider>

        <!-- ── Experience ── -->
        <section class="cv-section">
          <h2 class="cv-heading"><mat-icon>work_history</mat-icon>工作經歷</h2>
          <div class="timeline">
            @for (exp of r.experience; track exp.company) {
              <div class="timeline-item">
                <div class="timeline-meta">
                  <span class="timeline-period">{{ exp.startDate }} – {{ exp.endDate }}</span>
                </div>
                <div class="timeline-body">
                  <p class="timeline-title">{{ exp.position }}</p>
                  <p class="timeline-sub">{{ exp.company }}</p>
                  @if (exp.highlights.length) {
                    <ul class="timeline-list">
                      @for (h of exp.highlights; track h) {
                        <li>{{ h }}</li>
                      }
                    </ul>
                  }
                </div>
              </div>
            }
          </div>
        </section>

        <mat-divider></mat-divider>

        <!-- ── Education ── -->
        <section class="cv-section">
          <h2 class="cv-heading"><mat-icon>school</mat-icon>學歷</h2>
          <div class="timeline">
            @for (edu of r.education; track edu.institution) {
              <div class="timeline-item">
                <div class="timeline-meta">
                  <span class="timeline-period">{{ edu.startDate }} – {{ edu.endDate }}</span>
                </div>
                <div class="timeline-body">
                  <p class="timeline-title">{{ edu.degree }}・{{ edu.field }}</p>
                  <p class="timeline-sub">{{ edu.institution }}</p>
                </div>
              </div>
            }
          </div>
        </section>

        <!-- Bottom actions -->
        <div class="bottom-actions">
          <a mat-stroked-button routerLink="/portfolio">
            <mat-icon>work</mat-icon>查看完整作品集
          </a>
          <a mat-stroked-button routerLink="/tools">
            <mat-icon>build</mat-icon>開發工具箱
          </a>
        </div>
      }

    </div>
  `,
  styles: [`
    /* ── Hero ── */
    .hero {
      text-align: center;
      padding: clamp(56px, 10vw, 100px) 0 clamp(40px, 6vw, 64px);
    }
    .hero-eyebrow {
      font-size: 0.875rem;
      font-weight: 500;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.55;
      margin-bottom: 16px;
    }
    .hero-title {
      font-size: clamp(2.4rem, 6vw, 4rem);
      font-weight: 700;
      letter-spacing: -0.04em;
      line-height: 1.1;
      margin-bottom: 20px;
    }
    .hero-summary {
      font-size: clamp(1rem, 1.8vw, 1.15rem);
      opacity: 0.7;
      max-width: 640px;
      margin: 0 auto 28px;
      line-height: 1.75;
    }
    .hero-contacts {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
      margin-bottom: 32px;
    }
    .contact-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      padding: 6px 14px;
      border-radius: 9999px;
      border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
      opacity: 0.75;
      transition: opacity 200ms ease;
      &:hover { opacity: 1; }
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .hero-actions {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .hero-btn {
      height: 44px;
      padding: 0 20px;
      font-size: 0.95rem;
    }

    /* ── CV Sections ── */
    .cv-section {
      padding: clamp(36px, 5vw, 56px) 0;
    }
    .cv-heading {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.1rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-bottom: 28px;
      opacity: 0.85;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }

    /* Skills */
    .skills-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 24px;
    }
    .skill-cat {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.5;
      margin-bottom: 10px;
    }

    /* Timeline */
    .timeline {
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    .timeline-item {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 24px;
      align-items: start;
    }
    .timeline-meta {
      text-align: right;
      padding-top: 2px;
    }
    .timeline-period {
      font-size: 0.75rem;
      font-family: 'Fira Code', monospace;
      opacity: 0.5;
      line-height: 1.5;
    }
    .timeline-title {
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 4px;
    }
    .timeline-sub {
      font-size: 0.875rem;
      opacity: 0.6;
      margin-bottom: 10px;
    }
    .timeline-list {
      padding-left: 18px;
      font-size: 0.875rem;
      opacity: 0.75;
      li { margin-bottom: 6px; line-height: 1.6; }
    }

    /* Bottom */
    .bottom-actions {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
      padding: 40px 0 64px;
    }

    /* RWD: mobile 時 timeline 改為單欄 */
    @media (max-width: 600px) {
      .timeline-item {
        grid-template-columns: 1fr;
        gap: 4px;
      }
      .timeline-meta { text-align: left; }
    }
  `],
})
export class HomeComponent {
  readonly cfg = SITE_CONFIG;
  private dataService = inject(DataService);
  resume = toSignal(this.dataService.getResume());
}


