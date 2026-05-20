import { Component, signal, computed, inject, AfterViewInit, ViewChild, ElementRef, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ToolLayoutComponent } from '../tool-layout.component';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ThemeService } from '../../../core/services/theme.service';

declare const mermaid: any;

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule, MatIconModule, MatTooltipModule, MatSnackBarModule,
    ToolLayoutComponent
  ],
  template: `
    <app-tool-layout 
      title="智慧編輯器" 
      description="支援 Markdown 與 Mermaid 流程圖，提供全自動視角適應與互動縮放。"
      [fullWidth]="true">
      
      <div class="editor-actions">
        <button mat-stroked-button (click)="insertTemplate('flowchart')">
          <mat-icon>schema</mat-icon> 流程圖範本
        </button>
        <button mat-stroked-button (click)="insertTemplate('sequence')">
          <mat-icon>swap_horiz</mat-icon> 時序圖範本
        </button>
        <button mat-stroked-button (click)="insertTemplate('er')">
          <mat-icon>database</mat-icon> ER 模型
        </button>
        <span class="spacer"></span>
        <button mat-icon-button (click)="copyMarkdown()" matTooltip="複製 Markdown">
          <mat-icon>content_copy</mat-icon>
        </button>
        <button mat-icon-button (click)="clearContent()" matTooltip="清空內容">
          <mat-icon>delete</mat-icon>
        </button>
      </div>

      <div class="editor-main">
        <div class="panel edit-panel">
          <textarea
            #editor
            [value]="content()"
            (input)="onInput($event)"
            placeholder="在此輸入 Markdown 語法..."
            spellcheck="false"
          ></textarea>
        </div>

        <div class="panel preview-panel">
          <div class="preview-content markdown-body" [innerHTML]="safeHtml()"></div>
        </div>
      </div>

      <div class="editor-footer">
        <span>字數: {{ content().length }} | 狀態: <span class="save-status">已自動存檔</span></span>
        <div class="controls">
          <span class="hint">✨ 初始自動縮放已啟動 | 支援滾輪與拖曳</span>
          <span class="status-badge" [class.ready]="isMermaidLoaded()">
            {{ isMermaidLoaded() ? 'Engine Ready' : 'Initializing...' }}
          </span>
        </div>
      </div>
    </app-tool-layout>
  `,
  styles: [`
    .editor-actions { display: flex; gap: 12px; margin-bottom: 16px; padding: 8px 0; border-bottom: 1px solid var(--border-color); }
    .spacer { flex: 1; }
    .editor-main { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; height: calc(100vh - 350px); min-height: 600px; background: var(--border-color); border-radius: 12px; overflow: hidden; border: 1px solid var(--border-color); }
    .panel { background: var(--surface-color); height: 100%; overflow-y: auto; }
    .edit-panel textarea { width: 100%; height: 100%; border: none; padding: 32px; resize: none; background: transparent; color: var(--text-primary); font-family: 'Fira Code', 'Roboto Mono', monospace; font-size: 1rem; line-height: 1.7; outline: none; }
    .preview-panel { padding: 32px; background: var(--bg-color); }
    
    :host ::ng-deep .mermaid-viewer { position: relative; background: var(--surface-color); border-radius: 12px; margin: 24px 0; border: 1px solid var(--border-color); overflow: hidden; box-shadow: var(--card-shadow); }
    :host ::ng-deep .mermaid-header { position: absolute; top: 12px; right: 12px; display: flex; gap: 6px; z-index: 10; opacity: 0; transition: opacity 0.2s; }
    :host ::ng-deep .mermaid-viewer:hover .mermaid-header { opacity: 1; }
    :host ::ng-deep .mermaid-btn { background: var(--surface-alt); border: 1px solid var(--border-color); border-radius: 6px; padding: 6px; cursor: pointer; display: flex; align-items: center; color: var(--text-primary); box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
    :host ::ng-deep .mermaid-btn:hover { background: var(--accent-color); color: #fff; transform: scale(1.05); }
    
    :host ::ng-deep .mermaid-canvas { width: 100%; height: 450px; cursor: grab; display: flex; justify-content: center; align-items: center; overflow: hidden; user-select: none; }
    :host ::ng-deep .mermaid-canvas:active { cursor: grabbing; }
    :host ::ng-deep .mermaid-canvas svg { transition: transform 0.1s ease-out; transform-origin: center; will-change: transform; max-width: none !important; height: auto !important; }
    
    .editor-footer { display: flex; justify-content: space-between; padding: 12px 8px; font-size: 0.85rem; color: var(--text-secondary); opacity: 0.8; }
    .controls { display: flex; gap: 16px; align-items: center; }
    .hint { font-size: 0.75rem; color: var(--text-muted); font-style: italic; }
    .status-badge { padding: 2px 8px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10b981; font-weight: 500; }
    .save-status { color: #10b981; font-weight: 600; }
    @media (max-width: 1200px) { .editor-main { grid-template-columns: 1fr; height: auto; } }
  `]
})
export class MarkdownEditorComponent implements AfterViewInit {
  @ViewChild('editor') editorElement!: ElementRef<HTMLTextAreaElement>;
  private sanitizer = inject(DomSanitizer);
  private snackBar = inject(MatSnackBar);
  private themeService = inject(ThemeService);
  private STORAGE_KEY = 'kc_smart_notepad_content';
  
