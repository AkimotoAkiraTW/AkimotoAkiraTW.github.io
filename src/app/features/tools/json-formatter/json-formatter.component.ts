import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { inject } from '@angular/core';

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
    RouterLink,
  ],
  template: `
    <div class="content-container">
      <a mat-button routerLink="/tools" class="back-link">
        <mat-icon>arrow_back</mat-icon> Back to Tools
      </a>

      <h1>JSON Formatter</h1>
      <p class="subtitle">Paste your JSON to format, validate, and view it.</p>

      <div class="formatter-layout">
        <mat-form-field appearance="outline" class="input-field">
          <mat-label>Input JSON</mat-label>
          <textarea matInput
                    [(ngModel)]="inputJson"
                    rows="12"
                    placeholder='{"key": "value"}'>
          </textarea>
        </mat-form-field>

        <div class="actions">
          <button mat-raised-button color="primary" (click)="format()">
            <mat-icon>auto_fix_high</mat-icon> Format
          </button>
          <button mat-stroked-button (click)="minify()">
            <mat-icon>compress</mat-icon> Minify
          </button>
          <button mat-stroked-button (click)="copy()">
            <mat-icon>content_copy</mat-icon> Copy
          </button>
          <button mat-button (click)="clear()">
            <mat-icon>clear</mat-icon> Clear
          </button>
        </div>

        @if (output()) {
          <mat-card appearance="outlined" class="output-card">
            <pre class="output">{{ output() }}</pre>
          </mat-card>
        }

        @if (error()) {
          <mat-card appearance="outlined" class="error-card">
            <p class="error-text">{{ error() }}</p>
          </mat-card>
        }
      </div>
    </div>
  `,
  styles: [`
    h1 {
      font-size: 2rem;
      font-weight: 300;
      margin-bottom: 4px;
    }

    .subtitle {
      opacity: 0.7;
      margin-bottom: 24px;
    }

    .back-link {
      margin-bottom: 16px;
      display: inline-flex;
    }

    .formatter-layout {
      max-width: 800px;
    }

    .input-field {
      width: 100%;
    }

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }

    .output-card {
      margin-top: 16px;
    }

    .output {
      padding: 16px;
      overflow-x: auto;
      font-family: 'Roboto Mono', monospace;
      font-size: 0.875rem;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .error-card {
      margin-top: 16px;
      border-color: var(--mat-sys-error, #d32f2f);
    }

    .error-text {
      color: var(--mat-sys-error, #d32f2f);
      padding: 16px;
      font-family: monospace;
    }
  `],
})
export class JsonFormatterComponent {
  private snackBar = inject(MatSnackBar);
  inputJson = '';
  output = signal('');
  error = signal('');

  format(): void {
    this.error.set('');
    this.output.set('');
    try {
      const parsed = JSON.parse(this.inputJson);
      this.output.set(JSON.stringify(parsed, null, 2));
    } catch (e) {
      this.error.set(`Invalid JSON: ${(e as Error).message}`);
    }
  }

  minify(): void {
    this.error.set('');
    this.output.set('');
    try {
      const parsed = JSON.parse(this.inputJson);
      this.output.set(JSON.stringify(parsed));
    } catch (e) {
      this.error.set(`Invalid JSON: ${(e as Error).message}`);
    }
  }

  copy(): void {
    const text = this.output() || this.inputJson;
    if (text) {
      navigator.clipboard.writeText(text);
      this.snackBar.open('Copied to clipboard', '', { duration: 2000 });
    }
  }

  clear(): void {
    this.inputJson = '';
    this.output.set('');
    this.error.set('');
  }
}
