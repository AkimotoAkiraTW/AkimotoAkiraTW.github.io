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
      description="不僅是格式化，更提供樹狀導覽與型別高亮，輕鬆解析複雜資料結構。"
      [fullWidth]="true">
      
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
              <div class="error-header">
                <mat-icon color="error">error_outline</mat-icon>
                <div class="error-title">解析失敗</div>
                <span class="spacer"></span>
                @if (canRepair()) {
                  <button mat-flat-button color="accent" size="small" (click)="repairAndCopy()">
                    <mat-icon>magic_button</mat-icon> 修復雜質並複製
                  </button>
                }
              </div>
              <div class="error-content">
                <p class="error-message">{{ error() }}</p>
                @if (errorDetail()) {
                  <pre class="error-detail"><code>{{ errorDetail() }}</code></pre>
                }
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
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      border-color: var(--mat-sys-error);
      background: color-mix(in srgb, var(--mat-sys-error) 5%, transparent);
      border-radius: 12px;
    }
    .error-header { display: flex; align-items: center; gap: 8px; width: 100%; }
    .spacer { flex: 1; }
    .error-title { font-weight: 700; color: var(--mat-sys-error); font-size: 1.1rem; }
    .error-message { margin: 0; font-weight: 500; opacity: 0.9; }
    .error-detail { 
      margin-top: 8px; 
      background: #1e1e1e; 
      color: #f87171; 
      padding: 16px; 
      border-radius: 8px; 
      font-family: 'Roboto Mono', monospace; 
      font-size: 0.85rem; 
      overflow-x: auto; 
      white-space: pre; 
      line-height: 1.5;
      border: 1px solid color-mix(in srgb, var(--mat-sys-error) 30%, transparent);
    }

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
  errorDetail = signal('');
  canRepair = signal(false);

  formattedJson = computed(() => {
    const data = this.parsedData();
    return data ? JSON.stringify(data, null, 2) : '';
  });

  process(): void {
    let raw = this.inputJson;
    if (!raw.trim()) {
      this.clear();
      return;
    }
    this.error.set('');
    this.errorDetail.set('');
    this.canRepair.set(false);

    // 檢查是否有雜質字元 (NBSP 或 控制字元)
    const hasImpurity = /[\u00A0\u0000-\u001F\u007F-\u009F]/.test(raw);
    if (hasImpurity) {
      this.canRepair.set(true);
    }

    try {
      this.parsedData.set(JSON.parse(raw));
    } catch (e) {
      this.parsedData.set(null);
      const err = e as Error;
      this.error.set('JSON 格式語法錯誤');
      
      // ... (座標解析邏輯保持不變)
      let pos = -1;
      const posMatch = err.message.match(/at position (\d+)/);
      const lcMatch = err.message.match(/at line (\d+) column (\d+)/);

      if (posMatch) {
        pos = parseInt(posMatch[1], 10);
      } else if (lcMatch) {
        pos = this.getPosFromLineCol(raw, parseInt(lcMatch[1], 10), parseInt(lcMatch[2], 10));
      }

      if (pos >= 0) {
        this.errorDetail.set(this.generateErrorSnippet(raw, pos, err.message));
      } else {
        this.errorDetail.set(`無法自動定位錯誤點，請檢查開頭與結尾是否完整。\n原始錯誤：${err.message}`);
      }
    }
  }

  repairAndCopy(): void {
    const raw = this.inputJson;
    const cleaned = raw
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // 移除控制字元
      .replace(/\u00A0/g, " "); // 轉為一般空格
    
    this.inputJson = cleaned;
    navigator.clipboard.writeText(cleaned);
    this.snackBar.open('雜質已修復並複製到剪貼簿！', '確定', { duration: 3000 });
    this.process(); // 重新解析一次
  }

  private getPosFromLineCol(text: string, line: number, col: number): number {
    const lines = text.split('\n');
    let pos = 0;
    for (let i = 0; i < line - 1; i++) {
      pos += lines[i].length + 1; // +1 為 \n
    }
    return pos + col - 1;
  }

  private generateErrorSnippet(json: string, pos: number, message: string): string {
    // 找出正確的行與列（用於顯示）
    const linesBefore = json.substring(0, pos).split('\n');
    const lineNum = linesBefore.length;
    const colNum = linesBefore[linesBefore.length - 1].length + 1;

    // 擷取前後文（寬度 40）
    const start = Math.max(0, pos - 40);
    const end = Math.min(json.length, pos + 40);
    let snippet = json.substring(start, end);
    
    // 視覺化處理：將不可見字元轉為可見標籤
    const visualize = (str: string) => str
      .replace(/\n/g, '↵')
      .replace(/\r/g, '↵')
      .replace(/\t/g, '⇥')
      .replace(/\u00A0/g, '[NBSP]')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, (match) => `[CTRL:0x${match.charCodeAt(0).toString(16)}]`);

    const fullVisualSnippet = visualize(snippet);
    const prefixVisual = visualize(json.substring(start, pos));
    const pointerSpace = ' '.repeat(prefixVisual.length);
    
    return `位置：第 ${lineNum} 行，第 ${colNum} 個字元 (Index: ${pos})\n` +
           `------------------------------------------------------------\n` +
           `${fullVisualSnippet}\n` +
           `${pointerSpace}^\n` +
           `------------------------------------------------------------\n` +
           `診斷訊息：${message}\n` +
           `提示：若看到 [NBSP] 或 [CTRL]，請嘗試刪除該處多餘空格。`;
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
