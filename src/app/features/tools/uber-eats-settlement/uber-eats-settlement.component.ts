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
import { ToolLayoutComponent } from '../tool-layout.component';

// ─── 資料模型 ───────────────────────────────────────────────────────────────

interface OrderItem {
  storeName: string;
  buyer: string;
  itemName: string;
  quantity: number;
  price: number;
  /** 從 subtitle 解析出的加料/加大總費用 */
  customizationPrice: number;
  /** API 已計算的折扣（如買一送一的顯式折扣） */
  explicitDiscount: number;
  /** 分組折抵用的群組標籤 (例如 'A', 'B') */
  discountGroup: string | null;
  /** 計算後的應付金額 */
  finalPayable: number;
}

interface DiscountGroupConfig {
  groupId: string;
  /** 手動追加的總折扣金額 (例如 240) */
  manualDiscount: number;
  /** 免除的底價份數 (例如買一送一時，輸入送的杯數) */
  waivedCups: number;
}

interface ParsedOrderSummary {
  uuid: string;
  storeName: string;
  status: string;
  jsonTotal: number;
}

type SplitMethod = 'proportional' | 'flat';

// ─── Component ──────────────────────────────────────────────────────────────

@Component({
  selector: 'app-uber-eats-settlement',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatChipsModule,
    MatDividerModule,
    ToolLayoutComponent,
  ],
  template: `
    <app-tool-layout 
      title="Uber Eats 團購對帳工具" 
      description="貼入訂單 JSON，自動計算各成員應付金額，支援公平折扣平攤與差價隔離。">
      
      <div class="tool-page-content">
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
              <mat-icon>clear</mat-icon> 清除全部
            </button>
            <button mat-stroked-button (click)="parseJson(true)" [disabled]="!rawJson">
              <mat-icon>add</mat-icon> 累積解析
            </button>
            <button mat-raised-button color="primary" (click)="parseJson(false)" [disabled]="!rawJson">
              <mat-icon>auto_fix_high</mat-icon> 全新解析
            </button>
          </mat-card-actions>
        </mat-card>

        <!-- 結果區塊 -->
        @if (orderItems().length > 0) {
          <!-- 店家資訊 & 狀態 -->
          <div class="store-header">
            <div class="header-actions">
              <div class="store-items">
                @for (order of parsedOrders(); track order.uuid) {
                  <div class="store-item">
                    <span class="store-name">{{ order.storeName }}</span>
                    @if (order.status) {
                      <mat-chip [disableRipple]="true">{{ order.status }}</mat-chip>
                    }
                  </div>
                }
              </div>
              
              <div class="view-toggle">
                <button mat-icon-button [color]="viewMode() === 'table' ? 'primary' : ''" (click)="viewMode.set('table')" matTooltip="表格模式">
                  <mat-icon>table_rows</mat-icon>
                </button>
                <button mat-icon-button [color]="viewMode() === 'card' ? 'primary' : ''" (click)="viewMode.set('card')" matTooltip="卡片模式">
                  <mat-icon>grid_view</mat-icon>
                </button>
              </div>
            </div>
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

          <!-- 群組折扣設定 (僅在有群組被選用時顯示) -->
          @if (activeGroups().length > 0) {
            <mat-card appearance="outlined" class="group-card">
              <mat-card-header>
                <mat-icon mat-card-avatar>group_work</mat-icon>
                <mat-card-title>進階群組折扣 (均分模式)</mat-card-title>
                <mat-card-subtitle>
                  適用於「買一送一」、「滿千折百」等複雜折扣。群組總折扣將依底價比例均攤給群組成員。
                </mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="group-configs">
                  @for (groupId of activeGroups(); track groupId) {
                    <div class="group-row">
                      <div class="group-info">
                        <span class="group-badge">{{ groupId }}</span>
                        <span class="group-stats">
                          (共 {{ getGroupItemCount(groupId) }} 份, 
                          總底價: {{ fmt(getGroupBasePriceTotal(groupId)) }}, 
                          已知折扣: {{ fmt(getGroupExplicitDiscount(groupId)) }})
                        </span>
                      </div>
                      <div class="group-action">
                        <mat-form-field appearance="outline" class="group-discount-field">
                          <mat-label>免除杯數 (BOGO)</mat-label>
                          <input matInput type="number" 
                                 [ngModel]="getGroupWaivedCups(groupId)" 
                                 (ngModelChange)="updateGroupWaivedCups(groupId, $event)" 
                                 min="0" step="1">
                          <mat-icon matPrefix>local_cafe</mat-icon>
                        </mat-form-field>
                        <mat-form-field appearance="outline" class="group-discount-field">
                          <mat-label>額外滿減折扣 ($)</mat-label>
                          <input matInput type="number" 
                                 [ngModel]="getGroupManualDiscount(groupId)" 
                                 (ngModelChange)="updateGroupDiscount(groupId, $event)" 
                                 min="0">
                          <mat-icon matPrefix>money_off</mat-icon>
                        </mat-form-field>
                      </div>
                    </div>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          }

          <!-- 數據統計 -->
          <div class="stats-row">
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
          @if (viewMode() === 'table') {
            <mat-card appearance="outlined" class="table-card">
              <mat-card-content>
                <div class="table-wrapper">
                  <table class="order-table">
                    <thead>
                      <tr>
                        <th>店家/訂購人</th>
                        <th>品項</th>
                        <th class="center">數量</th>
                        <th class="right">原價</th>
                        <th class="right">加項費</th>
                        <th class="center" matTooltip="將多個品項設定為同群組，即可共享該群組的總折扣">
                          折扣群組 <mat-icon inline class="help-icon">help_outline</mat-icon>
                        </th>
                        <th class="right">應付金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of orderItems(); track $index) {
                        <tr>
                          <td class="buyer-cell">
                            <div class="store-tag">{{ item.storeName }}</div>
                            {{ item.buyer }}
                          </td>
                          <td>
                            <div class="item-name-group">
                              <span class="item-title">{{ item.itemName }}</span>
                            </div>
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
                            <select class="group-select" 
                                    [ngModel]="item.discountGroup" 
                                    (ngModelChange)="updateItemOption($index, 'discountGroup', $event)">
                              <option [ngValue]="null">無</option>
                              @for (g of availableGroups; track g) {
                                <option [ngValue]="g">{{ g }}</option>
                              }
                            </select>
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
          } @else {
            <!-- 卡片模式 -->
            <div class="card-grid">
              @for (item of orderItems(); track $index) {
                <mat-card appearance="outlined" class="item-card">
                  <div class="item-card-header">
                    <div class="item-card-buyer">
                      <span class="store-tag">{{ item.storeName }}</span>
                      {{ item.buyer }}
                    </div>
                    <div class="item-card-payable">{{ fmt(item.finalPayable) }}</div>
                  </div>
                  <div class="item-card-content">
                    <div class="item-card-title">
                      {{ item.itemName }}
                      @if (item.explicitDiscount > 0) {
                        <span class="discount-chip">已扣 {{ fmt(item.explicitDiscount) }}</span>
                      }
                    </div>
                    <div class="item-card-details">
                      <span>數量: {{ item.quantity }}</span>
                      <span>原價: {{ fmt(item.price) }}</span>
                    </div>
                    <div class="item-card-actions">
                      <div>
                        <span class="card-input-label">加項費 ($)</span>
                        <input
                          type="number"
                          class="inline-input"
                          style="width: 80px;"
                          [(ngModel)]="item.customizationPrice"
                          (ngModelChange)="recalculate()"
                          min="0"
                        />
                      </div>
                      <div>
                        <span class="card-input-label">折扣群組</span>
                        <select class="group-select" 
                                [ngModel]="item.discountGroup" 
                                (ngModelChange)="updateItemOption($index, 'discountGroup', $event)">
                          <option [ngValue]="null">無</option>
                          @for (g of availableGroups; track g) {
                            <option [ngValue]="g">{{ g }}</option>
                          }
                        </select>
                      </div>
                    </div>
                  </div>
                </mat-card>
              }
            </div>
            <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
              <button mat-raised-button color="primary" (click)="exportCsv()">
                <mat-icon>download</mat-icon> 匯出 CSV
              </button>
            </div>
          }
        }
      </div>
    </app-tool-layout>
  `,
  styles: [`
    .tool-page-content { padding-bottom: 60px; }
    code { font-family: 'Roboto Mono', monospace; background: color-mix(in srgb, currentColor 8%, transparent); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; }
    .input-card { margin-bottom: 24px; border-color: color-mix(in srgb, var(--mat-sys-primary, #1976d2) 20%, transparent); }
    .full-width { width: 100%; }
    .json-field { margin-top: 8px; }
    .error-hint { color: var(--mat-sys-error, #f44336); display: flex; align-items: center; gap: 8px; font-weight: 500; font-size: 0.9rem; margin-top: 8px; }

    .store-header { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
    .header-actions { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
    .store-items { display: flex; flex-direction: column; gap: 8px; }
    .store-item { display: flex; align-items: center; gap: 12px; }
    .store-name { font-size: 1.25rem; font-weight: 700; color: color-mix(in srgb, currentColor 80%, transparent); }
    .config-card { margin-bottom: 20px; }
    .config-row { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; padding-top: 8px; }
    .config-field { flex: 1; min-width: 160px; }
    .stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .stat-card { background: color-mix(in srgb, currentColor 4%, transparent); border: 1px solid color-mix(in srgb, currentColor 10%, transparent); border-radius: 12px; padding: 16px; text-align: center; }
    .stat-card.accent { background: color-mix(in srgb, var(--mat-sys-primary, #1976d2) 5%, transparent); }
    .stat-card.highlight { background: color-mix(in srgb, var(--mat-sys-tertiary, #6750a4) 6%, transparent); border-color: color-mix(in srgb, var(--mat-sys-tertiary, #6750a4) 20%, transparent); }
    .stat-label { display: block; font-size: 0.75rem; opacity: 0.6; margin-bottom: 6px; }
    .stat-value { font-size: 1.4rem; font-weight: 600; font-variant-numeric: tabular-nums; }
    .stat-value.positive { color: #16a34a; }
    .stat-value.negative { color: var(--mat-sys-error, #d32f2f); }
    .stat-value.primary { color: var(--mat-sys-primary, #1976d2); }
    .balance-warning { display: flex; align-items: center; gap: 8px; background: color-mix(in srgb, #f59e0b 10%, transparent); border: 1px solid color-mix(in srgb, #f59e0b 30%, transparent); color: #b45309; border-radius: 8px; padding: 12px 16px; font-size: 0.875rem; margin-bottom: 16px; }
    .table-card { margin-bottom: 24px; }
    .table-wrapper { overflow-x: auto; margin: 0 -16px; padding: 0 16px; }
    .order-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 600px; }
    .order-table th, .order-table td { padding: 12px 14px; border-bottom: 1px solid color-mix(in srgb, currentColor 8%, transparent); text-align: left; }
    .order-table th { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; opacity: 0.6; }
    .center { text-align: center; }
    .right { text-align: right; font-variant-numeric: tabular-nums; }
    .buyer-cell { font-weight: 500; }
    .store-tag { font-size: 0.65rem; opacity: 0.5; font-weight: 400; }
    .inline-input { width: 60px; background: color-mix(in srgb, currentColor 5%, transparent); border: 1px solid color-mix(in srgb, currentColor 10%, transparent); color: inherit; border-radius: 4px; padding: 2px 4px; text-align: right; outline: none; }
    
    .group-card { margin-bottom: 20px; border-color: color-mix(in srgb, var(--mat-sys-primary, #1976d2) 30%, transparent); }
    .group-configs { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
    .group-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; background: color-mix(in srgb, currentColor 3%, transparent); padding: 12px 16px; border-radius: 8px; }
    .group-info { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 280px; }
    .group-badge { background: var(--mat-sys-primary, #1976d2); color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; }
    .group-stats { font-size: 0.85rem; opacity: 0.8; }
    .group-action { display: flex; align-items: center; gap: 12px; }
    .group-discount-field { width: 160px; margin-bottom: -1.34375em; }
    .group-select { padding: 4px 8px; border-radius: 4px; font-family: inherit; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); background: color-mix(in srgb, currentColor 5%, transparent); color: inherit; outline: none; }

    .discount-chip { display: inline-block; background: #fbbf24; color: #78350f; font-size: 0.72rem; padding: 1px 7px; border-radius: 999px; margin-left: 6px; vertical-align: middle; }
    .payable { font-weight: 700; color: var(--mat-sys-primary, #1976d2); }
    .item-name-group { display: flex; flex-direction: column; gap: 2px; }
    .item-title { font-weight: 500; }
    .help-icon { font-size: 0.85em; opacity: 0.5; vertical-align: middle; }

    /* 卡片模式樣式 */
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top: 16px; }
    .item-card { border-radius: 12px; transition: transform 0.2s; border: 1px solid color-mix(in srgb, currentColor 10%, transparent); }
    .item-card:hover { transform: translateY(-2px); }
    .item-card-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 16px; border-bottom: 1px solid color-mix(in srgb, currentColor 5%, transparent); }
    .item-card-buyer { display: flex; flex-direction: column; font-weight: 600; }
    .item-card-payable { font-size: 1.2rem; font-weight: 800; color: var(--mat-sys-primary, #1976d2); }
    .item-card-content { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
    .item-card-title { font-weight: 500; font-size: 1.05rem; }
    .item-card-details { display: flex; gap: 12px; font-size: 0.85rem; opacity: 0.7; }
    .item-card-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 4px; padding-top: 8px; border-top: 1px dashed color-mix(in srgb, currentColor 10%, transparent); }
    .card-input-label { font-size: 0.75rem; opacity: 0.6; margin-bottom: 4px; display: block; }
  `],
})
export class UberEatsSettlementComponent {
  private snackBar = inject(MatSnackBar);

