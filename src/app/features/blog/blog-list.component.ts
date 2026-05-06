import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { BlogService } from '../../core/services/blog.service';
import { ArchiveGroup, TagCount } from '../../core/models/blog.model';
import { SITE_CONFIG } from '../../core/config/site.config';
import { signal, computed } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatChipsModule, MatIconModule, MatButtonModule, DatePipe],
  template: `
    <div class="content-container">
      <header class="page-header">
        <h1>{{ cfg.navLabels.blog }}</h1>
        <p>關於開發技術、學習心得。</p>
      </header>

      <!-- ── 標籤雲 ── -->
      <section class="tags-cloud">
        <div class="tags-wrapper">
          <button mat-stroked-button 
            [class.active]="!selectedTag()" 
            (click)="selectedTag.set(null)">
            全部
          </button>
          @for (tc of tags(); track tc.tag) {
            <button mat-stroked-button 
              [class.active]="selectedTag() === tc.tag"
              (click)="selectedTag.set(tc.tag)">
              #{{ tc.tag }} <span class="tag-count">{{ tc.count }}</span>
            </button>
          }
        </div>
      </section>

      <div class="blog-list">
        @for (group of groupedPosts(); track group.year) {
          <div class="archive-group">
            <h2 class="year-divider">
              <span class="year-text">{{ group.year }}</span>
              <span class="divider-line"></span>
            </h2>
            
            <div class="posts-in-year">
              @for (post of group.posts; track post.slug) {
                <a [routerLink]="['/blog', post.slug]" class="post-link">
                  <mat-card class="post-card" appearance="outlined">
                    <div class="post-date-side">
                      <span class="month">{{ post.date | date:'MM' }}</span>
                      <span class="day">{{ post.date | date:'dd' }}</span>
                    </div>
                    <div class="post-main-content">
                      <mat-card-header>
                        <mat-card-title>{{ post.title }}</mat-card-title>
                      </mat-card-header>
                      <mat-card-content>
                        <p class="summary">{{ post.summary }}</p>
                        <div class="post-tags-row">
                          @for (tag of post.tags; track tag) {
                            <span class="mini-tag">#{{ tag }}</span>
                          }
                        </div>
                      </mat-card-content>
                    </div>
                  </mat-card>
                </a>
              }
            </div>
          </div>
        }

        @if (groupedPosts().length === 0) {
          <div class="empty-state">
            <mat-icon>article</mat-icon>
            <p>目前沒有符合條件的文章！</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .tags-cloud {
      margin-bottom: 40px;
      padding: 0 16px;
    }
    .tags-wrapper {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
    }
    .tags-wrapper button {
      border-radius: 99px;
      font-size: 0.85rem;
      border-color: color-mix(in srgb, currentColor 15%, transparent);
    }
    .tags-wrapper button.active {
      background-color: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      border-color: var(--mat-sys-primary);
    }
    .tag-count {
      opacity: 0.6;
      margin-left: 4px;
      font-size: 0.75rem;
    }

    /* ── Archive Group ── */
    .archive-group {
      margin-bottom: 48px;
    }
    .year-divider {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      font-family: 'Fira Code', monospace;
      font-size: 1.5rem;
      font-weight: 700;
      opacity: 0.8;
    }
    .divider-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(to right, color-mix(in srgb, currentColor 20%, transparent), transparent);
    }

    .blog-list {
      max-width: 850px;
      margin: 0 auto;
    }
    .post-link {
      display: block;
      margin-bottom: 20px;
      text-decoration: none;
      color: inherit;
    }
    .post-card {
      display: flex;
      flex-direction: row;
      gap: 0;
      transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      overflow: hidden;
      border-color: color-mix(in srgb, currentColor 10%, transparent);
      background-color: color-mix(in srgb, currentColor 2%, transparent);
    }
    .post-card:hover {
      transform: translateX(8px);
      border-color: var(--mat-sys-primary);
      background-color: color-mix(in srgb, var(--mat-sys-primary) 5%, transparent);
    }

    .post-date-side {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background-color: color-mix(in srgb, currentColor 5%, transparent);
      min-width: 70px;
      font-family: 'Fira Code', monospace;
      border-right: 1px solid color-mix(in srgb, currentColor 8%, transparent);
    }
    .month { font-size: 0.75rem; opacity: 0.6; font-weight: 500; }
    .day { font-size: 1.2rem; font-weight: 700; }

    .post-main-content {
      flex: 1;
      padding: 16px 24px;
    }
    .post-main-content mat-card-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .summary {
      font-size: 0.95rem;
      opacity: 0.8;
      line-height: 1.6;
      margin-bottom: 12px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .post-tags-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .mini-tag {
      font-size: 0.75rem;
      opacity: 0.5;
      font-family: 'Fira Code', monospace;
    }

    .empty-state {
      text-align: center;
      padding: 64px 0;
      opacity: 0.6;
    }
    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }

    @media (max-width: 600px) {
      .post-card { flex-direction: column; }
      .post-date-side {
        flex-direction: row;
        gap: 8px;
        min-width: auto;
        justify-content: flex-start;
        border-right: none;
        border-bottom: 1px solid color-mix(in srgb, currentColor 8%, transparent);
      }
    }
  `],
})
export class BlogListComponent {
  readonly cfg = SITE_CONFIG;
  private blogService = inject(BlogService);

  /** 選取的標籤 */
  selectedTag = signal<string | null>(null);

  /** 標籤雲資料 */
  tags = toSignal(this.blogService.getTagsCloud(), { initialValue: [] });

  /** 原始文章列表 */
  private allPosts = toSignal(this.blogService.getPostList(), { initialValue: [] });

  /** 過濾後並依年份分組的文章列表 (時間軸邏輯) */
  groupedPosts = computed(() => {
    const posts = this.allPosts();
    const tag = this.selectedTag();
    
    // 1. 過濾標籤
    const filtered = tag 
      ? posts.filter(p => p.tags.includes(tag))
      : posts;

    // 2. 按日期排序 (由新到舊)
    const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 3. 按年份分組
    const groups: ArchiveGroup[] = [];
    sorted.forEach(post => {
      const year = new Date(post.date).getFullYear();
      let group = groups.find(g => g.year === year);
      if (!group) {
        group = { year, posts: [] };
        groups.push(group);
      }
      group.posts.push(post);
    });

    return groups;
  });
}
