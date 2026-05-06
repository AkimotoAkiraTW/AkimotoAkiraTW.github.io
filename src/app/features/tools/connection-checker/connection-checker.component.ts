import {
  Component,
  signal,
  inject,
  DestroyRef,
  ChangeDetectionStrategy,
  NgZone,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { interval, Subscription } from 'rxjs';

// ─── 資料模型 ────────────────────────────────────────────────────────────────

type StatusLight = 'idle' | 'checking' | 'success' | 'error';

interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface EndpointCard {
  id: number;
  url: string;
  frequencyMs: number;
  isRunning: boolean;
  isFailing: boolean;
  status: StatusLight;
  logs: LogEntry[];
  subscription: Subscription | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-connection-checker',
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
    MatTooltipModule,
  ],
  template: `
    <div class="content-container tool-page">

      <!-- 返回 -->
      <a mat-button routerLink="/tools" class="back-link">
        <mat-icon>arrow_back</mat-icon> 回工具箱
      </a>

      <header class="tool-header">
        <div class="tool-title-row">
          <h1>Connection Checker</h1>
          <button mat-raised-button color="primary" (click)="addCard()">
            <mat-icon>add</mat-icon> Add Endpoint
          </button>
        </div>
        <p class="subtitle">監控多個端點的連線狀態，失敗時發送桌面通知。</p>
      </header>

      <!-- 卡片網格 -->
      @if (cards().length === 0) {
        <mat-card appearance="outlined" class="empty-state">
          <mat-card-content>
            <mat-icon class="empty-icon">wifi_off</mat-icon>
            <p>尚未設定任何監控端點</p>
            <p class="empty-hint">點擊右上角「Add Endpoint」開始新增。</p>
          </mat-card-content>
        </mat-card>
      }

      <div class="cards-grid">
        @for (card of cards(); track card.id) {
          <mat-card appearance="outlined" class="endpoint-card" [class.running]="card.isRunning">
            <mat-card-header>
              <div mat-card-avatar class="status-avatar">
                <span
                  class="status-dot"
                  [class]="'status-dot--' + card.status"
                  [matTooltip]="statusLabel(card.status)"
                ></span>
              </div>
              <mat-card-title>Endpoint Monitor</mat-card-title>
              <mat-card-subtitle>#{{ card.id }}</mat-card-subtitle>
              <button
                mat-icon-button
                class="remove-btn"
                (click)="removeCard(card.id)"
                [disabled]="card.isRunning"
                matTooltip="移除此監控（需先停止）"
              >
                <mat-icon>close</mat-icon>
              </button>
            </mat-card-header>

            <mat-card-content>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Target URL</mat-label>
                <input
                  matInput
                  type="text"
                  [(ngModel)]="card.url"
                  [disabled]="card.isRunning"
                  placeholder="https://example.com/"
                >
                <mat-icon matPrefix>link</mat-icon>
              </mat-form-field>

              <div class="freq-row">
                <mat-form-field appearance="outline" class="freq-field">
                  <mat-label>頻率 (ms)</mat-label>
                  <input
                    matInput
                    type="number"
                    [(ngModel)]="card.frequencyMs"
                    [disabled]="card.isRunning"
                    min="50"
                  >
                  <mat-icon matPrefix>timer</mat-icon>
                </mat-form-field>

                <div class="card-actions">
                  <button
                    mat-raised-button
                    [color]="card.isRunning ? 'warn' : 'primary'"
                    (click)="toggleCard(card.id)"
                  >
                    <mat-icon>{{ card.isRunning ? 'stop' : 'play_arrow' }}</mat-icon>
                    {{ card.isRunning ? 'Stop' : 'Start' }}
                  </button>
                  <button
                    mat-stroked-button
                    (click)="clearLog(card.id)"
                    [disabled]="card.logs.length === 0"
                  >
                    <mat-icon>delete_sweep</mat-icon>
                    Clear
                  </button>
                </div>
              </div>

              <!-- 日誌區 -->
              <div class="log-box" [id]="'log-' + card.id">
                @for (entry of card.logs; track $index) {
                  <div class="log-entry" [class]="'log-entry--' + entry.type">
                    <span class="log-time">{{ entry.time }}</span>
                    <span class="log-msg">{{ entry.message }}</span>
                  </div>
                }
                @if (card.logs.length === 0) {
                  <div class="log-entry log-entry--info log-empty">Waiting to start...</div>
                }
              </div>
            </mat-card-content>
          </mat-card>
        }
      </div>
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

    .tool-header { margin-bottom: 24px; }

    .tool-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }

    .tool-header h1 {
      font-size: clamp(1.6rem, 3vw, 2.2rem);
      font-weight: 600;
      letter-spacing: -0.03em;
      margin: 0;
    }

    .subtitle {
      opacity: 0.6;
      font-size: 0.95rem;
      margin: 0;
    }

    /* 空狀態 */
    .empty-state {
      text-align: center;
      padding: 32px;
      margin-bottom: 24px;
    }

    .empty-icon {
      font-size: 3rem;
      width: 3rem;
      height: 3rem;
      opacity: 0.3;
      margin-bottom: 12px;
    }

    .empty-hint {
      font-size: 0.85rem;
      opacity: 0.5;
      margin-top: 4px;
    }

    /* 卡片網格 */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 20px;
    }

    .endpoint-card {
      position: relative;
      transition: transform 200ms ease, box-shadow 200ms ease;
    }

    .endpoint-card:hover {
      transform: translateY(-2px);
    }

    .endpoint-card.running {
      border-color: var(--mat-sys-primary, #1976d2) !important;
    }

    /* 狀態頭像區 */
    .status-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent !important;
    }

    /* 狀態燈 */
    .status-dot {
      display: inline-block;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #9ca3af;
      box-shadow: 0 0 0 0 transparent;
      transition: background 0.3s, box-shadow 0.3s;
    }

    .status-dot--idle      { background: #9ca3af; }
    .status-dot--checking  { background: #f59e0b; box-shadow: 0 0 6px #f59e0b; }
    .status-dot--success   { background: #10b981; box-shadow: 0 0 6px #10b981; }
    .status-dot--error {
      background: #ef4444;
      box-shadow: 0 0 6px #ef4444;
      animation: pulse-error 1.5s infinite;
    }

    @keyframes pulse-error {
      0%   { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70%  { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }

    /* Remove 按鈕 */
    .remove-btn {
      position: absolute !important;
      top: 8px;
      right: 8px;
    }

    /* 頻率列 */
    .freq-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
      margin-top: -4px;
    }

    .freq-field { width: 130px; flex-shrink: 0; }

    .card-actions {
      display: flex;
      gap: 8px;
      flex: 1;
      align-items: center;
      padding-top: 4px;
    }

    .full-width { width: 100%; }

    /* 日誌區 */
    .log-box {
      background: color-mix(in srgb, currentColor 4%, transparent);
      border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      border-radius: 8px;
      height: 180px;
      overflow-y: auto;
      padding: 8px;
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .log-entry {
      display: flex;
      gap: 8px;
      font-family: 'Roboto Mono', 'Consolas', monospace;
      font-size: 0.78rem;
      padding: 3px 6px;
      border-radius: 4px;
    }

    .log-entry--info    { opacity: 0.6; }
    .log-entry--success {
      color: #059669;
      background: color-mix(in srgb, #10b981 10%, transparent);
    }
    .log-entry--error {
      color: #dc2626;
      background: color-mix(in srgb, #ef4444 10%, transparent);
    }

    .log-time { opacity: 0.7; flex-shrink: 0; }
    .log-msg  { word-break: break-all; }
    .log-empty { opacity: 0.4; font-style: italic; }

    /* 滾動條 */
    .log-box::-webkit-scrollbar { width: 6px; }
    .log-box::-webkit-scrollbar-thumb {
      background: color-mix(in srgb, currentColor 20%, transparent);
      border-radius: 3px;
    }
  `],
})
export class ConnectionCheckerComponent {
  private destroyRef = inject(DestroyRef);
  private zone = inject(NgZone);