  rawJson = '';
  parseError = signal('');
  viewMode = signal<'table' | 'card'>('table');
  parsedOrders = signal<ParsedOrderSummary[]>([]);
  orderItems = signal<OrderItem[]>([]);

  readonly _jsonTotal = computed(() => {
    return this.parsedOrders().reduce((sum, o) => sum + o.jsonTotal, 0);
  });

  globalDiscount = 0;
  deliveryFee = 0;
  splitMethod: SplitMethod = 'proportional';

  // ─── 群組折扣設定 ────────────────────────────────────────────────────────
  availableGroups = ['A', 'B', 'C', 'D', 'E'];
  discountGroups = signal<DiscountGroupConfig[]>([]);

  readonly activeGroups = computed(() => {
    const items = this.orderItems();
    const groupSet = new Set<string>();
    items.forEach(i => {
      if (i.discountGroup) groupSet.add(i.discountGroup);
    });
    return Array.from(groupSet).sort();
  });

  readonly stats = computed(() => {
    const items = this.orderItems();
    const jsonTotal = this._jsonTotal();
    let itemSum = 0;
    let checkSum = 0;
    items.forEach(i => {
      itemSum += (i.price - i.explicitDiscount);
      checkSum += i.finalPayable;
    });
    return { itemSum, jsonTotal, discrepancy: itemSum - jsonTotal, checkSum };
  });

