import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface PartnerConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
}

@Component({
  selector: 'app-partner-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon color="warn">warning</mat-icon>
      {{ data.title }}
    </h2>
    <mat-dialog-content>
      <p class="dialog-message">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button type="button" (click)="dialogRef.close(false)">取消</button>
      <button mat-raised-button color="warn" type="button" (click)="dialogRef.close(true)">
        {{ data.confirmLabel || '確認' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      margin: 0;
      font-size: 1.1rem;
      color: var(--text-primary);
    }
    .dialog-message {
      margin: 0;
      line-height: 1.6;
      color: var(--text-secondary);
    }
    .dialog-actions { gap: var(--space-sm); }
  `],
})
export class PartnerConfirmDialogComponent {
  readonly dialogRef = inject(MatDialogRef<PartnerConfirmDialogComponent, boolean>);
  readonly data = inject<PartnerConfirmDialogData>(MAT_DIALOG_DATA);
}
