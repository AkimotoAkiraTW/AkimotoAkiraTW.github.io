import {
  Component, signal, computed, inject,
  ChangeDetectionStrategy, HostListener,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToolLayoutComponent } from '../tool-layout.component';
import { MediaParserService, MediaRecord } from './media-parser.service';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-media-declaration-parser',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatButtonModule, MatIconModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule,
    ToolLayoutComponent,
  ],
  template: `
<app-tool-layout
  title="媒體申報檔解析工具"
  description="上傳國稅局格式的 TXT 申報檔，自動依法規計算 B2C 整期逆算稅額與 B2B 逐筆稅額，支援特種稅率分群彙總。">

  <div class="tool-content">

    <!-- 稅率設定卡 -->
    <mat-card appearance="outlined" class="rate-card">
      <mat-card-content>
        <div class="rate-row">
          <div class="rate-item">
            <label class="rate-label">
              <mat-icon inline>percent</mat-icon> 一般應稅稅率
            </label>
            <div class="rate-input-wrap">
              <input type="number" class="rate-input" [(ngModel)]="generalRatePct"
                     (ngModelChange)="onRateChange()" min="0" max="100" step="0.1">
              <span class="rate-unit">%</span>
            </div>
          </div>
          <div class="rate-divider"></div>
          <div class="rate-item">
            <label class="rate-label">
              <mat-icon inline>local_bar</mat-icon> 特種稅額稅率
              <span class="rate-hint" matTooltip="第79碼有值時適用（如酒家25%、夜總會15%）">?</span>
            </label>
            <div class="rate-input-wrap">
              <input type="number" class="rate-input" [(ngModel)]="specialRatePct"
                     (ngModelChange)="onRateChange()" min="0" max="100" step="0.1">
              <span class="rate-unit">%</span>
            </div>
          </div>
        </div>
      </mat-card-content>
    </mat-card>

    <!-- 上傳區 -->
    <div class="drop-zone" [class.dragover]="isDragging()"
         (click)="fileInput.click()"
         (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
      <input #fileInput type="file" accept=".txt,.TXT" multiple style="display:none"
             (change)="onFileChange($event)">
      <mat-icon class="drop-icon">upload_file</mat-icon>
      <div class="drop-title">拖曳或點選上傳媒體申報檔 (.TXT)</div>
      <div class="drop-sub">支援一次上傳多個 TXT 檔案</div>
    </div>

    @if (allRows().length > 0) {

      <!-- 統計看板 -->
      <div class="stats-section">

        <!-- 發票張數 -->
        <div class="stat-group">
          <div class="stat-group-title">📄 發票張數</div>
          <div class="stat-grid">
            <div class="stat-card"><span class="stat-label">總張數</span><span class="stat-val accent">{{ stats().invTotal }}</span></div>
            <div class="stat-card"><span class="stat-label">正常</span><span class="stat-val green">{{ stats().invValid }}</span></div>
            <div class="stat-card"><span class="stat-label">作廢</span><span class="stat-val red">{{ stats().invVoid }}</span></div>
            <div class="stat-card"><span class="stat-label">自然人(B2C)</span><span class="stat-val green">{{ stats().invB2C }}</span></div>
            <div class="stat-card"><span class="stat-label">法人(B2B)</span><span class="stat-val yellow">{{ stats().invB2B }}</span></div>
            <div class="stat-card"><span class="stat-label">總資料筆數</span><span class="stat-val">{{ stats().totalRows }}</span></div>
          </div>
        </div>

        <!-- 一般應稅 -->
        <div class="stat-group">
          <div class="stat-group-title">⚡ 一般應稅（{{ generalRatePct }}%）— 依施行細則第 32-1 條整期逆算</div>
          <div class="stat-grid">
            <div class="stat-card"><span class="stat-label">B2C 含稅總額</span><span class="stat-val">{{ fmt(stats().b2cGross) }}</span><span class="stat-sub">逆算來源</span></div>
            <div class="stat-card"><span class="stat-label">B2C 未稅銷售額</span><span class="stat-val green">{{ fmt(stats().b2cSalesAgg) }}</span></div>
            <div class="stat-card"><span class="stat-label">B2C 稅額</span><span class="stat-val red">{{ fmt(stats().b2cTaxAgg) }}</span></div>
            <div class="stat-card"><span class="stat-label">B2B 銷售額</span><span class="stat-val green">{{ fmt(stats().b2bSales) }}</span></div>
            <div class="stat-card"><span class="stat-label">B2B 稅額</span><span class="stat-val red">{{ fmt(stats().b2bTax) }}</span></div>
            <div class="stat-card accent-card"><span class="stat-label">★ 應稅含稅總額</span><span class="stat-val accent">{{ fmt(stats().taxGross) }}</span></div>
          </div>
        </div>

        <!-- 特種稅額（只在偵測到特種代號時顯示） -->
        @if (stats().specialB2cGross > 0 || stats().specialB2bSales > 0) {
          <div class="stat-group special-group">
            <div class="stat-group-title">🔮 特種稅額（{{ specialRatePct }}%）— 第79碼有值</div>
            <div class="stat-grid">
              <div class="stat-card"><span class="stat-label">B2C 含稅總額</span><span class="stat-val">{{ fmt(stats().specialB2cGross) }}</span></div>
              <div class="stat-card"><span class="stat-label">B2C 未稅銷售額</span><span class="stat-val green">{{ fmt(stats().specialB2cSalesAgg) }}</span></div>
              <div class="stat-card"><span class="stat-label">B2C 稅額</span><span class="stat-val red">{{ fmt(stats().specialB2cTaxAgg) }}</span></div>
              <div class="stat-card"><span class="stat-label">B2B 銷售額</span><span class="stat-val green">{{ fmt(stats().specialB2bSales) }}</span></div>
              <div class="stat-card"><span class="stat-label">B2B 稅額</span><span class="stat-val red">{{ fmt(stats().specialB2bTax) }}</span></div>
            </div>
          </div>
        }

        <!-- 零稅率/免稅/總計 -->
        <div class="stat-group">
          <div class="stat-group-title">🔵 零稅率 / ⬜ 免稅 / 📊 總計</div>
          <div class="stat-grid">
            <div class="stat-card"><span class="stat-label">零稅率銷售額</span><span class="stat-val green">{{ fmt(stats().zeroSales) }}</span></div>
            <div class="stat-card"><span class="stat-label">免稅銷售額</span><span class="stat-val green">{{ fmt(stats().exSales) }}</span></div>
            <div class="stat-card total-card"><span class="stat-label">★ 總銷售額（未稅）</span><span class="stat-val yellow">{{ fmt(stats().totalSales) }}</span></div>
            <div class="stat-card total-card"><span class="stat-label">★ 總稅額</span><span class="stat-val red">{{ fmt(stats().totalTax) }}</span></div>
          </div>
        </div>
      </div>

      <!-- 篩選控制 -->
      <mat-card appearance="outlined" class="filter-card">
        <mat-card-content>
          <div class="filter-row">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>期別</mat-label>
              <mat-select [(ngModel)]="filterPeriod" (ngModelChange)="applyFilter()">
                <mat-option value="all">全部期別</mat-option>
                @for (p of periods(); track p) {
                  <mat-option [value]="p">{{ p }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>類型</mat-label>
              <mat-select [(ngModel)]="filterType" (ngModelChange)="applyFilter()">
                <mat-option value="all">全部</mat-option>
                <mat-option value="b2c">自然人(B2C)</mat-option>
                <mat-option value="b2b">法人(B2B)</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>課稅別</mat-label>
              <mat-select [(ngModel)]="filterTax" (ngModelChange)="applyFilter()">
                <mat-option value="all">全部</mat-option>
                <mat-option value="1">應稅</mat-option>
                <mat-option value="2">零稅率</mat-option>
                <mat-option value="3">免稅</mat-option>
                <mat-option value="F">作廢</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-field search-field">
              <mat-label>搜尋</mat-label>
              <mat-icon matPrefix>search</mat-icon>
              <input matInput [(ngModel)]="searchText" (ngModelChange)="applyFilter()" placeholder="發票號碼 / 統編">
            </mat-form-field>
            <span class="result-count">共 {{ filteredRows().length }} 筆</span>
            <button mat-stroked-button (click)="svc.exportCsv(filteredRows(), generalRatePct/100, specialRatePct/100)">
              <mat-icon>download</mat-icon> 匯出 CSV
            </button>
            <button mat-button (click)="reset()">
              <mat-icon>clear</mat-icon> 清除
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- 資料表格 -->
      <mat-card appearance="outlined" class="table-card">
        <mat-card-content>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th><th>期別</th><th>字軌號碼</th><th>買受人統編</th>
                  <th>課稅別</th><th>類型</th><th class="num">帳載金額</th>
                  <th class="num">未稅銷售額</th><th class="num">明細稅額</th>
                </tr>
              </thead>
              <tbody>
                @for (r of pageRows(); track r.track + r.invNo + r.period; let i = $index) {
                  <tr [class.void-row]="r.isVoid">
                    <td class="muted">{{ (currentPage() - 1) * pageSize + i + 1 }}</td>
                    <td>{{ r.period }}</td>
                    <td class="mono">{{ r.track }}{{ r.invNo }}</td>
                    <td class="mono">{{ r.buyerId || '' }}
                      @if (!r.buyerId) { <span class="muted-text">（自然人）</span> }
                    </td>
                    <td>
                      @if (r.taxType === '1') { <span class="badge badge-tax">應稅</span> }
                      @else if (r.taxType === '2') { <span class="badge badge-zero">零稅率</span> }
                      @else if (r.taxType === '3' || r.taxType === 'F') { <span class="badge badge-ex">免稅/作廢</span> }
                      @else { <span class="badge badge-ex">{{ r.taxType }}</span> }
                      @if (r.specialTaxCode) { <span class="badge badge-special">特種{{ r.specialTaxCode }}</span> }
                    </td>
                    <td>
                      @if (r.isB2C) { <span class="badge badge-b2c">自然人</span> }
                      @else { <span class="badge badge-b2b">法人</span> }
                    </td>
                    <td class="num">{{ r.amount.toLocaleString() }}</td>
                    <td class="num green-text">{{ r.salesAmt.toLocaleString() }}</td>
                    <td class="num">
                      @if (r.isB2C && r.taxType === '1') {
                        <span class="muted-text">內含</span>
                      } @else {
                        <span class="red-text">{{ r.taxAmt.toLocaleString() }}</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </mat-card-content>

        <!-- 分頁 -->
        @if (totalPages() > 1) {
          <mat-card-actions class="pagination">
            <button mat-icon-button (click)="goPage(currentPage() - 1)" [disabled]="currentPage() <= 1">
              <mat-icon>chevron_left</mat-icon>
            </button>
            <span class="page-info">第 {{ currentPage() }} / {{ totalPages() }} 頁</span>
            <button mat-icon-button (click)="goPage(currentPage() + 1)" [disabled]="currentPage() >= totalPages()">
              <mat-icon>chevron_right</mat-icon>
            </button>
          </mat-card-actions>
        }
      </mat-card>
    }
  </div>
</app-tool-layout>
  `,
  styles: [`
    .tool-content { padding-bottom: 60px; }

    /* 稅率設定卡 */
    .rate-card { margin-bottom: 20px; border-color: var(--border-color) !important; }
    .rate-row { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; padding: 4px 0; }
    .rate-item { display: flex; align-items: center; gap: 12px; }
    .rate-label { font-size: 0.875rem; font-weight: 600; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; white-space: nowrap; }
    .rate-hint { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: var(--surface-alt); font-size: 0.7rem; cursor: help; color: var(--text-muted); }
    .rate-input-wrap { display: flex; align-items: center; gap: 4px; }
    .rate-input { width: 72px; padding: 8px 10px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--surface-alt); color: var(--text-primary); font-size: 1rem; font-weight: 700; text-align: right; outline: none; transition: border-color 200ms; }
    .rate-input:focus { border-color: var(--accent-color); }
    .rate-unit { font-weight: 700; color: var(--text-muted); }
    .rate-divider { width: 1px; height: 32px; background: var(--border-color); }

    /* 上傳區 */
    .drop-zone {
      border: 2px dashed var(--accent-color); border-radius: 16px; padding: 48px 24px;
      text-align: center; cursor: pointer; transition: all 250ms ease;
      background: var(--glass-bg); backdrop-filter: blur(10px);
      margin-bottom: 28px;
    }
    .drop-zone:hover, .drop-zone.dragover {
      background: color-mix(in srgb, var(--accent-color) 8%, var(--surface-color));
      border-color: var(--text-primary); transform: scale(1.01);
    }
    .drop-icon { font-size: 48px; width: 48px; height: 48px; color: var(--accent-color); margin-bottom: 12px; }
    .drop-title { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
    .drop-sub { font-size: 0.85rem; color: var(--text-muted); }

    /* 統計看板 */
    .stats-section { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
    .stat-group { background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 16px; padding: 20px 24px; box-shadow: var(--card-shadow); }
    .stat-group.special-group { border-color: color-mix(in srgb, purple 30%, var(--border-color)); }
    .stat-group-title { font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px; }
    .stat-grid { display: flex; gap: 12px; flex-wrap: wrap; }
    .stat-card { background: var(--surface-alt); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px 18px; min-width: 130px; flex: 1; display: flex; flex-direction: column; gap: 4px; transition: transform 200ms; }
    .stat-card:hover { transform: translateY(-2px); }
    .stat-card.accent-card { border-color: var(--accent-color); background: color-mix(in srgb, var(--accent-color) 8%, var(--surface-alt)); }
    .stat-card.total-card { border-color: color-mix(in srgb, #f59e0b 40%, var(--border-color)); }
    .stat-label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .stat-val { font-size: 1.25rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-primary); }
    .stat-sub { font-size: 0.65rem; color: var(--text-muted); }
    .stat-val.green { color: #22c55e; }
    .stat-val.red { color: #ef4444; }
    .stat-val.yellow { color: #f59e0b; }
    .stat-val.accent { color: var(--accent-color); }

    /* 篩選 */
    .filter-card { margin-bottom: 16px; }
    .filter-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; padding: 4px 0; }
    .filter-field { min-width: 130px; margin-bottom: -1.34375em; }
    .search-field { min-width: 200px; flex: 1; }
    .result-count { font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; }

    /* 表格 */
    .table-card { margin-bottom: 24px; }
    .table-wrap { overflow-x: auto; margin: 0 -16px; padding: 0 2px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; min-width: 700px; }
    .data-table th, .data-table td { padding: 10px 14px; border-bottom: 1px solid var(--border-color); text-align: left; }
    .data-table th { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); background: var(--surface-alt); position: sticky; top: 0; }
    .data-table tr:hover td { background: color-mix(in srgb, var(--accent-color) 3%, transparent); }
    .data-table tr.void-row td { opacity: 0.4; text-decoration: line-through; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .mono { font-family: 'Roboto Mono', monospace; font-size: 0.82rem; }
    .muted { color: var(--text-muted); }
    .muted-text { color: var(--text-muted); font-size: 0.82rem; }
    .green-text { color: #22c55e; }
    .red-text { color: #ef4444; }

    /* Badges */
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 700; margin-right: 3px; }
    .badge-tax { background: color-mix(in srgb, #ef4444 15%, transparent); color: #ef4444; }
    .badge-zero { background: color-mix(in srgb, #22c55e 15%, transparent); color: #22c55e; }
    .badge-ex { background: color-mix(in srgb, var(--text-muted) 15%, transparent); color: var(--text-muted); }
    .badge-special { background: color-mix(in srgb, purple 15%, transparent); color: purple; }
    .badge-b2c { background: color-mix(in srgb, #22c55e 15%, transparent); color: #22c55e; }
    .badge-b2b { background: color-mix(in srgb, #f59e0b 15%, transparent); color: #f59e0b; }

    /* 分頁 */
    .pagination { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; }
    .page-info { font-size: 0.875rem; color: var(--text-secondary); min-width: 100px; text-align: center; }
  `],
})
export class MediaDeclarationParserComponent {
  svc = inject(MediaParserService);

