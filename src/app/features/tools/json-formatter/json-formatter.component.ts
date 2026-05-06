import { Component, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ToolLayoutComponent } from '../tool-layout.component';
import { JsonNodeComponent } from './json-node.component';

@Component({
  selector: 'app-json-formatter',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatSnackBarModule,
    MatTabsModule,
    ToolLayoutComponent,
    JsonNodeComponent
  ],
  template: `
    <app-tool-layout 
      title="JSON 結構化工具" 
      description="不僅是格式化，更提供樹狀導覽與型別高亮，輕鬆解析複雜資料結構。">
      
      <div class="formatter-container">
        <!-- 左側輸入區 -->
        <div class="input-panel">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>原始 JSON 內容</mat-label>
            <textarea matInput
                      [(ngModel)]="inputJson"
                      rows="20"
                      placeholder='在此貼入您的 JSON...'
                      spellcheck="false">
            </textarea>
          </mat-form-field>

          <div class="actions">
            <button mat-raised-button color="primary" (click)="process()">
              <mat-icon>auto_fix_high</mat-icon> 解析並美化
            </button>
            <button mat-stroked-button (click)="clear()">
              <mat-icon>clear</mat-icon> 清除
            </button>
          </div>
        </div>

        <!-- 右側檢視區 -->
        <div class="viewer-panel">
          @if (error()) {
            <mat-card appearance="outlined" class="error-card">
              <mat-icon color="error">error_outline</mat-icon>
              <div class="error-content">
                <div class="error-title">解析失敗</div>
                <p class="error-text">{{ error() }}</p>
              </div>
            </mat-card>
          } @else if (parsedData()) {
            <mat-card appearance="outlined" class="viewer-card">
              <mat-tab-group animationDuration="0ms">
                <mat-tab>
                  <ng-template mat-tab-label>
                    <mat-icon>account_tree</mat-icon> 樹狀結構
                  </ng-template>
                  <div class="tree-viewer">
                    <app-json-node [value]="parsedData()"></app-json-node>
                  </div>
                </mat-tab>
                <mat-tab>
                  <ng-template mat-tab-label>
                    <mat-icon>code</mat-icon> 純文字
                  </ng-template>
                  <div class="text-viewer">
                    <pre>{{ formattedJson() }}</pre>
                    <button mat-mini-fab class="copy-fab" (click)="copy()" matTooltip="複製 JSON">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                  </div>
                </mat-tab>
              </mat-tab-group>
            </mat-card>
          } @else {
            <div class="empty-viewer">
              <mat-icon>segment</mat-icon>
              <p>請在左側貼入 JSON 後點擊「解析」</p>
            </div>
          }
        </div>
      </div>
    </app-tool-layout>
  `,
  styles: [`
    .formatter-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: start;
    }
    
    @media (max-width: 1024px) {
      .formatter-container { grid-template-columns: 1fr; }
    }

    .full-width { width: 100%; }
    
    .input-panel {
      position: sticky;
      top: 24px;
    }

    .actions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }

    .viewer-panel {
      min-width: 0; /* 關鍵：防止 grid 內容撐破 */
    }

    .viewer-card {
      min-height: 500px;
      border-radius: 12px;
      overflow: hidden;
      background: color-mix(in srgb, currentColor 2%, transparent);
      display: flex;
      flex-direction: column;
    }

    .tree-viewer, .text-viewer {
      padding: 24px;
      max-height: calc(100vh - 350px);
      overflow-y: auto;
      overflow-x: hidden; /* 已有 word-break，隱藏多餘捲軸 */
    }

    .text-viewer {
      position: relative;
    }
    .text-viewer pre {
      margin: 0;
      font-family: 'Roboto Mono', monospace;
      font-size: 0.85rem;
      color: var(--mat-sys-primary);
      white-space: pre-wrap;
      word-break: break-all;
    }

    .copy-fab {
      position: absolute;
      right: 24px;
      top: 24px;
      opacity: 0.7;
    }
    .copy-fab:hover { opacity: 1; }

    .error-card {
      padding: 16px;
      display: flex;
      gap: 16px;
      border-color: var(--mat-sys-error);
      background: color-mix(in srgb, var(--mat-sys-error) 5%, transparent);
    }
    .error-title { font-weight: 700; color: var(--mat-sys-error); margin-bottom: 4px; }
    .error-text { margin: 0; opacity: 0.8; font-family: monospace; font-size: 0.85rem; }

    .empty-viewer {
      height: 400px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0.2;
      border: 2px dashed currentColor;
      border-radius: 12px;
    }
    .empty-viewer mat-icon { font-size: 4rem; width: 4rem; height: 4rem; margin-bottom: 16px; }
  `]
})
export class JsonFormatterComponent {
  private snackBar = inject(MatSnackBar);
  
  inputJson = '';
  parsedData = signal<any>(null);
  error = signal('');

  formattedJson = computed(() => {
    const data = this.parsedData();
    return data ? JSON.stringify(data, null, 2) : '';
  });

  process(): void {
    if (!this.inputJson.trim()) {
      this.clear();
      return;
    }
    this.error.set('');
    try {
      this.parsedData.set(JSON.parse(this.inputJson));
    } catch (e) {
      this.parsedData.set(null);
      this.error.set((e as Error).message);
    }
  }

  copy(): void {
    const text = this.formattedJson();
    if (text) {
      navigator.clipboard.writeText(text);
      this.snackBar.open('JSON 已複製', '確定', { duration: 2000 });
    }
  }

  clear(): void {
    this.inputJson = '';
    this.parsedData.set(null);
    this.error.set('');
  }
}