  readonly showBalanceWarning = computed(
    () => Math.abs(this.stats().checkSum - this.stats().jsonTotal) > 0.5 && this.orderItems().length > 0
  );

  parseJson(append = false): void {
    this.parseError.set('');
    try {
      const data = JSON.parse(this.rawJson);
      this.processData(data, append);
      this.rawJson = '';
    } catch {
      this.parseError.set('JSON 格式錯誤，請確認貼上的內容正確無誤。');
    }
  }

  private processData(jsonData: unknown, append: boolean): void {
    try {
      const data = jsonData as Record<string, unknown>;
      const orders = (data['data'] as Record<string, unknown>)['orders'] as unknown[];
      const order = orders[0] as Record<string, unknown>;
      
      const orderUUID = order['uuid'] as string || `uuid-${Date.now()}`;
      if (append && this.parsedOrders().some(o => o.uuid === orderUUID)) {
        this.parseError.set('⚠️ 此訂單已經存在於列表中，已忽略重複載入。');
        return;
      }

      const feedCards = order['feedCards'] as Array<Record<string, unknown>>;
      const summaryCard = feedCards.find(c => c['orderSummary']) as Record<string, unknown> | undefined;
      if (!summaryCard) throw new Error('找不到 orderSummary 資料');

      const analytics = order['analytics'] as Record<string, unknown>;
      const analyticsData = analytics['data'] as Record<string, unknown>;
      const jsonTotal = parseFloat(analyticsData['order_total'] as string) || 0;

      const orderInfo = order['orderInfo'] as Record<string, unknown>;
      const storeInfo = orderInfo['storeInfo'] as Record<string, unknown>;
      let storeName = storeInfo['name'] as string || '未知店家';
      
      const activeOrderOverview = order['activeOrderOverview'] as Record<string, unknown> | undefined;
      const tertiaryInfo = activeOrderOverview?.['tertiaryInfo'] as Record<string, unknown> | undefined;
      const groupOrderName = tertiaryInfo?.['title'] as string | undefined;
      if (groupOrderName && typeof groupOrderName === 'string') {
        storeName += ` [${groupOrderName}]`;
      }

      const activeStatus = order['activeOrderStatus'] as Record<string, unknown> | undefined;
      const subtitleSummary = activeStatus?.['subtitleSummary'] as Record<string, unknown> | undefined;
      const summary = subtitleSummary?.['summary'] as any;
      const status = typeof summary === 'string' ? summary : (summary?.['text'] || '');

      const orderSummary = summaryCard['orderSummary'] as Record<string, unknown>;
      const parsed = this.parseSections(orderSummary['sections'] as Array<Record<string, unknown>>, storeName);
      
      const newOrderSummary: ParsedOrderSummary = {
        uuid: orderUUID,
        storeName,
        status,
        jsonTotal
      };

      if (append) {
        this.parsedOrders.set([...this.parsedOrders(), newOrderSummary]);
        this.orderItems.set([...this.orderItems(), ...parsed]);
      } else {
        this.parsedOrders.set([newOrderSummary]);
        this.orderItems.set(parsed);
      }
      this.recalculate();
    } catch (err) {
      this.parseError.set(`解析失敗：${(err as Error).message}`);
    }
  }

