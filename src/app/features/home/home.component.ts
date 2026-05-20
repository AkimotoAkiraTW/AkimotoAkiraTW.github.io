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
            @if (r.contact.email) {
              <a [href]="'mailto:' + r.contact.email" class="contact-chip">
                <mat-icon>email</mat-icon>{{ r.contact.email }}
              </a>
            }
            @if (r.contact.github) {
              <a [href]="'https://github.com/' + r.contact.github" target="_blank" class="contact-chip">
                <mat-icon>code</mat-icon>{{ r.contact.github }}
              </a>
            }
            @if (r.contact.location) {
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
            <a mat-stroked-button routerLink="/tools" class="hero-btn">
              <mat-icon>build</mat-icon>{{ cfg.navLabels.tools }}
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
                  @if (exp.projects && exp.projects.length) {
                    <div class="project-list">
                      @for (proj of exp.projects; track proj.name) {
                        <div class="project-card">
                          <p class="project-name">
                            <mat-icon>folder_open</mat-icon>{{ proj.name }}
                          </p>
                          <ul class="timeline-list">
                            @for (h of proj.highlights; track h) {
                              <li>{{ h }}</li>
                            }
                          </ul>
                          @if (proj.tech) {
                            <p class="project-tech">{{ proj.tech }}</p>
                          }
                        </div>
                      }
                    </div>
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

        <div class="page-end-spacer"></div>
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
      color: var(--text-muted);
      margin-bottom: 16px;
    }
    .hero-title {
      font-size: clamp(2.4rem, 6vw, 4rem);
      font-weight: 700;
      letter-spacing: -0.04em;
      line-height: 1.1;
      margin-bottom: 20px;
      color: var(--text-primary);
    }
    .hero-summary {
      font-size: clamp(1rem, 1.8vw, 1.15rem);
      color: var(--text-secondary);
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
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      transition: all 200ms ease;
      &:hover { border-color: var(--accent-color); color: var(--text-primary); background: var(--surface-alt); }
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
      color: var(--text-primary);
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
      color: var(--text-muted);
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
      color: var(--text-muted);
      line-height: 1.5;
    }
    .timeline-title {
      font-weight: 600;
      font-size: 1rem;
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    .timeline-sub {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin-bottom: 10px;
    }
    .timeline-list {
      padding-left: 18px;
      font-size: 0.875rem;
      color: var(--text-secondary);
      li { margin-bottom: 6px; line-height: 1.6; }
    }

    /* Projects */
    .project-list {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .project-card {
      padding: 12px 16px;
      border-left: 2px solid var(--accent-color);
      background: var(--surface-alt);
      border-radius: 0 8px 8px 0;
    }
    .project-name {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--text-primary);
      margin-bottom: 8px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: var(--accent-color); }
    }
    .project-tech {
      margin-top: 8px;
      font-size: 0.75rem;
      font-family: 'Fira Code', monospace;
      color: var(--accent-color);
      opacity: 0.9;
    }



    .page-end-spacer { height: 64px; }

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


