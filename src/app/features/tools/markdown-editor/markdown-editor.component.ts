import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '../../../core/services/theme.service';
import { ToolLayoutComponent } from '../tool-layout.component';
import { buildMarkdownPreview, escapeHtml } from './markdown-preview';

type MermaidApi = typeof import('mermaid').default;
type ViewMode = 'split' | 'edit' | 'preview';
type TemplateId = 'flowchart' | 'sequence' | 'er';

const STORAGE_KEY = 'kc_smart_notepad_content';
const TEMPLATES: Record<TemplateId, string> = {
  flowchart: '```mermaid\ngraph LR\n    A[步驟一] --> B(步驟二)\n    B --> C{決策點}\n    C -->|選項1| D[結果A]\n    C -->|選項2| E[結果B]\n```\n',
  sequence: '```mermaid\nsequenceDiagram\n    A->>B: 請求\n    B-->>A: 回應\n```\n',
  er: '```mermaid\nerDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains\n    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses\n```\n',
};

let mermaidLoader: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  mermaidLoader ??= import('mermaid').then((m) => m.default);
  return mermaidLoader;
}

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    ToolLayoutComponent,
  ],
  template: `
    <app-tool-layout
      title="智慧編輯器"
      description="本機 Markdown 筆記本。預覽與 Mermaid 圖都在瀏覽器運算，內容只存在這台裝置。"
      [fullWidth]="true">

      <div class="editor-actions">
        <button mat-stroked-button type="button" (click)="insertTemplate('flowchart')">
          <mat-icon>schema</mat-icon> 流程圖
        </button>
        <button mat-stroked-button type="button" (click)="insertTemplate('sequence')">
          <mat-icon>swap_horiz</mat-icon> 時序圖
        </button>
        <button mat-stroked-button type="button" (click)="insertTemplate('er')">
          <mat-icon>database</mat-icon> ER 模型
        </button>
        <span class="spacer"></span>
        <div class="view-toggle" role="group" aria-label="檢視模式">
          <button mat-icon-button type="button" (click)="viewMode.set('edit')"
            [class.active]="viewMode() === 'edit'" matTooltip="只編輯">
            <mat-icon>edit</mat-icon>
          </button>
          <button mat-icon-button type="button" (click)="viewMode.set('split')"
            [class.active]="viewMode() === 'split'" matTooltip="並排">
            <mat-icon>vertical_split</mat-icon>
          </button>
          <button mat-icon-button type="button" (click)="viewMode.set('preview')"
            [class.active]="viewMode() === 'preview'" matTooltip="只預覽">
            <mat-icon>visibility</mat-icon>
          </button>
        </div>
        <button mat-icon-button type="button" (click)="copyMarkdown()" matTooltip="複製 Markdown">
          <mat-icon>content_copy</mat-icon>
        </button>
        <button mat-icon-button type="button" (click)="downloadMarkdown()" matTooltip="下載 .md">
          <mat-icon>download</mat-icon>
        </button>
        <button mat-icon-button type="button" (click)="clearContent()" matTooltip="清空">
          <mat-icon>delete</mat-icon>
        </button>
      </div>

      <div class="editor-main" [class]="'editor-main mode-' + viewMode()">
        <div class="panel edit-panel">
          <textarea
            #editor
            [value]="content()"
            (input)="onInput($event)"
            (keydown)="onEditorKeydown($event)"
            placeholder="在此輸入 Markdown…"
            spellcheck="false"
            aria-label="Markdown 編輯區"
          ></textarea>
        </div>
        <div class="panel preview-panel">
          <div
            #preview
            class="preview-content markdown-body"
            [innerHTML]="safeHtml()"
          ></div>
        </div>
      </div>

      <div class="editor-footer">
        <span>
          {{ content().length }} 字 · {{ lineCount() }} 行 ·
          <span class="save-status" [class.pending]="saveState() === 'saving'">
            {{ saveState() === 'saving' ? '儲存中' : '已存到本機' }}
          </span>
        </span>
        <span class="engine-status" [class.ready]="mermaidReady()">
          @if (previewModel().mermaid.size === 0) {
            無圖表
          } @else if (mermaidReady()) {
            圖表就緒
          } @else {
            圖表載入中
          }
        </span>
      </div>
    </app-tool-layout>
  `,
  styles: [`
    .editor-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 16px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border-color);
    }
    .spacer { flex: 1; min-width: 8px; }
    .view-toggle { display: flex; border: 1px solid var(--border-color); border-radius: var(--radius-sm); }
    .view-toggle button.active { color: var(--accent-color); background: var(--accent-softer); }

    .editor-main {
      display: grid;
      gap: 2px;
      height: calc(100vh - 340px);
      min-height: 480px;
      background: var(--border-color);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border-color);
    }
    .editor-main.mode-split { grid-template-columns: 1fr 1fr; }
    .editor-main.mode-edit,
    .editor-main.mode-preview { grid-template-columns: 1fr; }
    .editor-main.mode-edit .preview-panel,
    .editor-main.mode-preview .edit-panel { display: none; }

    .panel { background: var(--surface-color); height: 100%; overflow: auto; }
    .edit-panel textarea {
      width: 100%;
      height: 100%;
      border: none;
      padding: 24px;
      resize: none;
      background: transparent;
      color: var(--text-primary);
      font-family: 'Fira Code', 'Roboto Mono', monospace;
      font-size: 1rem;
      line-height: 1.7;
      outline: none;
    }
    .preview-panel { padding: 24px; background: var(--bg-color); }

    :host ::ng-deep .preview-content pre {
      padding: 16px 20px;
      border-radius: 10px;
      overflow-x: auto;
      background: var(--surface-alt);
      border: 1px solid var(--border-color);
    }
    :host ::ng-deep .preview-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    :host ::ng-deep .preview-content th,
    :host ::ng-deep .preview-content td {
      border: 1px solid var(--border-color);
      padding: 8px 10px;
    }

    :host ::ng-deep .md-diagram {
      position: relative;
      background: var(--surface-color);
      border-radius: 12px;
      margin: 20px 0;
      border: 1px solid var(--border-color);
      overflow: hidden;
    }
    :host ::ng-deep .md-diagram-toolbar {
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      gap: 6px;
      z-index: 2;
      opacity: 0;
      transition: opacity var(--transition-fast);
    }
    :host ::ng-deep .md-diagram:hover .md-diagram-toolbar { opacity: 1; }
    :host ::ng-deep .md-diagram-btn {
      background: var(--surface-alt);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      min-width: 32px;
      height: 32px;
      cursor: pointer;
      color: var(--text-primary);
      font-size: 14px;
    }
    :host ::ng-deep .md-diagram-btn:hover {
      background: var(--accent-color);
      color: var(--accent-on);
    }
    :host ::ng-deep .md-diagram-canvas {
      width: 100%;
      height: 420px;
      cursor: grab;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      user-select: none;
    }
    :host ::ng-deep .md-diagram-canvas:active { cursor: grabbing; }
    :host ::ng-deep .md-diagram-canvas svg {
      transform-origin: center;
      max-width: none !important;
      height: auto !important;
    }
    :host ::ng-deep .md-diagram-error {
      margin: 16px 0;
      padding: 12px 16px;
      border-radius: 8px;
      background: var(--state-danger-soft);
      color: var(--state-danger);
      font-size: 0.9rem;
    }

    .editor-footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 12px 4px;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .save-status { color: var(--state-success); font-weight: 600; }
    .save-status.pending { color: var(--text-muted); font-weight: 500; }
    .engine-status { color: var(--text-muted); }
    .engine-status.ready { color: var(--state-success); }

    @media (max-width: 900px) {
      .editor-main.mode-split { grid-template-columns: 1fr; min-height: 720px; }
      .editor-main.mode-split .edit-panel,
      .editor-main.mode-split .preview-panel { min-height: 360px; }
    }
  `],
})
export class MarkdownEditorComponent {
  private sanitizer = inject(DomSanitizer);
  private snackBar = inject(MatSnackBar);
  private themeService = inject(ThemeService);

