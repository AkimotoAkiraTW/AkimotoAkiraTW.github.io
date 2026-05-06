import { Component, inject, computed, signal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { RouterLink } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { BlogService } from '../../core/services/blog.service';
import { input } from '@angular/core';
import { switchMap } from 'rxjs/operators';
import { SITE_CONFIG } from '../../core/config/site.config';
import { TocComponent } from './toc.component';

/** 解析 Markdown Frontmatter (--- key: value ---) */
function parseFrontmatter(raw: string): { meta: Record<string, string | string[]>; body: string } {
  if (!raw || !raw.startsWith('---')) return { meta: {}, body: raw || '' };
  
  // 尋找第二個 ---
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
    } else {
      meta[key] = val;
    }
  }
  return { meta, body };
}

@Component({
  selector: 'app-blog-post',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatChipsModule, RouterLink, MarkdownComponent, TocComponent],
  template: `
    <div class="content-container">
      <a mat-button routerLink="/blog" class="back-link">
        <mat-icon>arrow_back</mat-icon> 返回{{ cfg.navLabels.blog }}
      </a>

      <!-- ── 閱讀進度條 ── -->
      <div class="reading-progress-container">
        <div class="progress-bar" [style.width.%]="readingProgress()"></div>
      </div>

      @if (post()) {
        <div class="post-layout">
          <!-- ── 左側文章區域 ── -->
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

            <div class="post-content" #postContent>
              <markdown [data]="post()!.body" (ready)="onMarkdownReady()" />
            </div>

            <!-- ── 文章導覽 (上下篇) ── -->
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

          <!-- ── 右側目錄區域 ── -->
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
    .back-link {
      margin-bottom: 40px;
      display: inline-flex;
      border-radius: 9999px;
      font-size: 0.875rem;
    }

    /* ── Post Header ── */
    .post-header {
      margin-bottom: 40px;
      border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      padding-bottom: 24px;
    }
    
    /* ── 閱讀進度條 ── */
    .reading-progress-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      z-index: 1000;
      background: transparent;
    }
    .progress-bar {
      height: 100%;
      background: var(--mat-sys-primary);
      box-shadow: 0 0 10px var(--mat-sys-primary);
      transition: width 100ms ease-out;
    }

    .post-title {
      font-size: clamp(1.8rem, 5vw, 3rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.2;
      margin-bottom: 16px;
    }
    .post-meta-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .post-date {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      opacity: 0.55;
      font-family: 'Fira Code', monospace;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    /* ── Post Content (Markdown) ── */
    .post-content {
      line-height: 1.85;
      font-size: 1.05rem;
      padding-bottom: 80px;
    }

    /* ── Layout ── */
    .post-layout {
      display: grid;
      grid-template-columns: 1fr min(75ch, 100%) 1fr;
      gap: 32px;
      width: 100%;
      margin: 0 auto;
      align-items: start;
    }
    
    .post-wrapper {
      grid-column: 2; /* 確保文章佔據中間那一欄 */
      width: 100%;
    }
    
    .post-sidebar {
      grid-column: 3; /* 目錄佔據右側那一欄 */
      position: sticky;
      top: 100px;
      padding-top: 40px;
    }

    @media (max-width: 1200px) {
      .post-layout {
        display: block;
        max-width: 75ch;
        padding: 0 16px;
        margin: 0 auto;
      }
      .post-sidebar { display: none; }
    }

    :host ::ng-deep .post-content {
      /* 段落 */
      p {
        margin-bottom: 1.5em;
        color: color-mix(in srgb, currentColor 88%, transparent);
      }

      /* 標題 */
      h1 { display: none; } /* 已由 post-header 顯示，避免重複 */
      h2 {
        font-size: clamp(1.3rem, 2.5vw, 1.75rem);
        font-weight: 600;
        margin: 2.5em 0 0.75em;
        letter-spacing: -0.02em;
        padding-bottom: 8px;
        border-bottom: 1px solid color-mix(in srgb, currentColor 8%, transparent);
      }
      h3 {
        font-size: 1.15rem;
        font-weight: 600;
        margin: 2em 0 0.5em;
      }
      h4 {
        font-size: 1rem;
        font-weight: 600;
        margin: 1.5em 0 0.5em;
        opacity: 0.8;
      }

      /* 行內程式碼 */
      code:not(pre code) {
        padding: 2px 7px;
        border-radius: 6px;
        font-size: 0.82em;
        font-family: 'Fira Code', 'Cascadia Code', monospace;
        background-color: color-mix(in srgb, currentColor 8%, transparent);
        border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      }

      /* 程式碼區塊 */
      pre {
        padding: 20px 24px;
        border-radius: 12px;
        overflow-x: auto;
        margin: 1.5em 0;
        background-color: color-mix(in srgb, currentColor 5%, transparent);
        border: 1px solid color-mix(in srgb, currentColor 8%, transparent);
        font-size: 0.875rem;
        line-height: 1.7;
        code {
          background: none;
          border: none;
          padding: 0;
          font-family: 'Fira Code', 'Cascadia Code', monospace;
        }
      }

      /* 引言 */
      blockquote {
        border-left: 3px solid var(--mat-sys-primary);
        padding: 12px 20px;
        margin: 1.5em 0;
        border-radius: 0 8px 8px 0;
        background-color: color-mix(in srgb, currentColor 3%, transparent);
        opacity: 0.9;
        p { margin: 0; }
      }

      /* 清單 */
      ul, ol {
        padding-left: 1.5em;
        margin-bottom: 1.5em;
      }
      li {
        margin-bottom: 0.5em;
        line-height: 1.7;
      }

      /* 連結 */
      a {
        color: var(--mat-sys-primary);
        text-decoration-thickness: 1px;
        text-underline-offset: 3px;
        &:hover { opacity: 0.8; }
      }

      /* 圖片 */
      img {
        max-width: 100%;
        display: block;
        border-radius: 12px;
        margin: 2.5em auto;
        box-shadow: 0 10px 30px color-mix(in srgb, black 15%, transparent);
        border: 1px solid color-mix(in srgb, currentColor 8%, transparent);
        transition: transform 300ms ease;
      }
      img:hover { transform: scale(1.01); }

      /* 水平線 */
      hr {
        border: none;
        border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent);
        margin: 2.5em 0;
      }

      /* 表格 */
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 1.5em 0;
        font-size: 0.9rem;
      }
      th, td {
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        padding: 10px 16px;
        text-align: left;
      }
      th {
        font-weight: 600;
        background-color: color-mix(in srgb, currentColor 4%, transparent);
      }
    }

    /* ── Post Navigation ── */
    .post-nav {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 64px;
      padding-top: 32px;
      border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent);
    }
    .nav-item a {
      display: flex;
      flex-direction: column;
      text-decoration: none;
      color: inherit;
      padding: 20px;
      border-radius: 12px;
      background-color: color-mix(in srgb, currentColor 3%, transparent);
      border: 1px solid color-mix(in srgb, currentColor 8%, transparent);
      transition: all 300ms ease;
    }
    .nav-item.next a { align-items: flex-end; text-align: right; }
    .nav-item a:hover {
      background-color: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      border-color: var(--mat-sys-primary);
      transform: translateY(-4px);
    }
    .nav-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      opacity: 0.5;
      margin-bottom: 8px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .nav-title {
      font-weight: 600;
      font-size: 1rem;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .loading-text {
      opacity: 0.5;
      text-align: center;
      padding: 64px 0;
    }

    @media (max-width: 1100px) {
      .post-sidebar { display: none; }
    }

    @media (max-width: 600px) {
      .post-content { font-size: 1rem; }
      :host ::ng-deep .post-content pre { padding: 14px 16px; border-radius: 8px; }
    }
  `],
})
export class BlogPostComponent {
  readonly cfg = SITE_CONFIG;
  slug = input.required<string>();
  private blogService = inject(BlogService);

