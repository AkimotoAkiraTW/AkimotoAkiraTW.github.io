import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { shareReplay, catchError } from 'rxjs/operators';
import { BlogPost, TagCount, ArchiveGroup, PostNavigation } from '../models/blog.model';
import { map } from 'rxjs/operators';

/**
 * BlogService
 * 部落格文章列表與 Markdown 內容讀取服務。
 * 新增文章只需：
 *   1. 新增 assets/blog/<slug>.md
 *   2. 在 assets/blog/index.json 加入對應的 metadata 條目
 */
@Injectable({ providedIn: 'root' })
export class BlogService {
  private http = inject(HttpClient);

  private postList$ = this.http
    .get<BlogPost[]>('assets/blog/index.json')
    .pipe(
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  /** 取得文章列表（已快取） */
  getPostList(): Observable<BlogPost[]> {
    return this.postList$;
  }

  /** 依 slug 取得 Markdown 原始內容 */
  getPostContent(slug: string): Observable<string> {
    return this.http.get(`assets/blog/${slug}.md`, { responseType: 'text' }).pipe(
      catchError(() => of('文章內容載入失敗或已被移除。'))
    );
  }

  /** 取得標籤雲統計 */
  getTagsCloud(): Observable<TagCount[]> {
    return this.postList$.pipe(
      map(posts => {
        const counts = posts.flatMap(p => p.tags).reduce((acc, tag) => {
          acc[tag] = (acc[tag] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        return Object.entries(counts)
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count);
      })
    );
  }

  /** 取得按年份分組的文章（時間軸） */
  getArchives(): Observable<ArchiveGroup[]> {
    return this.postList$.pipe(
      map(posts => {
        const sorted = [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const groups = sorted.reduce((acc, post) => {
          const year = new Date(post.date).getFullYear();
          if (!acc[year]) acc[year] = [];
          acc[year].push(post);
          return acc;
        }, {} as Record<number, BlogPost[]>);
        
        return Object.keys(groups)
          .map(year => Number(year))
          .sort((a, b) => b - a)
          .map(year => ({ year, posts: groups[year] }));
      })
    );
  }

  /** 取得指定文章的上下篇導覽 */
  getPostNavigation(slug: string): Observable<PostNavigation> {
    return this.postList$.pipe(
      map(posts => {
        const sorted = [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const index = sorted.findIndex(p => p.slug === slug);
        return {
          next: index > 0 ? sorted[index - 1] : null,
          prev: index !== -1 && index < sorted.length - 1 ? sorted[index + 1] : null
        };
      })
    );
  }
}

