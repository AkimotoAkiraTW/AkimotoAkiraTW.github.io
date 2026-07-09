import { Component, signal, computed, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Clipboard } from '@angular/cdk/clipboard';
import { UiTextFieldComponent } from '../../../shared/components/form-primitives';
import { ToolLayoutComponent } from '../tool-layout.component';
import {
  SYSTEM_LIMITS,
  validateParams,
  generateSelections,
  generateCombinations
} from './combination-calculator.logic';
import {
  ShareState,
  parseShareFromUrl,
  buildShareUrl
} from './combination-calculator.share';

@Component({
  selector: 'app-combination-calculator',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSnackBarModule,
    MatTooltipModule,
    UiTextFieldComponent,
    ToolLayoutComponent
  ],
  template: `
    <app-tool-layout
      title="排列組合計算器"
      description="設定號碼區間與 N 取 K 參數，以 DFS 回溯演算法生成所有組合，內建 OOM 防護與 URL 壓縮分享機制。"
    >
      <div class="tool-card-container">
        <!-- 分享列 -->
        <div class="share-toolbar">
          <button mat-stroked-button color="primary" (click)="shareConfig()">
            <mat-icon>share</mat-icon> 分享當前設定
          </button>
        </div>

        @if (shareUrl()) {
          <mat-card class="share-card">
            <mat-card-content>
              <div class="share-url-box">
                <input type="text" readonly [value]="shareUrl()" (click)="copyShareUrl()" />
                <button mat-icon-button color="primary" (click)="copyShareUrl()" matTooltip="複製連結">
                  <mat-icon>content_copy</mat-icon>
                </button>
                <button mat-icon-button (click)="closeShare()" matTooltip="關閉">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </mat-card-content>
          </mat-card>
        }

        <mat-card class="converter-card">
          <mat-card-content class="tool-form-shell">
            <h2>架構與母體參數設定</h2>
            
            <div class="form-grid">
              <ui-text-field
                label="母體數值區間（最小）"
                type="number"
                [ngModel]="minNum()"
                (ngModelChange)="onMinChange($event)"
              />
              <ui-text-field
                label="母體數值區間（最大）"
                type="number"
                [ngModel]="maxNum()"
                (ngModelChange)="onMaxChange($event)"
              />
              <ui-text-field
                label="第一階段：抽取總碼數 (N)"
                type="number"
                hint="預設為 8"
                [ngModel]="nVal()"
                (ngModelChange)="nVal.set($event || 0)"
              />
              <ui-text-field
                label="第二階段：組合長度 (K)"
                type="number"
                hint="預設為 6"
                [ngModel]="kVal()"
                (ngModelChange)="kVal.set($event || 0)"
              />
            </div>

            <div class="field full mt-4">
              <div class="field-label-group">
                <label>視覺化號碼池條件設定</label>
                <span class="hint">左鍵單擊切換狀態：預設(灰色) ➔ 必含(綠色) ➔ 排除(紅色) ➔ 預設</span>
              </div>
              <div class="interactive-pool-wrapper">
                <div class="interactive-pool">
                  @for (num of poolNumbers(); track num) {
                    <div
                      class="pool-item"
                      [class.state-desired]="getState(num) === 1"
                      [class.state-excluded]="getState(num) === 2"
                      (click)="toggleState(num)"
                    >
                      {{ padZero(num) }}
                    </div>
                  }
                </div>
              </div>
            </div>

            <div class="form-grid mt-4">
              <ui-text-field
                label="期望出現的數字（必含）"
                [ngModel]="desiredString()"
                [disabled]="true"
                placeholder="請透過上方號碼池點擊選擇"
              />
              <ui-text-field
                label="不期望出現的數字（排除）"
                [ngModel]="excludedString()"
                [disabled]="true"
                placeholder="請透過上方號碼池點擊選擇"
              />
            </div>

            <div class="actions">
              <button mat-flat-button color="primary" (click)="generate()">
                <mat-icon>play_arrow</mat-icon> 執行隨機抽取與運算
              </button>
              <button mat-stroked-button (click)="resetForm()">
                <mat-icon>refresh</mat-icon> 重設所有條件
              </button>
            </div>
          </mat-card-content>
        </mat-card>

        @if (combinations().length > 0) {
          <mat-card class="result-card">
            <mat-card-content>
              <h2>第一階段：決策抽樣結果 (共 {{ extractedNumbers().length }} 碼)</h2>
              <div class="numbers-display">
                @for (num of extractedNumbers(); track num) {
                  <div class="number-ball" [class.desired]="isDesired(num)">
                    {{ padZero(num) }}
                  </div>
                }
              </div>
              
              <div class="result-header mt-4">
                <h2>第二階段：衍生組合清單 C({{ nVal() }}, {{ kVal() }})</h2>
                <button mat-stroked-button color="primary" (click)="copyCombinations()">
                  <mat-icon>content_copy</mat-icon> 複製全部組合
                </button>
              </div>
              
              <div class="stats">
                <span>衍生組合總數：<strong>{{ combinations().length | number }}</strong> 組</span>
                <span>運算公式：<strong>C({{ nVal() }}, {{ kVal() }}) = {{ combinations().length | number }}</strong></span>
              </div>
              
              <div class="combinations-grid">
                @for (combo of displayedCombinations(); track $index) {
                  <div class="combo-item">
                    <span class="combo-index">{{ $index + 1 }}.</span>
                    [{{ combo.map(padZero).join(', ') }}]
                  </div>
                }
                
                @if (isLimitedDisplay()) {
                  <div class="combo-item limited-msg">
                    ...為維持介面流暢，後續 {{ (combinations().length - renderLimit) | number }} 組已隱藏，請點擊「複製全部」取得完整資料。
                  </div>
                }
              </div>
            </mat-card-content>
          </mat-card>
        } @else {
          <mat-card class="empty-card">
            <mat-card-content class="empty-state">
              <mat-icon>calculate</mat-icon>
              <p>設定母體範圍與條件參數後，點擊「執行隨機抽取與運算」開始分析</p>
            </mat-card-content>
          </mat-card>
        }
      </div>
    </app-tool-layout>
  `,
  styles: [`
    .tool-card-container {
      max-width: 900px;
      margin: 0 auto;
    }
    
    .share-toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 16px;
    }
    
    .share-card {
      margin-bottom: 16px;
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--mat-sys-primary) 30%, transparent);
      border-radius: 12px;
    }
    
    .share-url-box {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .share-url-box input {
      flex: 1;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid var(--border-color, #ccc);
      background: var(--surface-color, #fff);
      color: var(--text-primary);
      font-family: monospace;
    }
    
    .converter-card, .result-card, .empty-card {
      margin-bottom: 24px;
      border-radius: 16px;
    }
    
    .converter-card {
      padding: 8px;
    }
    
    h2 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    
    .mt-4 {
      margin-top: 24px;
    }
    
    .field-label-group label {
      display: block;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    
    .hint {
      font-size: 0.8rem;
      color: var(--text-muted);
      display: block;
      margin-bottom: 8px;
    }
    
    .interactive-pool-wrapper {
      background: color-mix(in srgb, currentColor 3%, transparent);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
    }

    .interactive-pool {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
      gap: 6px;
      max-height: 200px;
      overflow-y: auto;
      padding-right: 8px;
    }

    .interactive-pool::-webkit-scrollbar { width: 6px; }
    .interactive-pool::-webkit-scrollbar-track { background: transparent; }
    .interactive-pool::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
    
    .pool-item {
      aspect-ratio: 1 / 1;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-alt);
      border: 1px solid var(--border-color);
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease-in-out;
      font-variant-numeric: tabular-nums;
    }

    .pool-item:hover {
      border-color: var(--text-secondary);
      transform: translateY(-1px);
    }

    .pool-item.state-desired {
      background: var(--state-success, #22c55e);
      color: white;
      border-color: color-mix(in srgb, var(--state-success, #22c55e) 80%, black);
    }

    .pool-item.state-excluded {
      background: var(--state-danger, #ef4444);
      color: white;
      border-color: color-mix(in srgb, var(--state-danger, #ef4444) 80%, black);
      opacity: 0.5;
      text-decoration: line-through;
    }
    
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      flex-wrap: wrap;
    }
    
    .numbers-display {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .number-ball {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1rem;
      background: linear-gradient(145deg, #3b82f6, #1d4ed8);
      color: white;
      box-shadow: 0 4px 8px rgba(59, 130, 246, 0.35);
      font-variant-numeric: tabular-nums;
      animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }

    .number-ball.desired {
      background: linear-gradient(145deg, #22c55e, #15803d);
      box-shadow: 0 4px 8px rgba(34, 197, 94, 0.35);
    }

    @keyframes popIn { 
      from { opacity: 0; transform: scale(0.5); }
      to { opacity: 1; transform: scale(1); } 
    }
    
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .result-header h2 { margin: 0; }
    
    .stats {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      margin-bottom: 16px;
      font-size: 0.9rem;
      color: var(--text-muted);
    }
    .stats strong { color: var(--text-primary); font-variant-numeric: tabular-nums; }
    
    .combinations-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
      max-height: 400px;
      overflow-y: auto;
      padding-right: 8px;
    }
    .combinations-grid::-webkit-scrollbar { width: 6px; }
    .combinations-grid::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }

    .combo-item {
      background: var(--surface-alt);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 12px;
      font-family: 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
      font-size: 0.9rem;
      text-align: center;
      transition: border-color 0.2s;
      font-variant-numeric: tabular-nums;
    }
    .combo-item:hover { border-color: var(--mat-sys-primary); }
    .combo-index { color: var(--text-muted); font-size: 0.75rem; margin-right: 6px; }
    
    .limited-msg {
      grid-column: 1 / -1;
      border-color: var(--state-warning, #f59e0b);
      color: var(--state-warning, #f59e0b);
    }
  `]
})
export class CombinationCalculatorComponent implements OnInit {
  minNum = signal(1);
  maxNum = signal(49);
  nVal = signal(8);
  kVal = signal(6);
  
