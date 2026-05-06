import { Component, Input, OnChanges, SimpleChanges, ElementRef, inject, AfterViewInit, OnDestroy, signal } from '@angular/core';
import { NgClass } from '@angular/common';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

@Component({
  selector: 'app-toc',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="toc-container">
      <h3 class="toc-title">目錄</h3>
      <ul class="toc-list">
        @for (item of tocItems(); track item.id) {
          <li [ngClass]="['toc-item', 'level-' + item.level, activeId() === item.id ? 'active' : '']">
            <a (click)="scrollTo($event, item.id)">{{ item.text }}</a>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .toc-container {
      position: sticky;
      top: 100px;
      max-height: calc(100vh - 120px);
      overflow-y: auto;
      padding: 16px;
      border-left: 2px solid color-mix(in srgb, currentColor 5%, transparent);
      width: 240px;
    }
    .toc-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      opacity: 0.5;
      margin-bottom: 16px;
      padding-left: 12px;
    }
    .toc-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .toc-item {
      margin-bottom: 8px;
      padding-left: 12px;
      border-left: 2px solid transparent;
      margin-left: -2px;
      transition: all 200ms ease;
    }
    .toc-item.level-3 { padding-left: 28px; font-size: 0.85rem; }
    .toc-item a {
      cursor: pointer;
      opacity: 0.6;
      font-size: 0.9rem;
      line-height: 1.4;
      display: block;
      transition: opacity 200ms ease;
    }
    .toc-item:hover a { opacity: 1; }
    .toc-item.active {
      border-left-color: var(--mat-sys-primary);
    }
    .toc-item.active a {
      opacity: 1;
      color: var(--mat-sys-primary);
      font-weight: 500;
    }
    
    /* 捲動條美化 */
    .toc-container::-webkit-scrollbar { width: 4px; }
    .toc-container::-webkit-scrollbar-thumb { 
      background: color-mix(in srgb, currentColor 10%, transparent);
      border-radius: 4px;
    }
  `]
})
export class TocComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() contentElement!: HTMLElement;
  @Input() trigger!: any; // 用於觸發重新掃描

  tocItems = signal<TocItem[]>([]);
  activeId = signal<string | null>(null);
  
  private observer?: IntersectionObserver;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['trigger'] && this.contentElement) {
      // 延遲一下確保 Markdown 已經渲染到 DOM
      setTimeout(() => this.buildToc(), 100);
    }
  }

  ngAfterViewInit() {
    this.setupScrollSpy();
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  private buildToc() {
    const headings = this.contentElement.querySelectorAll('h2, h3');
    const items: TocItem[] = [];
    
    headings.forEach((heading, index) => {
      const text = heading.textContent || '';
      // 如果標題沒有 ID，自動生成一個
      if (!heading.id) {
        heading.id = `toc-heading-${index}`;
      }
      items.push({
        id: heading.id,
        text: text,
        level: Number(heading.tagName.substring(1))
      });
    });
    
    this.tocItems.set(items);
    this.setupScrollSpy();
  }

  private setupScrollSpy() {
    this.observer?.disconnect();
    
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // 當元素進入視窗上半部時才高亮
          this.activeId.set(entry.target.id);
        }
      });
    }, {
      rootMargin: '-80px 0px -80% 0px' // 更精準的觸發範圍
    });

    const headings = this.contentElement?.querySelectorAll('h2, h3');
    headings?.forEach(h => this.observer?.observe(h));
  }

  scrollTo(event: Event, id: string) {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('TOC Clicking ID:', id);
    const element = document.getElementById(id);
    
    if (element) {
      console.log('Element found, scrolling...');
      // 設置捲動位移（CSS 方式）
      element.style.scrollMarginTop = '100px'; 
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      
      this.activeId.set(id);
    } else {
      console.error('TOC: Element not found for ID:', id);
    }
  }
}
