import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  copyElementPngToClipboard,
  downloadBlob,
  elementToPngBlob,
  stampFilename,
} from './capture-element';

@Component({
  selector: 'app-capture-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatSnackBarModule, MatTooltipModule],
  template: `
    <div class="capture-panel">
      <div class="capture-bar no-capture">
        @if (title()) {
          <span class="capture-title">{{ title() }}</span>
        }
        <span class="spacer"></span>
        <div class="capture-extras">
          <ng-content select="[extra]" />
        </div>
        <button
          type="button"
          mat-stroked-button
          [disabled]="!enabled() || busy() !== 'idle'"
          (click)="copyImage()"
          matTooltip="截圖並複製到剪貼簿，不會下載檔案">
          <mat-icon>{{ busy() === 'copy' ? 'hourglass_top' : 'photo_camera' }}</mat-icon>
          截圖
        </button>
        <button
          type="button"
          mat-stroked-button
          [disabled]="!enabled() || busy() !== 'idle'"
          (click)="downloadImage()"
          matTooltip="下載 PNG 檔">
          <mat-icon>{{ busy() === 'download' ? 'hourglass_top' : 'download' }}</mat-icon>
          下載
        </button>
      </div>
      <div #captureRoot class="capture-body" [class.hug]="hug()">
        <ng-content />
      </div>
    </div>
  `,
  host: {
    class: 'capture-panel-host',
    // `title` 只當截圖列標籤，不要變成包住畫布的原生 tooltip。
    '[attr.title]': 'null',
  },
  styles: [`
    :host { display: block; }
    .capture-panel { display: block; }
    .capture-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 12px 16px 0;
      position: relative;
      z-index: 1;
    }
    .capture-title {
      font-size: 0.95rem;
      font-weight: 700;
      flex: 0 0 auto;
    }
    .capture-extras {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      flex: 1 1 220px;
      min-width: 0;
    }
    .spacer { flex: 1 1 12px; }
    .capture-bar button mat-icon { margin-right: 4px; }
    .capture-body { display: block; width: 100%; }
    .capture-body.hug {
      width: fit-content;
      max-width: 100%;
      margin-inline: auto;
    }
  `],
})
export class CapturePanelComponent {
  private readonly snackBar = inject(MatSnackBar);
  private readonly captureRoot = viewChild<ElementRef<HTMLElement>>('captureRoot');

  readonly title = input('');
  readonly filenamePrefix = input.required<string>();
  readonly enabled = input(true);
  readonly hug = input(false);
  readonly busy = signal<'idle' | 'copy' | 'download'>('idle');

  copyImage(): void {
    const element = this.captureRoot()?.nativeElement;
    if (!element) {
      this.snackBar.open('找不到可截圖的區塊', '', { duration: 2000 });
      return;
    }
    const copyPromise = copyElementPngToClipboard(element);
    this.busy.set('copy');
    void copyPromise
      .then((copied) => {
        this.snackBar.open(copied ? '已複製圖片' : '複製失敗，請改用下載', '', { duration: 2500 });
      })
      .catch(() => this.snackBar.open('截圖失敗，請再試一次', '', { duration: 3000 }))
      .finally(() => this.busy.set('idle'));
  }

  async downloadImage(): Promise<void> {
    const element = this.captureRoot()?.nativeElement;
    if (!element) {
      this.snackBar.open('找不到可截圖的區塊', '', { duration: 2000 });
      return;
    }
    this.busy.set('download');
    try {
      const blob = await elementToPngBlob(element);
      downloadBlob(blob, stampFilename(this.filenamePrefix()));
      this.snackBar.open('已下載圖片', '', { duration: 2000 });
    } catch {
      this.snackBar.open('下載失敗，請再試一次', '', { duration: 3000 });
    } finally {
      this.busy.set('idle');
    }
  }
}