  // 狀態 map: number -> state (0=default, 1=desired, 2=excluded)
  numberStates = signal<Map<number, number>>(new Map());
  
  shareUrl = signal<string>('');
  
  extractedNumbers = signal<number[]>([]);
  combinations = signal<number[][]>([]);
  
  renderLimit = SYSTEM_LIMITS.MAX_COMBINATIONS_RENDER;
  
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private clipboard = inject(Clipboard);
  private platformId = inject(PLATFORM_ID);
  
  poolNumbers = computed(() => {
    const min = this.minNum();
    const max = this.maxNum();
    const nums: number[] = [];
    if (min <= max) {
      for (let i = min; i <= max; i++) nums.push(i);
    }
    return nums;
  });
  
  desiredNumbers = computed(() => {
    const map = this.numberStates();
    return Array.from(map.entries()).filter(([_, state]) => state === 1).map(([num]) => num);
  });
  
  excludedNumbers = computed(() => {
    const map = this.numberStates();
    return Array.from(map.entries()).filter(([_, state]) => state === 2).map(([num]) => num);
  });
  
  desiredString = computed(() => this.desiredNumbers().join(', '));
  excludedString = computed(() => this.excludedNumbers().join(', '));
  
  displayedCombinations = computed(() => {
    const all = this.combinations();
    return all.length > this.renderLimit ? all.slice(0, this.renderLimit) : all;
  });
  
