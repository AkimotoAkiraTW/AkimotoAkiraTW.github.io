import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SITE_CONFIG } from '../../core/config/site.config';

@Component({
  selector: 'app-tool-layout',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="content-container">
      <!-- 統一的返回按鈕 -->
      <a mat-button routerLink="/tools" class="back-link">
        <mat-icon>arrow_back</mat-icon> 返回工具箱
      </a>

      <!-- 統一的標題區塊 -->
      <header class="page-header">
        <h1>{{ title }}</h1>
        @if (description) {
          <p>{{ description }}</p>
        }
      </header>

      <!-- 工具內容插槽 -->
      <div class="tool-content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .back-link {
      margin-bottom: 24px;
      opacity: 0.7;
      transition: opacity 200ms ease;
    }
    .back-link:hover { opacity: 1; }
    
    .page-header {
      margin-bottom: 40px;
    }
    .page-header h1 {
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 800;
      letter-spacing: -0.03em;
      margin-bottom: 12px;
    }
    .page-header p {
      font-size: 1.1rem;
      opacity: 0.6;
      max-width: 60ch;
    }
    
    .tool-content {
      /* 可以在這裡統一控制所有工具的進場動畫 */
      animation: fadeIn 400ms ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class ToolLayoutComponent {
  @Input({ required: true }) title!: string;
  @Input() description?: string;
}