  // ── 稅率 ──────────────────────────────────────────────────────────────────
  generalRatePct = 5;
  specialRatePct = 25;

  // ── 狀態 ──────────────────────────────────────────────────────────────────
  isDragging  = signal(false);
  allRows     = signal<MediaRecord[]>([]);
  filteredRows = signal<MediaRecord[]>([]);
  currentPage = signal(1);
  readonly pageSize = PAGE_SIZE;

  // ── 篩選條件 ──────────────────────────────────────────────────────────────
  filterPeriod = 'all';
  filterType   = 'all';
  filterTax    = 'all';
  searchText   = '';

  // ── 計算屬性 ──────────────────────────────────────────────────────────────
  readonly periods = computed(() =>
    [...new Set(this.allRows().map(r => r.period))].sort()
  );

  readonly stats = computed(() =>
    this.svc.calcStats(this.allRows(), this.generalRatePct / 100, this.specialRatePct / 100)
  );

  readonly pageRows = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filteredRows().slice(start, start + PAGE_SIZE);
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / PAGE_SIZE))
  );

  // ── 事件處理 ──────────────────────────────────────────────────────────────
  onDragOver(e: DragEvent)  { e.preventDefault(); this.isDragging.set(true); }
  onDragLeave(e: DragEvent) { e.preventDefault(); this.isDragging.set(false); }
  onDrop(e: DragEvent)      { e.preventDefault(); this.isDragging.set(false); this.handleFiles(e.dataTransfer?.files); }
  onFileChange(e: Event)    { this.handleFiles((e.target as HTMLInputElement).files); }

  private async handleFiles(files: FileList | null | undefined) {
    if (!files?.length) return;
    const parsed: MediaRecord[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      parsed.push(...this.svc.parseFile(text, file.name));
    }
    this.allRows.set(parsed);
    this.applyFilter();
  }

  applyFilter() {
    const rows = this.allRows().filter(r => {
      if (this.filterPeriod !== 'all' && r.period !== this.filterPeriod) return false;
      if (this.filterType === 'b2c' && !r.isB2C) return false;
      if (this.filterType === 'b2b' && r.isB2C) return false;
      if (this.filterTax !== 'all' && r.taxType !== this.filterTax) return false;
      if (this.searchText) {
        const hay = (r.invNo + r.track + r.buyerId + r.sellerId).toLowerCase();
        if (!hay.includes(this.searchText.toLowerCase())) return false;
      }
      return true;
    });
    this.filteredRows.set(rows);
    this.currentPage.set(1);
  }

  onRateChange() { /* stats computed 自動重新計算 */ }

  goPage(p: number) {
    if (p < 1 || p > this.totalPages()) return;
    this.currentPage.set(p);
  }

  reset() {
    this.allRows.set([]);
    this.filteredRows.set([]);
    this.filterPeriod = 'all';
    this.filterType   = 'all';
    this.filterTax    = 'all';
    this.searchText   = '';
  }

  fmt(n: number) { return '$' + n.toLocaleString(); }
}
