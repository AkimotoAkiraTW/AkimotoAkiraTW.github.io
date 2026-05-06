import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { Clipboard } from '@angular/cdk/clipboard';
import { inject } from '@angular/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-number-to-chinese',
  standalone: true,
  imports: [
    FormsModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatButtonModule, 
    MatIconModule, 
    MatCardModule,
    MatSnackBarModule
  ],
  template: `
    <div class="content-container">
      <header class="page-header">
        <h1>數字轉中文大寫</h1>
        <p>報帳與出差費用的好幫手，將阿拉伯數字轉換為國字大寫金額。</p>
      </header>

      <div class="tool-card-container">
        <mat-card class="converter-card">
          <mat-card-content>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>輸入阿拉伯數字</mat-label>
              <input matInput type="text" 
                     inputmode="decimal"
                     placeholder="例如: 12345" 
                     [value]="inputNumber()" 
                     (input)="handleInput($any($event.target).value)"
                     maxlength="18">
              <button mat-icon-button matSuffix (click)="inputNumber.set('')">
                <mat-icon>close</mat-icon>
              </button>
              <mat-hint>上限 15 位整數與 2 位小數</mat-hint>
            </mat-form-field>

            <div class="result-area">
              <div class="result-label">轉換結果 (國字大寫)</div>
              <div class="result-display" [class.has-value]="chineseResult()">
                {{ chineseResult() || '等待輸入...' }}
              </div>
              <div class="action-buttons">
                <button mat-flat-button color="primary" 
                        [disabled]="!chineseResult()"
                        (click)="copyResult()">
                  <mat-icon>content_copy</mat-icon> 複製結果
                </button>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <section class="reference-section">
          <h3>對照表</h3>
          <div class="reference-grid">
            <div class="ref-item"><span>0</span> 零</div>
            <div class="ref-item"><span>1</span> 壹</div>
            <div class="ref-item"><span>2</span> 貳</div>
            <div class="ref-item"><span>3</span> 參</div>
            <div class="ref-item"><span>4</span> 肆</div>
            <div class="ref-item"><span>5</span> 伍</div>
            <div class="ref-item"><span>6</span> 陸</div>
            <div class="ref-item"><span>7</span> 柒</div>
            <div class="ref-item"><span>8</span> 捌</div>
            <div class="ref-item"><span>9</span> 玖</div>
            <div class="ref-item"><span>10</span> 拾</div>
            <div class="ref-item"><span>百</span> 佰</div>
            <div class="ref-item"><span>千</span> 仟</div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .tool-card-container {
      max-width: 600px;
      margin: 0 auto;
    }
    .converter-card {
      padding: 24px;
      margin-bottom: 32px;
      border-radius: 16px;
      background: color-mix(in srgb, currentColor 2%, transparent);
      border: 1px solid color-mix(in srgb, currentColor 8%, transparent);
    }
    .full-width {
      width: 100%;
    }
    .result-area {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px dashed color-mix(in srgb, currentColor 20%, transparent);
    }
    .result-label {
      font-size: 0.85rem;
      opacity: 0.6;
      margin-bottom: 12px;
    }
    .result-display {
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--mat-sys-primary);
      min-height: 2.5rem;
      word-break: break-all;
      margin-bottom: 24px;
      opacity: 0.3;
      transition: all 300ms ease;
    }
    .result-display.has-value {
      opacity: 1;
    }
    .action-buttons {
      display: flex;
      justify-content: flex-end;
    }

    .reference-section {
      margin-top: 48px;
      padding: 24px;
      background: color-mix(in srgb, currentColor 3%, transparent);
      border-radius: 12px;
    }
    .reference-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .ref-item {
      font-size: 0.9rem;
      opacity: 0.8;
    }
    .ref-item span {
      font-family: 'Fira Code', monospace;
      font-weight: 700;
      color: var(--mat-sys-primary);
      margin-right: 4px;
    }
  `]
})
export class NumberToChineseComponent {
  inputNumber = signal<string>('');
  
  /** 自動計算中文結果 */
  chineseResult = computed(() => {
    const val = this.inputNumber();
    if (!val) return '';
    return this.convertToChinese(val);
  });
  
  private clipboard = inject(Clipboard);
  private snackBar = inject(MatSnackBar);

  /** 處理輸入攔截與限制 */
  handleInput(value: string) {
    // 只允許數字與一個小數點
    let clean = value.replace(/[^0-9.]/g, '');
    
    // 確保只有一個小數點
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = parts[0] + '.' + parts.slice(1).join('');
    }

    // 限制整數部分 15 位
    if (parts[0].length > 15) {
      parts[0] = parts[0].slice(0, 15);
      clean = parts[1] !== undefined ? parts[0] + '.' + parts[1] : parts[0];
    }

    // 限制小數部分 2 位
    if (parts[1] && parts[1].length > 2) {
      clean = parts[0] + '.' + parts[1].slice(0, 2);
    }

    this.inputNumber.set(clean);
  }

  copyResult() {
    const result = this.chineseResult();
    if (result) {
      this.clipboard.copy(result);
      this.snackBar.open('已複製到剪貼簿', '確定', { duration: 2000 });
    }
  }

  private convertToChinese(numStr: string): string {
    if (!numStr || isNaN(Number(numStr))) return '';

    // 分離整數與小數部分
    const parts = numStr.split('.');
    let integerStr = parts[0].replace(/^-/, ''); // 移除負號
    const decimalStr = parts[1] || '';

    const digits = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
    const units = ['', '拾', '佰', '仟'];
    const bigUnits = ['', '萬', '億', '兆', '京'];

    let result = '';

    // 處理整數部分 (由後往前處理)
    if (integerStr === '0' || integerStr === '') {
      result = '零元';
    } else {
      let segmentResult = '';
      let zeroCount = 0;
      
      // 每 4 位數為一組進行處理 (萬、億、兆...)
      for (let i = 0; i < integerStr.length; i++) {
        const p = integerStr.length - 1 - i;
        const d = parseInt(integerStr[i]);
        const unitIdx = p % 4;
        const bigUnitIdx = Math.floor(p / 4);

        if (d === 0) {
          zeroCount++;
        } else {
          if (zeroCount > 0) {
            segmentResult += '零';
          }
          zeroCount = 0;
          segmentResult += digits[d] + units[unitIdx];
        }

        if (unitIdx === 0 && bigUnitIdx >= 0) {
          if (segmentResult !== '' || bigUnitIdx === 0) {
            // 處理萬、億等大單位
            const currentBigUnit = bigUnits[bigUnitIdx];
            // 避免出現 "億萬" 這種重複清空
            if (!segmentResult.endsWith('零')) {
               result += segmentResult + currentBigUnit;
            } else {
               result += segmentResult.slice(0, -1) + currentBigUnit;
            }
            segmentResult = '';
            zeroCount = 0;
          }
        }
      }
      result += '元';
    }

    // 處理小數部分 (角、分)
    let decimalResult = '';
    const fractionUnits = ['角', '分'];
    for (let i = 0; i < 2; i++) {
      const d = parseInt(decimalStr[i]);
      if (d > 0) {
        decimalResult += digits[d] + fractionUnits[i];
      }
    }

    if (decimalResult === '') {
      result += '整';
    } else {
      result += decimalResult;
    }

    // 最後的清理
    return result
      .replace(/^零元/, '零元')
      .replace(/零+元/, '元')
      .replace(/零+萬/, '萬')
      .replace(/零+億/, '億')
      .replace(/億萬/, '億')
      .replace(/零+/g, '零')
      .replace(/零元/, '元')
      .replace(/元$/, '元整');
  }
}
