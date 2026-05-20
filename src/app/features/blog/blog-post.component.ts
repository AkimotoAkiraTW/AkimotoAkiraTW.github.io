import { Component, inject, computed, signal, effect, ElementRef, ViewChild } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { RouterLink } from '@angular/router';
import { BlogService } from '../../core/services/blog.service';
import { input } from '@angular/core';
import { switchMap } from 'rxjs/operators';
import { SITE_CONFIG } from '../../core/config/site.config';
import { TocComponent } from './toc.component';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/** 解析 Markdown Frontmatter (--- key: value ---) */
function parseFrontmatter(raw: string): { meta: Record<string, string | string[]>; body: string } {
  if (!raw || !raw.startsWith('---')) return { meta: {}, body: raw || '' };
  const secondSeparatorIndex = raw.indexOf('---', 3);
  if (secondSeparatorIndex === -1) return { meta: {}, body: raw };
  const fmRaw = raw.slice(3, secondSeparatorIndex).trim();
  const body = raw.slice(secondSeparatorIndex + 3).trim();
  const meta: Record<string, string | string[]> = {};
  for (const line of fmRaw.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      meta[key] = val.slice(1, -1).split(',').map(t => t.trim());
    } else { meta[key] = val; }
  }
  return { meta, body };
}

@Component({
  selector: 'app-blog-post',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatChipsModule, RouterLink, TocComponent],
  template: `
    <div class="content-container">
      <a mat-button routerLink="/blog" class="back-link">
        <mat-icon>arrow_back</mat-icon> 返回{{ cfg.navLabels.blog }}
      </a>

      <div class="reading-progress-container">
        <div class="progress-bar" [style.width.%]="readingProgress()"></div>
      </div>

      @if (post()) {
        <div class="post-layout">
          <article class="post-wrapper">
            <header class="post-header">
              @if (post()!.meta['title']) {
                <h1 class="post-title">{{ post()!.meta['title'] }}</h1>
              }
              <div class="post-meta-row">
                @if (post()!.meta['date']) {
                  <time class="post-date">
                    <mat-icon>calendar_today</mat-icon>
                    {{ post()!.meta['date'] }}
                  </time>
                }
                @if (post()!.tags.length) {
                  <mat-chip-set class="post-tags">
                    @for (tag of post()!.tags; track tag) {
                      <mat-chip>{{ tag }}</mat-chip>
                    }
                  </mat-chip-set>
                }
              </div>
            </header>

            <div class="post-content markdown-body" #postContent [innerHTML]="safeHtml()"></div>

            @if (nav(); as n) {
              <nav class="post-nav">
                <div class="nav-item prev">
                  @if (n.prev) {
                    <a [routerLink]="['/blog', n.prev.slug]">
                      <span class="nav-label"><mat-icon>arrow_back</mat-icon> 上一篇</span>
                      <span class="nav-title">{{ n.prev.title }}</span>
                    </a>
                  }
                </div>
                <div class="nav-item next">
                  @if (n.next) {
                    <a [routerLink]="['/blog', n.next.slug]">
                      <span class="nav-label">下一篇 <mat-icon>arrow_forward</mat-icon></span>
                      <span class="nav-title">{{ n.next.title }}</span>
                    </a>
                  }
                </div>
              </nav>
            }
          </article>

          <aside class="post-sidebar">
            <app-toc [contentElement]="postContent" [trigger]="tocTrigger()"></app-toc>
          </aside>
        </div>
      } @else {
        <p class="loading-text">載入中...</p>
      }
    </div>
  `,
  styles: [`
    .back-link { margin-bottom: 40px; display: inline-flex; border-radius: 9999px; font-size: 0.875rem; color: var(--text-secondary); }
    .post-header { margin-bottom: 40px; border-bottom: 1px solid var(--border-color); padding-bottom: 24px; }
    .reading-progress-container { position: fixed; top: 0; left: 0; width: 100%; height: 4px; z-index: 1000; background: transparent; }
    .progress-bar { height: 100%; background: var(--accent-color); box-shadow: 0 0 10px var(--accent-color); transition: width 100ms ease-out; }
    .post-title { font-size: clamp(1.8rem, 5vw, 3rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.2; margin-bottom: 16px; color: var(--text-primary); }
    .post-meta-row { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; }
    .post-date { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-muted); font-family: 'Fira Code', monospace; mat-icon { font-size: 14px; width: 14px; height: 14px; } }
    .post-content { line-height: 1.85; font-size: 1.05rem; padding-bottom: 80px; color: var(--text-primary); }
    .post-layout { display: grid; grid-template-columns: 1fr min(75ch, 100%) 1fr; gap: 32px; width: 100%; margin: 0 auto; align-items: start; }
    .post-wrapper { grid-column: 2; width: 100%; }
    .post-sidebar { grid-column: 3; position: sticky; top: 100px; padding-top: 40px; }
    @media (max-width: 1200px) { .post-layout { display: block; max-width: 75ch; padding: 0 16px; margin: 0 auto; } .post-sidebar { display: none; } }
    :host ::ng-deep .post-content {
      p { margin-bottom: 1.5em; color: var(--text-primary); }
      h1 { display: none; }
      h2 { font-size: clamp(1.3rem, 2.5vw, 1.75rem); font-weight: 600; margin: 2.5em 0 0.75em; padding-bottom: 8px; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
      pre { padding: 20px 24px; border-radius: 12px; overflow-x: auto; margin: 1.5em 0; background-color: var(--surface-alt); border: 1px solid var(--border-color); }
      code { font-family: 'Fira Code', monospace; }
      img { max-width: 100%; border-radius: 12px; margin: 2.5em auto; }
    }
    .post-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 64px; padding-top: 32px; border-top: 1px solid var(--border-color); }
    .nav-item a { display: flex; flex-direction: column; text-decoration: none; color: inherit; padding: 20px; border-radius: 12px; background-color: var(--surface-color); border: 1px solid var(--border-color); transition: all 300ms ease; }
    .nav-item.next a { align-items: flex-end; text-align: right; }
    .nav-item a:hover { background-color: var(--surface-alt); border-color: var(--accent-color); transform: translateY(-4px); }
    .nav-title { font-weight: 600; font-size: 1rem; color: var(--text-primary); }
    .loading-text { color: var(--text-muted); text-align: center; padding: 64px 0; }
  `],
})
export class BlogPostComponent {
  readonly cfg = SITE_CONFIG;
  slug = input.required<string>();
  private blogService = inject(BlogService);
  private sanitizer = inject(DomSanitizer);

  private rawContent = toSignal(
    toObservable(this.slug).pipe(switchMap(slug => this.blogService.getPostContent(slug))),
    { initialValue: '' }
  );

  post = computed(() => {
    const raw = this.rawContent();
    if (!raw) return null;
    const { meta, body } = parseFrontmatter(raw);
    const tags = Array.isArray(meta['tags']) ? (meta['tags'] as string[]) : (meta['tags'] ? [meta['tags'] as string] : []);
    return { meta, body, tags };
  });

  safeHtml = computed<SafeHtml>(() => {
    const p = this.post();
    if (!p) return '';
    try {
      return this.sanitizer.bypassSecurityTrustHtml(marked.parse(p.body) as string);
    } catch (e) { return 'Markdown 渲染錯誤'; }
  });

  nav = toSignal(toObservable(this.slug).pipe(switchMap(slug => this.blogService.getPostNavigation(slug))));
  tocTrigger = signal(0);
  readingProgress = signal(0);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        this.readingProgress.set((winScroll / height) * 100);
      });
    }
    // 當內容更新時，通知 TOC 重新掃描
    effect(() => {
      if (this.safeHtml()) {
        setTimeout(() => this.tocTrigger.update(v => v + 1), 100);
      }
    });
  }
}