  private rawContent = toSignal(
    toObservable(this.slug).pipe(
      switchMap(slug => this.blogService.getPostContent(slug))
    ),
    { initialValue: '' }
  );

  /** 解析後的文章物件：meta (frontmatter) + body (純 Markdown) + tags 陣列 */
  post = computed(() => {
    const raw = this.rawContent();
    if (!raw) return null;
    const { meta, body } = parseFrontmatter(raw);
    const tags = Array.isArray(meta['tags'])
      ? (meta['tags'] as string[])
      : (meta['tags'] ? [meta['tags'] as string] : []);
    
    // 確保標題與日期有預設值 (若 meta 為空)
    const displayMeta = {
      title: (meta['title'] as string) || '無標題',
      date: (meta['date'] as string) || '',
      ...meta
    };

    return { meta: displayMeta, body, tags };
  });

  /** 上下篇導覽資料 */
  nav = toSignal(
    toObservable(this.slug).pipe(
      switchMap(slug => this.blogService.getPostNavigation(slug))
    )
  );

  /** 觸發 TOC 重新掃描的訊號 */
  tocTrigger = signal(0);

  /** 閱讀進度 (0-100) */
  readingProgress = signal(0);

  constructor() {
    // 監聽捲動事件以更新進度
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        this.readingProgress.set(scrolled);
      });
    }
  }

  onMarkdownReady() {
    // 透過改變數值來觸發 TocComponent 的 ngOnChanges
    this.tocTrigger.update((v: number) => v + 1);
  }
}