  private parseSections(sections: Array<Record<string, unknown>>, storeName: string): OrderItem[] {
    const results: OrderItem[] = [];
    sections.forEach(section => {
      const header = section['header'] as Record<string, unknown>;
      const buyer = header['title'] as string;
      const items = section['items'] as Array<Record<string, unknown>>;
      items.forEach(item => {
        const price = parseFloat(((item['price'] as string) || '$0').replace(/[^\d.]/g, '')) || 0;
        const subtitle = (item['subtitle'] as string) || '';
        let customizationPrice = 0;
        const priceMatches = subtitle.matchAll(/\(\$\s*(\d+\.?\d*)\s*\)/g);
        for (const match of priceMatches) {
          customizationPrice += parseFloat(match[1]);
        }
        const discountObj = item['itemDiscount'] as Record<string, unknown> | undefined;
        const explicitDiscount = discountObj ? parseFloat(((discountObj['formattedAmount'] as string) || '0').replace(/[^\d.]/g, '')) || 0 : 0;
        results.push({
          storeName, buyer,
          itemName: item['title'] as string,
          quantity: (item['quantity'] as number) || 1,
          price, customizationPrice, explicitDiscount,
          discountGroup: null,
          finalPayable: 0,
        });
      });
    });
    return results;
  }

  updateItemOption(index: number, field: 'discountGroup', value: any): void {
    const items = [...this.orderItems()];
    items[index] = { ...items[index], [field]: value };
    this.orderItems.set(items);
    this.recalculate();
  }

