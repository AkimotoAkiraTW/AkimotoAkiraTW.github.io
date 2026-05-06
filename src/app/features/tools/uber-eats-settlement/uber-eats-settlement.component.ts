import {
  Component,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

// ─── 資料模型 ───────────────────────────────────────────────────────────────

interface OrderItem {
  buyer: string;
  itemName: string;
  quantity: number;
  price: number;
  /** 從 subtitle 解析出的加料/加大總費用 */
  customizationPrice: number;
  /** API 已計算的折扣（如買一送一的顯式折扣） */
  explicitDiscount: number;
  /** 使用者手動標記的 BOGO（買一送一，底價歸零，僅收加料費）*/
  manualBogo: boolean;
  /** 計算後的應付金額 */
  finalPayable: number;
}

type SplitMethod = 'proportional' | 'flat';

// ─── Component ──────────────────────────────────────────────────────────────

@Component({
  selector: 'app-uber-eats-settlement',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatChipsModule,
    MatDividerModule,
  ],
  template: `
    <div class="content-container tool-page">

      <!-- 返回 -->
      <a mat-button routerLink="/tools" class="back-link">
        <mat-icon>arrow_back</mat-icon> 回工具箱
      </a>

      <header class="tool-header">
        <h1>Uber Eats 團購對帳工具</h1>
        <p class="subtitle">貼入訂單 JSON，自動計算各成員應付金額，支援 BOGO 與費用分攤。</p>
      </header>

      <!-- JSON 輸入面板 -->
      <mat-card appearance="outlined" class="input-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>upload_file</mat-icon>
          <mat-card-title>貼入訂單 JSON</mat-card-title>
          <mat-card-subtitle>
            從瀏覽器開發者工具 Network 頁籤找到 <code>getActiveOrdersV1</code> 請求，複製 Response 內容貼入。
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <mat-form-field appearance="outline" class="full-width json-field">
            <mat-label>getActiveOrdersV1 Response JSON</mat-label>
            <textarea
              matInput
              [(ngModel)]="rawJson"
              rows="7"
              placeholder='{ "data": { "orders": [...] } }'
              spellcheck="false"
            ></textarea>
          </mat-form-field>

          @if (parseError()) {
            <p class="error-hint">
              <mat-icon inline>error_outline</mat-icon>
              {{ parseError() }}
            </p>
          }
        </mat-card-content>
        <mat-card-actions align="end">
          <button mat-button (click)="clearAll()">
            <mat-icon>clear</mat-icon> 清除
          </button>
          <button mat-raised-button color="primary" (click)="parseJson()">
            <mat-icon>auto_fix_high</mat-icon> 解析
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- 結果區塊 -->
      @if (orderItems().length > 0) {
        <!-- 店家資訊 & 狀態 -->
        <div class="store-header">
          <span class="store-name">{{ storeName() }}</span>
          @if (orderStatus()) {
            <mat-chip [disableRipple]="true">{{ orderStatus() }}</mat-chip>
          }
        </div>

        <!-- 分攤設定 -->
        <mat-card appearance="outlined" class="config-card">
          <mat-card-content>
            <div class="config-row">
              <mat-form-field appearance="outline" class="config-field">
                <mat-label>全單折扣 ($)</mat-label>
                <input matInput type="number" [(ngModel)]="globalDiscount" (ngModelChange)="recalculate()" min="0">
                <mat-icon matPrefix>local_offer</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" class="config-field">
                <mat-label>運費 / 雜費 ($)</mat-label>
                <input matInput type="number" [(ngModel)]="deliveryFee" (ngModelChange)="recalculate()" min="0">
                <mat-icon matPrefix>delivery_dining</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" class="config-field">
                <mat-label>分攤方式</mat-label>
                <mat-select [(ngModel)]="splitMethod" (ngModelChange)="recalculate()">
                  <mat-option value="proportional">按金額比例</mat-option>
                  <mat-option value="flat">按人頭平攤</mat-option>
                </mat-select>
                <mat-icon matPrefix>calculate</mat-icon>
              </mat-form-field>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- 統計卡片 -->
        <div class="stats-row">
          <div class="stat-card">
            <span class="stat-label">品項原價加總</span>
            <span class="stat-value">{{ fmt(stats().itemSum) }}</span>
          </div>
          <div class="stat-card accent">
            <span class="stat-label">JSON 實付總額</span>
            <span class="stat-value positive">{{ fmt(stats().jsonTotal) }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">差距（待分配）</span>
            <span class="stat-value" [class.negative]="stats().discrepancy !== 0">
              {{ fmt(stats().discrepancy) }}
            </span>
          </div>
          <div class="stat-card highlight">
            <span class="stat-label">當前對帳總和</span>
            <span class="stat-value primary">{{ fmt(stats().checkSum) }}</span>
          </div>
        </div>

        <!-- 餘額警告 -->
        @if (showBalanceWarning()) {
          <div class="balance-warning">
            <mat-icon>warning_amber</mat-icon>
            計算總和 ({{ fmt(stats().checkSum) }}) 與實付 ({{ fmt(stats().jsonTotal) }}) 尚有差距，請調整折扣或運費。
          </div>
        }

        <!-- 訂單明細表 -->
        <mat-card appearance="outlined" class="table-card">
          <mat-card-content>
            <div class="table-wrapper">
              <table class="order-table">
                <thead>
                  <tr>
                    <th>訂購人</th>
                    <th>品項</th>
                    <th class="center">數量</th>
                    <th class="right">原價</th>
                    <th class="right">加項</th>
                    <th class="center" matTooltip="手動標記 BOGO（買一送一），系統將免除底價，僅保留加項費用">
                      BOGO <mat-icon inline class="help-icon">help_outline</mat-icon>
                    </th>
                    <th class="right">應付金額</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of orderItems(); track $index) {
                    <tr>
                      <td class="buyer-cell">{{ item.buyer }}</td>
                      <td>
                        {{ item.itemName }}
                        @if (item.explicitDiscount > 0) {
                          <span class="discount-chip">已扣 {{ fmt(item.explicitDiscount) }}</span>
                        }
                      </td>
                      <td class="center">{{ item.quantity }}</td>
                      <td class="right">{{ fmt(item.price) }}</td>
                      <td class="right customization-cell">
                        <input
                          type="number"
                          class="inline-input"
                          [(ngModel)]="item.customizationPrice"
                          (ngModelChange)="recalculate()"
                          min="0"
                        />
                      </td>
                      <td class="center">
                        <mat-checkbox
                          [checked]="item.manualBogo"
                          (change)="toggleBogo($index, $event.checked)"
                        ></mat-checkbox>
                      </td>
                      <td class="right payable">
                        {{ fmt(item.finalPayable) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </mat-card-content>
          <mat-divider></mat-divider>
          <mat-card-actions align="end">
            <button mat-stroked-button (click)="exportCsv()">
              <mat-icon>download</mat-icon> 匯出 CSV
            </button>
          </mat-card-actions>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .tool-page {
      padding-top: 24px;
      padding-bottom: 60px;
    }

    .back-link {
      display: inline-flex;
      margin-bottom: 16px;
    }

    .tool-header {
      margin-bottom: 24px;
    }

    .tool-header h1 {
      font-size: clamp(1.6rem, 3vw, 2.2rem);
      font-weight: 600;
      letter-spacing: -0.03em;
      margin-bottom: 6px;
    }

    .subtitle {
      opacity: 0.6;
      font-size: 0.95rem;
    }

    code {
      font-family: 'Roboto Mono', monospace;
      background: color-mix(in srgb, currentColor 8%, transparent);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.85em;
    }

    .input-card { margin-bottom: 24px; }

    .full-width { width: 100%; }
    .json-field { margin-top: 16px; }

    .error-hint {
      color: var(--mat-sys-error, #d32f2f);
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: -8px;
      margin-bottom: 8px;
    }

    /* 店家資訊列 */
    .store-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    .store-name {
      font-size: 1.2rem;
      font-weight: 600;
    }

    /* 設定列 */
    .config-card { margin-bottom: 20px; }
    .config-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      padding-top: 8px;
    }
    .config-field { flex: 1; min-width: 160px; }

    /* 統計卡片 */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .stat-card {
      background: color-mix(in srgb, currentColor 4%, transparent);
      border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    .stat-card.accent { background: color-mix(in srgb, var(--mat-sys-primary, #1976d2) 5%, transparent); }
    .stat-card.highlight {
      background: color-mix(in srgb, var(--mat-sys-tertiary, #6750a4) 6%, transparent);
      border-color: color-mix(in srgb, var(--mat-sys-tertiary, #6750a4) 20%, transparent);
    }

    .stat-label {
      display: block;
      font-size: 0.75rem;
      opacity: 0.6;
      margin-bottom: 6px;
      letter-spacing: 0.02em;
    }

    .stat-value {
      font-size: 1.4rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .stat-value.positive { color: #16a34a; }
    .stat-value.negative { color: var(--mat-sys-error, #d32f2f); }
    .stat-value.primary { color: var(--mat-sys-primary, #1976d2); }

    /* 警告列 */
    .balance-warning {
      display: flex;
      align-items: center;
      gap: 8px;
      background: color-mix(in srgb, #f59e0b 10%, transparent);
      border: 1px solid color-mix(in srgb, #f59e0b 30%, transparent);
      color: #b45309;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 0.875rem;
      margin-bottom: 16px;
    }

    /* 明細表 */
    .table-card { margin-bottom: 24px; }

    .table-wrapper {
      overflow-x: auto;
      margin: 0 -16px;
      padding: 0 16px;
    }

    .order-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
      min-width: 600px;
    }

    .order-table th,
    .order-table td {
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid color-mix(in srgb, currentColor 8%, transparent);
    }

    .order-table th {
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      opacity: 0.6;
    }

    .order-table tr:last-child td { border-bottom: none; }
    .order-table tr:hover td {
      background: color-mix(in srgb, currentColor 3%, transparent);
    }

    .center { text-align: center; }
    .right { text-align: right; font-variant-numeric: tabular-nums; }

    .buyer-cell { font-weight: 500; }

    .payable {
      font-weight: 700;
      color: var(--mat-sys-primary, #1976d2);
      font-variant-numeric: tabular-nums;
    }

    .customization-cell {
      opacity: 0.8;
      font-size: 0.85em;
    }

    .inline-input {
      width: 60px;
      background: color-mix(in srgb, currentColor 5%, transparent);
      border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      color: inherit;
      border-radius: 4px;
      padding: 2px 4px;
      text-align: right;
      font-family: inherit;
      outline: none;
    }
    .inline-input:focus {
      border-color: var(--mat-sys-primary, #1976d2);
      background: color-mix(in srgb, var(--mat-sys-primary, #1976d2) 5%, transparent);
    }

    .discount-chip {
      display: inline-block;
      background: #fbbf24;
      color: #78350f;
      font-size: 0.72rem;
      padding: 1px 7px;
      border-radius: 999px;
      margin-left: 6px;
      font-weight: 600;
      vertical-align: middle;
    }

    .help-icon {
      font-size: 0.85em;
      opacity: 0.5;
      vertical-align: middle;
    }
  `],
})
export class UberEatsSettlementComponent {
  private snackBar = inject(MatSnackBar);