  private editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  private preview = viewChild<ElementRef<HTMLElement>>('preview');

  content = signal(this.readStored());
  viewMode = signal<ViewMode>('split');
  mermaidReady = signal(false);
  saveState = signal<'saved' | 'saving'>('saved');

  private mermaidApi: MermaidApi | null = null;
  private mermaidSeq = 0;
  private paintGen = 0;
  private lastMermaidTheme: string | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private drag: { canvas: HTMLElement; svg: HTMLElement; startX: number; startY: number } | null = null;
  private listenersBound = false;

  previewModel = computed(() => buildMarkdownPreview(this.content()));
  lineCount = computed(() => this.content().split('\n').length);
  safeHtml = computed<SafeHtml>(() => {
    const theme = this.themeService.theme();
    return this.sanitizer.bypassSecurityTrustHtml(
      `<!--theme:${theme}-->${this.previewModel().html}`
    );
  });

  constructor() {
    void this.bootMermaid();

    afterNextRender(() => this.bindPreviewOnce());

    effect((onCleanup) => {
      this.safeHtml();
      this.themeService.theme();
      if (!this.mermaidReady()) {
        return;
      }
      const timer = setTimeout(() => void this.paintMermaid(), 280);
      onCleanup(() => clearTimeout(timer));
    });
  }

