import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-json-node',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="json-node-row">
      <!-- 展開/摺疊按鈕 -->
      @if (isExpandable) {
        <button class="toggle-btn" (click)="toggle()">
          <mat-icon>{{ isExpanded() ? 'expand_more' : 'chevron_right' }}</mat-icon>
        </button>
      } @else {
        <span class="no-toggle"></span>
      }

      <!-- 欄位名稱 -->
      @if (key) {
        <span class="key">"{{ key }}"</span>
        <span class="separator">: </span>
      }

      <!-- 值或容器預覽 -->
      @if (!isExpandable) {
        <span class="value" [ngClass]="'type-' + valueType">{{ formatValue(value) }}</span>
      } @else {
        <span class="preview-text" (click)="toggle()">
          {{ isArray ? '[' : '{' }}
          @if (!isExpanded()) {
            <span class="summary">{{ summary }}</span>
            {{ isArray ? ']' : '}' }}
          }
        </span>
      }
    </div>

    <!-- 子節點遞迴渲染 -->
    @if (isExpandable && isExpanded()) {
      <div class="children">
        @for (item of childNodes; track $index) {
          <app-json-node [key]="item.key" [value]="item.value"></app-json-node>
        }
        <div class="closing-bracket">{{ isArray ? ']' : '}' }}</div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; font-family: 'Roboto Mono', 'Cascadia Code', monospace; font-size: 0.9rem; line-height: 1.5; }
    .json-node-row { display: flex; align-items: flex-start; padding: 1px 0; cursor: default; }
    .toggle-btn { background: none; border: none; color: currentColor; opacity: 0.5; padding: 0; cursor: pointer; display: flex; align-items: center; width: 24px; justify-content: center; transition: opacity 0.2s; }
    .toggle-btn:hover { opacity: 1; }
    .no-toggle { width: 24px; }
    .key { color: var(--mat-sys-primary); font-weight: 500; flex-shrink: 0; }
    .separator { margin-right: 8px; opacity: 0.7; flex-shrink: 0; }
    .value { color: #16a34a; word-break: break-all; white-space: pre-wrap; }
    .value.type-string { color: #d97706; }
    .value.type-number { color: #2563eb; }
    .value.type-boolean { color: #7c3aed; }
    .value.type-null { color: #94a3b8; font-style: italic; }
    
    .preview-text { opacity: 0.8; cursor: pointer; }
    .summary { font-size: 0.8rem; opacity: 0.5; font-style: italic; margin: 0 4px; }
    
    .children { border-left: 1px dashed color-mix(in srgb, currentColor 15%, transparent); margin-left: 11px; padding-left: 12px; }
    .closing-bracket { opacity: 0.6; }
  `]
})
export class JsonNodeComponent {
  @Input() key?: string;
  @Input() value: any;
  
  isExpanded = signal(true);

  get valueType(): string {
    if (this.value === null) return 'null';
    return typeof this.value;
  }

  get isArray(): boolean {
    return Array.isArray(this.value);
  }

  get isExpandable(): boolean {
    return this.value !== null && typeof this.value === 'object';
  }

  get childNodes(): { key?: string, value: any }[] {
    if (!this.isExpandable) return [];
    if (this.isArray) {
      return (this.value as any[]).map((v, i) => ({ value: v }));
    }
    return Object.entries(this.value).map(([k, v]) => ({ key: k, value: v }));
  }

  get summary(): string {
    if (this.isArray) return `${(this.value as any[]).length} items`;
    return `${Object.keys(this.value).length} keys`;
  }

  toggle() {
    this.isExpanded.update(v => !v);
  }

  formatValue(v: any): string {
    if (v === null) return 'null';
    if (typeof v === 'string') return `"${v}"`;
    return String(v);
  }
}