  // ─── 輸入狀態 ──────────────────────────────────────────────────────────────
  rawJson = '';
  parseError = signal('');

  // ─── 解析結果 ──────────────────────────────────────────────────────────────
  storeName = signal('');
  orderStatus = signal('');
  private _jsonTotal = signal(0);
  orderItems = signal<OrderItem[]>([]);

  // ─── 設定 ──────────────────────────────────────────────────────────────────
  globalDiscount = 0;
  deliveryFee = 0;
  splitMethod: SplitMethod = 'proportional';

  // ─── Computed 統計 ─────────────────────────────────────────────────────────
  readonly stats = computed(() => {
    const items = this.orderItems();
    const jsonTotal = this._jsonTotal();

    let itemSum = 0;
    let checkSum = 0;
    items.forEach(i => {
      itemSum += i.price - i.explicitDiscount;
      checkSum += i.finalPayable;
    });
    return {
      itemSum,
      jsonTotal,
      discrepancy: itemSum - jsonTotal,
      checkSum,
    };
  });

  readonly showBalanceWarning = computed(
    () => Math.abs(this.stats().checkSum - this.stats().jsonTotal) > 0.1 && this.orderItems().length > 0
  );

  // ─── 動作 ──────────────────────────────────────────────────────────────────

  parseJson(): void {
    this.parseError.set('');
    try {
      const data = JSON.parse(this.rawJson);
      this.processData(data);
    } catch {
      this.parseError.set('JSON 格式錯誤，請確認貼上的內容正確無誤。');
    }
  }