  getGroupConfig(groupId: string): DiscountGroupConfig | undefined {
    return this.discountGroups().find(g => g.groupId === groupId);
  }

  getGroupManualDiscount(groupId: string): number {
    return this.getGroupConfig(groupId)?.manualDiscount || 0;
  }

  getGroupWaivedCups(groupId: string): number {
    return this.getGroupConfig(groupId)?.waivedCups || 0;
  }

  updateGroupDiscount(groupId: string, amount: number): void {
    const groups = [...this.discountGroups()];
    const idx = groups.findIndex(g => g.groupId === groupId);
    if (idx >= 0) {
      groups[idx] = { ...groups[idx], manualDiscount: amount };
    } else {
      groups.push({ groupId, manualDiscount: amount, waivedCups: 0 });
    }
    this.discountGroups.set(groups);
    this.recalculate();
  }

  updateGroupWaivedCups(groupId: string, cups: number): void {
    const groups = [...this.discountGroups()];
    const idx = groups.findIndex(g => g.groupId === groupId);
    if (idx >= 0) {
      groups[idx] = { ...groups[idx], waivedCups: cups };
    } else {
      groups.push({ groupId, manualDiscount: 0, waivedCups: cups });
    }
    this.discountGroups.set(groups);
    this.recalculate();
  }