  content = signal<string>('');
  isMermaidLoaded = signal(false);
  private renderTimer: any;

  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    this.content.set(saved || this.getDefaultContent());

    effect(() => {
      const theme = this.themeService.theme();
      if (this.isMermaidLoaded()) {
        this.reinitMermaid(theme);
      }
    });

    effect(() => {
      if (this.safeHtml() && this.isMermaidLoaded()) {
        if (this.renderTimer) clearTimeout(this.renderTimer);
        this.renderTimer = setTimeout(() => this.renderAndBind(), 400);
      }
    });
  }

  safeHtml = computed<SafeHtml>(() => {
    try {
      const renderer = new marked.Renderer();
      renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
        if (lang === 'mermaid') {
          return `
            <div class="mermaid-viewer">
              <div class="mermaid-header">
                <button class="mermaid-btn" onclick="window.zoomMermaid(this, 1.25)" title="放大">🔍+</button>
                <button class="mermaid-btn" onclick="window.zoomMermaid(this, 0.8)" title="縮小">🔍-</button>
                <button class="mermaid-btn" onclick="window.autoFitMermaid(this)" title="自動適應視窗">📺</button>
                <button class="mermaid-btn" onclick="window.resetMermaid(this)" title="重置 1:1">🏠</button>
              </div>
              <div class="mermaid-canvas">
                <div class="mermaid-container">${text}</div>
              </div>
            </div>`;
        }
        return `<pre><code class="language-${lang}">${text}</code></pre>`;
      };
      const rawHtml = marked.parse(this.content(), { renderer }) as string;
      return this.sanitizer.bypassSecurityTrustHtml(rawHtml);
    } catch (e) { return 'Markdown 解析錯誤'; }
  });

  ngAfterViewInit() { 
    this.setupGlobalControls();
    this.initMermaid(); 
  }

  private setupGlobalControls() {
    (window as any).zoomMermaid = (btn: HTMLElement, factor: number) => {
      const canvas = btn.closest('.mermaid-viewer')?.querySelector('.mermaid-canvas svg') as HTMLElement;
      if (canvas) {
        const currentScale = parseFloat(canvas.getAttribute('data-scale') || '1');
        const newScale = Math.min(Math.max(currentScale * factor, 0.1), 10);
        this.applyTransform(canvas, newScale);
      }
    };
    (window as any).resetMermaid = (btn: HTMLElement) => {
      const canvas = btn.closest('.mermaid-viewer')?.querySelector('.mermaid-canvas svg') as HTMLElement;
      if (canvas) this.applyTransform(canvas, 1, 0, 0);
    };
    (window as any).autoFitMermaid = (btn: HTMLElement) => {
      const viewer = btn.closest('.mermaid-viewer') as HTMLElement;
      this.autoFit(viewer);
    };
  }

  private async initMermaid() {
    if (typeof mermaid !== 'undefined') {
      const currentTheme = this.themeService.theme();
      await mermaid.initialize({ 
        startOnLoad: false, 
        theme: currentTheme === 'dark' ? 'dark' : 'neutral', 
        securityLevel: 'loose',
        fontFamily: 'inherit'
      });
      this.isMermaidLoaded.set(true);
      this.renderAndBind();
    } else { setTimeout(() => this.initMermaid(), 800); }
  }

  private async reinitMermaid(theme: string) {
    if (typeof mermaid !== 'undefined') {
      await mermaid.initialize({ 
        theme: theme === 'dark' ? 'dark' : 'neutral' 
      });
      this.renderAndBind();
    }
  }

  private async renderAndBind() {
    if (!this.isMermaidLoaded()) return;
    try {
      await mermaid.run({ querySelector: '.mermaid-container' });
      // 渲染後自動執行 Auto-Fit
      const viewers = document.querySelectorAll('.mermaid-viewer');
      viewers.forEach((v: any) => this.autoFit(v));
      this.bindInteractions();
    } catch (err) { console.warn('Render error', err); }
  }

  private autoFit(viewer: HTMLElement) {
    const canvas = viewer.querySelector('.mermaid-canvas') as HTMLElement;
    const svg = canvas.querySelector('svg') as any;
    if (!svg) return;

    // 清除舊轉換以讀取原始寬高
    svg.style.transform = 'none';
    
    const containerW = canvas.clientWidth - 40; // 預留邊距
    const containerH = canvas.clientHeight - 40;
    
    // 優先讀取 viewBox, 若無則讀取實體尺寸
    const viewBox = svg.viewBox.baseVal;
    const svgW = viewBox.width || svg.clientWidth || 300;
    const svgH = viewBox.height || svg.clientHeight || 150;

    const scaleW = containerW / svgW;
    const scaleH = containerH / svgH;
    const bestScale = Math.min(scaleW, scaleH, 1.2); // 最大不超過 1.2 倍避免失真

    this.applyTransform(svg, bestScale, 0, 0);
  }

  private applyTransform(svg: HTMLElement, s: number, x: number = 0, y: number = 0) {
    // 如果已有座標則繼承
    const curX = x || parseFloat(svg.getAttribute('data-x') || '0');
    const curY = y || parseFloat(svg.getAttribute('data-y') || '0');
    svg.style.transform = `translate(${curX}px, ${curY}px) scale(${s})`;
    svg.setAttribute('data-scale', s.toString());
    svg.setAttribute('data-x', curX.toString());
    svg.setAttribute('data-y', curY.toString());
  }

  private bindInteractions() {
    const canvases = document.querySelectorAll('.mermaid-canvas');
    canvases.forEach((canvas: any) => {
      if (canvas.getAttribute('data-bound')) return;
      
      let isDragging = false;
      let startX = 0, startY = 0;
      const svg = canvas.querySelector('svg');
      if (!svg) return;

      canvas.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        const s = parseFloat(svg.getAttribute('data-scale') || '1');
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        this.applyTransform(svg, Math.min(Math.max(s * factor, 0.05), 15));
      }, { passive: false });

      canvas.addEventListener('mousedown', (e: MouseEvent) => {
        isDragging = true;
        startX = e.clientX - parseFloat(svg.getAttribute('data-x') || '0');
        startY = e.clientY - parseFloat(svg.getAttribute('data-y') || '0');
      });

      window.addEventListener('mousemove', (e: MouseEvent) => {
        if (!isDragging) return;
        const x = e.clientX - startX;
        const y = e.clientY - startY;
        this.applyTransform(svg, parseFloat(svg.getAttribute('data-scale') || '1'), x, y);
      });

      window.addEventListener('mouseup', () => isDragging = false);
      canvas.setAttribute('data-bound', 'true');
    });
  }

  onInput(event: Event) {
    const value = (event.target as HTMLTextAreaElement).value;
    this.content.set(value);
    localStorage.setItem(this.STORAGE_KEY, value);
  }

  insertTemplate(type: 'flowchart' | 'sequence' | 'er') {
    const templates = {
      flowchart: `\n\`\`\`mermaid\ngraph LR\n    A[步驟一] --> B(步驟二)\n    B --> C{決策點}\n    C -->|選項1| D[結果A]\n    C -->|選項2| E[結果B]\n\`\`\`\n`,
      sequence: `\n\`\`\`mermaid\nsequenceDiagram\n    A->>B: 請求\n    B-->>A: 回應\n\`\`\`\n`,
      er: `\n\`\`\`mermaid\nerDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains\n    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses\n\`\`\`\n`
    };
    this.content.update(c => c + templates[type]);
    if (this.editorElement) this.editorElement.nativeElement.value = this.content();
    localStorage.setItem(this.STORAGE_KEY, this.content());
  }

  copyMarkdown() {
    navigator.clipboard.writeText(this.content());
    this.snackBar.open('Markdown 已複製', '確定', { duration: 2000 });
  }

  clearContent() {
    if (confirm('確定要清空所有內容嗎？')) {
      this.content.set('');
      if (this.editorElement) this.editorElement.nativeElement.value = '';
      localStorage.removeItem(this.STORAGE_KEY);
      this.snackBar.open('已清空', '確定', { duration: 2000 });
    }
  }

  private getDefaultContent(): string {
    return `# 智慧自動縮放編輯器\n\n## 💡 自動適應測試\n這個大型圖表在載入時會自動縮小以適應視窗。\n\n\`\`\`mermaid\ngraph LR\n    A[超長路徑] --> B[核心節點]\n    B --> C1[分支一]\n    B --> C2[分支二]\n    B --> C3[分支三]\n    C1 --> D1[細節一]\n    C2 --> D2[細節二]\n    C3 --> D3[細節三]\n    D1 --> E[終點]\n    D2 --> E\n    D3 --> E\n\`\`\`\n`;
  }
}