  onInput(event: Event) {
    this.content.set((event.target as HTMLTextAreaElement).value);
    this.queueSave();
  }

  onEditorKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') {
      return;
    }
    event.preventDefault();
    this.insertAtCursor('  ');
  }

  insertTemplate(type: TemplateId) {
    this.insertAtCursor(`\n${TEMPLATES[type]}`);
  }

  copyMarkdown() {
    void navigator.clipboard.writeText(this.content());
    this.snackBar.open('Markdown 已複製', '確定', { duration: 2000 });
  }

  downloadMarkdown() {
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([this.content()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `note-${stamp}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  clearContent() {
    if (!this.content() || !confirm('確定要清空本機筆記嗎？')) {
      return;
    }
    this.content.set('');
    localStorage.removeItem(STORAGE_KEY);
    this.saveState.set('saved');
    this.snackBar.open('已清空', '確定', { duration: 2000 });
  }

  private readStored(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? this.defaultNote();
    } catch {
      return this.defaultNote();
    }
  }

  private queueSave() {
    this.saveState.set('saving');
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, this.content());
        this.saveState.set('saved');
      } catch {
        this.snackBar.open('本機儲存失敗（空間可能已滿）', '確定', { duration: 3000 });
      }
    }, 280);
  }

  private insertAtCursor(snippet: string) {
    const area = this.editor()?.nativeElement;
    if (!area) {
      this.content.update((current) => current + snippet);
      this.queueSave();
      return;
    }
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const next = this.content().slice(0, start) + snippet + this.content().slice(end);
    this.content.set(next);
    this.queueSave();
    queueMicrotask(() => {
      const cursor = start + snippet.length;
      area.focus();
      area.setSelectionRange(cursor, cursor);
    });
  }

  private async bootMermaid() {
    try {
      const mermaid = await loadMermaid();
      await mermaid.initialize(this.mermaidConfig());
      this.mermaidApi = mermaid;
      this.lastMermaidTheme = this.themeService.theme();
      this.mermaidReady.set(true);
    } catch {
      this.snackBar.open('圖表引擎載入失敗，文字預覽仍可用', '確定', { duration: 4000 });
    }
  }

  private mermaidConfig() {
    return {
      startOnLoad: false,
      securityLevel: 'strict' as const,
      theme: this.themeService.theme() === 'dark' ? 'dark' as const : 'neutral' as const,
      fontFamily: 'inherit',
    };
  }

  private async paintMermaid() {
    const api = this.mermaidApi;
    const host = this.preview()?.nativeElement;
    if (!api || !host) {
      return;
    }

    const gen = ++this.paintGen;
    const theme = this.themeService.theme();
    if (this.lastMermaidTheme !== theme) {
      await api.initialize(this.mermaidConfig());
      this.lastMermaidTheme = theme;
    }
    if (gen !== this.paintGen) {
      return;
    }
    const defs = this.previewModel().mermaid;

    for (const slot of Array.from(host.querySelectorAll<HTMLElement>('.md-mermaid-slot'))) {
      const id = slot.dataset['mid'];
      const definition = id ? defs.get(id) : undefined;
      if (!definition) {
        continue;
      }
      try {
        const renderId = `mdm${++this.mermaidSeq}`;
        const { svg, bindFunctions } = await api.render(renderId, definition);
        const holder = document.createElement('div');
        holder.innerHTML = this.wrapDiagram(svg);
        const node = holder.firstElementChild;
        if (!node) {
          continue;
        }
        slot.replaceWith(node);
        bindFunctions?.(node);
      } catch (error) {
        const message = error instanceof Error ? error.message : '圖表語法錯誤';
        slot.outerHTML = `<p class="md-diagram-error">${escapeHtml(message)}</p>`;
      }
    }

    this.bindPreviewOnce();
    host.querySelectorAll<HTMLElement>('.md-diagram').forEach((viewer) => this.autoFit(viewer));
  }

  private wrapDiagram(svg: string): string {
    return `
      <div class="md-diagram">
        <div class="md-diagram-toolbar">
          <button type="button" class="md-diagram-btn" data-act="in" title="放大">+</button>
          <button type="button" class="md-diagram-btn" data-act="out" title="縮小">−</button>
          <button type="button" class="md-diagram-btn" data-act="fit" title="適應視窗">適應</button>
          <button type="button" class="md-diagram-btn" data-act="reset" title="原始大小">1:1</button>
        </div>
        <div class="md-diagram-canvas">${svg}</div>
      </div>`;
  }

  private bindPreviewOnce() {
    if (this.listenersBound) {
      return;
    }
    const host = this.preview()?.nativeElement;
    if (!host) {
      return;
    }
    this.listenersBound = true;
    host.addEventListener('click', (event) => this.onPreviewClick(event));
    host.addEventListener('wheel', (event) => this.onPreviewWheel(event), { passive: false });
    host.addEventListener('pointerdown', (event) => this.onPreviewPointerDown(event));
    host.addEventListener('pointermove', (event) => this.onPreviewPointerMove(event));
    host.addEventListener('pointerup', () => { this.drag = null; });
    host.addEventListener('pointercancel', () => { this.drag = null; });
  }

  private onPreviewClick(event: Event) {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!button) {
      return;
    }
    const viewer = button.closest<HTMLElement>('.md-diagram');
    const svg = viewer?.querySelector<HTMLElement>('svg');
    if (!viewer || !svg) {
      return;
    }
    const scale = this.readNumber(svg, 'data-scale', 1);
    switch (button.dataset['act']) {
      case 'in':
        this.applyTransform(svg, Math.min(scale * 1.25, 12));
        break;
      case 'out':
        this.applyTransform(svg, Math.max(scale * 0.8, 0.08));
        break;
      case 'fit':
        this.autoFit(viewer);
        break;
      case 'reset':
        this.applyTransform(svg, 1, 0, 0);
        break;
    }
  }

  private onPreviewWheel(event: WheelEvent) {
    const canvas = (event.target as HTMLElement).closest<HTMLElement>('.md-diagram-canvas');
    const svg = canvas?.querySelector<HTMLElement>('svg');
    if (!svg) {
      return;
    }
    event.preventDefault();
    const scale = this.readNumber(svg, 'data-scale', 1);
    const next = event.deltaY > 0 ? scale * 0.9 : scale * 1.1;
    this.applyTransform(svg, Math.min(Math.max(next, 0.08), 12));
  }

  private onPreviewPointerDown(event: PointerEvent) {
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    const canvas = (event.target as HTMLElement).closest<HTMLElement>('.md-diagram-canvas');
    const svg = canvas?.querySelector<HTMLElement>('svg');
    if (!canvas || !svg) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    this.drag = {
      canvas,
      svg,
      startX: event.clientX - this.readNumber(svg, 'data-x', 0),
      startY: event.clientY - this.readNumber(svg, 'data-y', 0),
    };
  }

  private onPreviewPointerMove(event: PointerEvent) {
    if (!this.drag) {
      return;
    }
    this.applyTransform(
      this.drag.svg,
      this.readNumber(this.drag.svg, 'data-scale', 1),
      event.clientX - this.drag.startX,
      event.clientY - this.drag.startY,
    );
  }

  private autoFit(viewer: HTMLElement) {
    const canvas = viewer.querySelector<HTMLElement>('.md-diagram-canvas');
    const svg = canvas?.querySelector<SVGSVGElement>('svg');
    if (!canvas || !svg) {
      return;
    }
    svg.style.transform = 'none';
    const box = svg.viewBox.baseVal;
    const svgW = box.width || svg.clientWidth || 300;
    const svgH = box.height || svg.clientHeight || 150;
    const scale = Math.min((canvas.clientWidth - 40) / svgW, (canvas.clientHeight - 40) / svgH, 1.2);
    this.applyTransform(svg as unknown as HTMLElement, scale, 0, 0);
  }

  private applyTransform(svg: HTMLElement, scale: number, x?: number, y?: number) {
    const nextX = x ?? this.readNumber(svg, 'data-x', 0);
    const nextY = y ?? this.readNumber(svg, 'data-y', 0);
    svg.style.transform = `translate(${nextX}px, ${nextY}px) scale(${scale})`;
    svg.setAttribute('data-scale', String(scale));
    svg.setAttribute('data-x', String(nextX));
    svg.setAttribute('data-y', String(nextY));
  }

  private readNumber(el: HTMLElement, name: string, fallback: number): number {
    const raw = el.getAttribute(name);
    const value = raw == null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  private defaultNote(): string {
    return `# 本機筆記本

左側編輯、右側預覽。內容存在這台瀏覽器，不會送到伺服器。

## Mermaid

\`\`\`mermaid
graph LR
    A[起草] --> B[預覽]
    B --> C{沒問題?}
    C -->|是| D[複製或下載]
    C -->|否| A
\`\`\`
`;
  }
}