  isLimitedDisplay = computed(() => this.combinations().length > this.renderLimit);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.route.queryParams.subscribe(params => {
        if (params['s']) {
          const shareState = parseShareFromUrl(`s=${params['s']}`);
          if (shareState) {
            this.minNum.set(shareState.min);
            this.maxNum.set(shareState.max);
            this.nVal.set(shareState.n);
            this.kVal.set(shareState.k);
            
            const newMap = new Map<number, number>();
            shareState.desired.forEach(n => newMap.set(n, 1));
            shareState.excluded.forEach(n => newMap.set(n, 2));
            this.numberStates.set(newMap);
            
            this.snackBar.open('已從分享連結載入設定', '關閉', { duration: 3000 });
            
            // 移除 query param
            this.router.navigate([], { queryParams: { s: null }, queryParamsHandling: 'merge', replaceUrl: true });
          }
        }
      });
    }
  }
  
  onMinChange(val: number) {
    this.minNum.set(val || 1);
    this.cleanStates();
  }
  
  onMaxChange(val: number) {
    this.maxNum.set(val || 1);
    this.cleanStates();
  }
  
  private cleanStates() {
    const min = this.minNum();
    const max = this.maxNum();
    const current = this.numberStates();
    const next = new Map<number, number>();
    current.forEach((state, num) => {
      if (num >= min && num <= max) {
        next.set(num, state);
      }
    });
    this.numberStates.set(next);
  }
  
  getState(num: number): number {
    return this.numberStates().get(num) || 0;
  }
  
  toggleState(num: number) {
    const current = this.numberStates();
    const next = new Map(current);
    const state = next.get(num) || 0;
    next.set(num, (state + 1) % 3);
    this.numberStates.set(next);
  }
  
  resetForm() {
    this.minNum.set(1);
    this.maxNum.set(49);
    this.nVal.set(8);
    this.kVal.set(6);
    this.numberStates.set(new Map());
    this.extractedNumbers.set([]);
    this.combinations.set([]);
    this.shareUrl.set('');
  }
  
  // Needs to be an arrow function so 'this' works correctly when passed to map
  padZero = (num: number): string => {
    return num.toString().padStart(2, '0');
  }
  
  isDesired(num: number): boolean {
    return this.getState(num) === 1;
  }
  
  generate() {
    const min = this.minNum();
    const max = this.maxNum();
    const n = this.nVal();
    const k = this.kVal();
    const desired = this.desiredNumbers();
    const excluded = this.excludedNumbers();
    
    const validResult = validateParams(min, max, n, k, desired, excluded);
    if (!validResult.valid) {
      this.snackBar.open(validResult.error || '參數無效', '關閉', { duration: 5000 });
      return;
    }
    
    try {
      const selections = generateSelections(min, max, n, desired, excluded);
      this.extractedNumbers.set(selections);
      
      const combos = generateCombinations(selections, k);
      this.combinations.set(combos);
      
      let msg = `系統抽樣完成，已成功生成 ${combos.length.toLocaleString()} 組數列。`;
      if (combos.length > this.renderLimit) {
        msg += ' (部分結果已隱藏以確保效能)';
      }
      this.snackBar.open(msg, '關閉', { duration: 4000 });
      
    } catch (e: any) {
      this.snackBar.open(`執行階段發生錯誤：${e.message}`, '關閉', { duration: 5000 });
    }
  }
  
  shareConfig() {
    const state: ShareState = {
      min: this.minNum(),
      max: this.maxNum(),
      n: this.nVal(),
      k: this.kVal(),
      desired: this.desiredNumbers(),
      excluded: this.excludedNumbers()
    };
    const url = buildShareUrl(state, this.router.url.split('?')[0]);
    this.shareUrl.set(url);
  }
  
  copyShareUrl() {
    const url = this.shareUrl();
    if (url) {
      this.clipboard.copy(url);
      this.snackBar.open('已複製分享連結至剪貼簿', '關閉', { duration: 3000 });
    }
  }
  
  closeShare() {
    this.shareUrl.set('');
  }
  
  copyCombinations() {
    const combos = this.combinations();
    if (combos.length === 0) return;
    
    const text = combos.map(combo => `[${combo.map(this.padZero).join(', ')}]`).join('\n');
    this.clipboard.copy(text);
    this.snackBar.open(`已成功複製 ${combos.length.toLocaleString()} 組組合至剪貼簿`, '關閉', { duration: 3000 });
  }
}