  getGroupItems(groupId: string): OrderItem[] {
    return this.orderItems().filter(i => i.discountGroup === groupId);
  }

  getGroupItemCount(groupId: string): number {
    return this.getGroupItems(groupId).reduce((sum, item) => sum + item.quantity, 0);
  }

  getGroupBasePriceTotal(groupId: string): number {
    return this.getGroupItems(groupId).reduce((sum, item) => sum + (item.price - item.customizationPrice), 0);
  }

  getGroupExplicitDiscount(groupId: string): number {
    return this.getGroupItems(groupId).reduce((sum, item) => sum + item.explicitDiscount, 0);
  }

  recalculate(): void {
    const items = this.orderItems();
    if (items.length === 0) return;

    const netAdjustment = this.deliveryFee - this.globalDiscount;

    // 1. 建立群組折扣池
    const groupContexts = new Map<string, { totalBase: number, totalDiscountToDistribute: number }>();

    this.activeGroups().forEach(groupId => {
      const totalBase = this.getGroupBasePriceTotal(groupId);
      const itemCount = this.getGroupItemCount(groupId);
      const explicitDist = this.getGroupExplicitDiscount(groupId);
      const manualDist = this.getGroupManualDiscount(groupId);
      const waivedCups = this.getGroupWaivedCups(groupId);
      
      let waivedCupsDiscount = 0;
      if (itemCount > 0 && waivedCups > 0) {
        waivedCupsDiscount = (totalBase / itemCount) * waivedCups;
      }

      groupContexts.set(groupId, {
        totalBase,
        totalDiscountToDistribute: explicitDist + manualDist + waivedCupsDiscount
      });
    });

    let globalBasePoolTotal = 0;

    // 2. 第一階段：計算折扣後的 itemBase
    const phase1Items = items.map(item => {
      let itemBase = 0;
      const basePrice = item.price - item.customizationPrice;

      if (item.discountGroup) {
        const ctx = groupContexts.get(item.discountGroup);
        if (ctx && ctx.totalBase > 0) {
          const ratio = basePrice / ctx.totalBase;
          const discountShare = ctx.totalDiscountToDistribute * ratio;
          itemBase = basePrice - discountShare + item.customizationPrice;
        } else {
          itemBase = item.price - item.explicitDiscount;
        }
      } else {
        itemBase = item.price - item.explicitDiscount;
      }
      
      if (itemBase < 0) itemBase = 0;
      globalBasePoolTotal += itemBase;
      return { originalRef: item, computedItemBase: itemBase };
    });

    // 3. 第二階段：分配全域運費/折扣
    const updated = phase1Items.map(({ originalRef, computedItemBase }) => {
      let share = 0;
      if (this.splitMethod === 'proportional' && globalBasePoolTotal > 0) {
        share = (computedItemBase / globalBasePoolTotal) * netAdjustment;
      } else if (this.splitMethod === 'flat') {
        share = netAdjustment / items.length;
      }

      return { ...originalRef, finalPayable: computedItemBase + share };
    });

    this.orderItems.set(updated);
  }

  exportCsv(): void {
    const items = this.orderItems();
    const stats = this.stats();
    let csv = '\uFEFF店家,訂購人,品項,數量,原價,加項,群組,應付金額\n';
    items.forEach(item => {
      csv += `${item.storeName},${item.buyer},"${item.itemName}",${item.quantity},${item.price.toFixed(2)},${item.customizationPrice.toFixed(2)},${item.discountGroup || ''},${item.finalPayable.toFixed(2)}\n`;
    });
    csv += `\n總計,,,,${stats.itemSum.toFixed(2)},,,${stats.checkSum.toFixed(2)}\n`;

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
    this.parsedOrders.set([]);
    this.orderItems.set([]);
    this.discountGroups.set([]);
    this.globalDiscount = 0;
    this.deliveryFee = 0;
    this.splitMethod = 'proportional';
  }

  fmt(value: number): string {
    return '$' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}