  private processData(jsonData: unknown): void {
    try {
      const data = jsonData as Record<string, unknown>;
      const orders = (data['data'] as Record<string, unknown>)['orders'] as unknown[];
      const order = orders[0] as Record<string, unknown>;
      const feedCards = order['feedCards'] as Array<Record<string, unknown>>;
      const summaryCard = feedCards.find(c => c['orderSummary']) as Record<string, unknown> | undefined;
      if (!summaryCard) throw new Error('找不到 orderSummary 資料');

      const analytics = order['analytics'] as Record<string, unknown>;
      const analyticsData = analytics['data'] as Record<string, unknown>;
      this._jsonTotal.set(parseFloat(analyticsData['order_total'] as string) || 0);

      const orderInfo = order['orderInfo'] as Record<string, unknown>;
      const storeInfo = orderInfo['storeInfo'] as Record<string, unknown>;
      this.storeName.set(storeInfo['name'] as string || '');

      const activeStatus = order['activeOrderStatus'] as Record<string, unknown> | undefined;
      this.orderStatus.set(
        (activeStatus?.['subtitleSummary'] as Record<string, unknown>)?.['summary'] as string || ''
      );

      const orderSummary = summaryCard['orderSummary'] as Record<string, unknown>;
      const parsed = this.parseSections(orderSummary['sections'] as Array<Record<string, unknown>>);
      this.orderItems.set(parsed);
      this.recalculate();
    } catch (err) {
      this.parseError.set(`解析失敗：${(err as Error).message}`);
    }
  }