  private idCounter = 0;
  cards = signal<EndpointCard[]>([]);

  constructor() {
    // 請求 Notification 權限（一次即可）
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission !== 'granted' &&
      Notification.permission !== 'denied'
    ) {
      Notification.requestPermission();
    }
  }

  // ─── 卡片管理 ─────────────────────────────────────────────────────────────

  addCard(): void {
    const newCard: EndpointCard = {
      id: ++this.idCounter,
      url: '',
      frequencyMs: 500,
      isRunning: false,
      isFailing: false,
      status: 'idle',
      logs: [{ time: this.now(), message: 'Set up ready.', type: 'info' }],
      subscription: null,
    };
    this.cards.update(list => [...list, newCard]);
  }

  removeCard(id: number): void {
    this.cards.update(list => {
      const card = list.find(c => c.id === id);
      if (card?.subscription) card.subscription.unsubscribe();
      return list.filter(c => c.id !== id);
    });
  }

  // ─── 監控切換 ─────────────────────────────────────────────────────────────

  toggleCard(id: number): void {
    this.cards.update(list =>
      list.map(card => {
        if (card.id !== id) return card;

        if (card.isRunning) {
          // 停止
          card.subscription?.unsubscribe();
          return {
            ...card,
            isRunning: false,
            isFailing: false,
            status: 'idle' as StatusLight,
            subscription: null,
            logs: [...card.logs, { time: this.now(), message: 'Monitoring stopped.', type: 'info' as const }],
          };
        }

        // 開始
        if (!card.url.trim()) {
          alert('Please enter a valid URL.');
          return card;
        }

        const freq = Math.max(50, card.frequencyMs || 500);
        const updatedCard: EndpointCard = {
          ...card,
          isRunning: true,
          status: 'checking',
          frequencyMs: freq,
          logs: [...card.logs, {
            time: this.now(),
            message: `Monitoring started... (Every ${freq}ms)`,
            type: 'info' as const,
          }],
        };

        // 使用 RxJS interval + takeUntilDestroyed 自動清理
        const sub = interval(freq)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => {
            this.performCheck(id, updatedCard.url);
          });

        // 立即執行一次
        this.performCheck(id, updatedCard.url);

        return { ...updatedCard, subscription: sub };
      })
    );
  }

  // ─── 連線檢查 ─────────────────────────────────────────────────────────────

  private performCheck(id: number, url: string): void {
    fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-cache' })
      .then(response => {
        // no-cors 回傳 opaque（type === 'opaque'，status === 0），視為成功
        if (response.ok || response.type === 'opaque') {
          this.zone.run(() => {
            this.cards.update(list =>
              list.map(card => {
                if (card.id !== id) return card;
                const wasFailng = card.isFailing;
                const newLog: LogEntry = wasFailng
                  ? { time: this.now(), message: 'Connection recovered.', type: 'success' }
                  : { time: this.now(), message: 'Connection OK', type: 'success' };

                if (wasFailng) this.sendNotification('✅ Connection Recovered', `Successfully reconnected to ${url}`);

                return {
                  ...card,
                  status: 'success' as StatusLight,
                  isFailing: false,
                  logs: this.trimLogs([...card.logs, newLog]),
                };
              })
            );
          });
        }
      })
      .catch(() => {
        this.zone.run(() => {
          this.cards.update(list =>
            list.map(card => {
              if (card.id !== id) return card;
              const newLog: LogEntry = { time: this.now(), message: 'Connection failed!', type: 'error' };
              if (!card.isFailing) {
                this.sendNotification('❌ Connection Failed', `Unable to connect to ${url}`);
              }
              return {
                ...card,
                status: 'error' as StatusLight,
                isFailing: true,
                logs: this.trimLogs([...card.logs, newLog]),
              };
            })
          );
        });
      });
  }

  // ─── 日誌管理 ─────────────────────────────────────────────────────────────

  clearLog(id: number): void {
    this.cards.update(list =>
      list.map(card => (card.id === id ? { ...card, logs: [] } : card))
    );
  }

  private trimLogs(logs: LogEntry[]): LogEntry[] {
    return logs.length > 100 ? logs.slice(logs.length - 100) : logs;
  }

  // ─── 工具方法 ─────────────────────────────────────────────────────────────

  statusLabel(status: StatusLight): string {
    const map: Record<StatusLight, string> = {
      idle: '未啟動',
      checking: '監控中...',
      success: '連線正常',
      error: '連線失敗',
    };
    return map[status];
  }

  private now(): string {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(n => String(n).padStart(2, '0'))
      .join(':');
  }

  private sendNotification(title: string, body: string): void {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }
}