  private parseSections(sections: Array<Record<string, unknown>>): OrderItem[] {
    const results: OrderItem[] = [];
    sections.forEach(section => {
      const header = section['header'] as Record<string, unknown>;
      const buyer = header['title'] as string;
      const items = section['items'] as Array<Record<string, unknown>>;
      items.forEach(item => {
        const price = parseFloat(((item['price'] as string) || '$0').replace(/[^\d.]/g, '')) || 0;
        const subtitle = (item['subtitle'] as string) || '';

        // 解析加料/加大費用 (尋找 ($10.00) 格式的字串，容許空格)
        let customizationPrice = 0;
        const priceMatches = subtitle.matchAll(/\(\$\s*(\d+\.?\d*)\s*\)/g);
        for (const match of priceMatches) {
          customizationPrice += parseFloat(match[1]);
        }

        const discountObj = item['itemDiscount'] as Record<string, unknown> | undefined;
        const explicitDiscount = discountObj
          ? parseFloat(((discountObj['formattedAmount'] as string) || '0').replace(/[^\d.]/g, '')) || 0
          : 0;
        results.push({
          buyer,
          itemName: item['title'] as string,
          quantity: (item['quantity'] as number) || 1,
          price,
          customizationPrice,
          explicitDiscount,
          manualBogo: false,
          finalPayable: 0,
        });
      });
    });
    return results;
  }

  toggleBogo(index: number, checked: boolean): void {
    const items = [...this.orderItems()];
    items[index] = { ...items[index], manualBogo: checked };
    this.orderItems.set(items);
    this.recalculate();
  }

  recalculate(): void {
    const items = this.orderItems();
    if (items.length === 0) return;

    const netAdjustment = this.deliveryFee - this.globalDiscount;

    let basePoolTotal = 0;
    items.forEach(item => {
      let base = item.price - item.explicitDiscount;
      if (item.manualBogo) {
        // BOGO 時，底價歸零，只計入加料費作為基數
        base = item.customizationPrice;
      }
      basePoolTotal += base;
    });

    const updated = items.map(item => {
      let itemBase = item.price - item.explicitDiscount;
      if (item.manualBogo) {
        itemBase = item.customizationPrice;
      }

      let share = 0;
      if (this.splitMethod === 'proportional' && basePoolTotal > 0) {
        share = (itemBase / basePoolTotal) * netAdjustment;
      } else if (this.splitMethod === 'flat') {
        share = netAdjustment / items.length;
      }

      return { ...item, finalPayable: itemBase + share };
    });

    this.orderItems.set(updated);
  }

  exportCsv(): void {
    const items = this.orderItems();
    const stats = this.stats();
    let csv = '\uFEFF訂購人,品項,數量,原價,加項,BOGO,應付金額\n';
    items.forEach(item => {
      csv += `${item.buyer},"${item.itemName}",${item.quantity},${item.price.toFixed(2)},${item.customizationPrice.toFixed(2)},${item.manualBogo ? 'V' : ''},${item.finalPayable.toFixed(2)}\n`;
    });
    csv += `\n總計,,,${stats.itemSum.toFixed(2)},,,${stats.checkSum.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'UberEats_Settlement.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.snackBar.open('CSV 已下載', '', { duration: 2000 });
  }

  clearAll(): void {
    this.rawJson = '';
    this.parseError.set('');
    this.storeName.set('');
    this.orderStatus.set('');
    this._jsonTotal.set(0);
    this.orderItems.set([]);
    this.globalDiscount = 0;
    this.deliveryFee = 0;
    this.splitMethod = 'proportional';
  }

  /** 格式化金額為 $X.XX 字串（避免 tsc 無法解析 Angular pipe 語法）*/
  fmt(value: number): string {
    return '$' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}
