import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DataService } from '../../core/services/data.service';
import { SITE_CONFIG } from '../../core/config/site.config';

/**
 * ToolsComponent
 * 工具清單從 assets/data/tools.json 動態讀取。
 * 新增工具只需：
 *   1. 建立對應的 component（如 src/app/features/tools/<id>/<id>.component.ts）
 *   2. 在 app.routes.ts 加入對應路由
 *   3. 在 assets/data/tools.json 新增工具的 metadata 條目
 */
@Component({
  selector: 'app-tools',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatIconModule, MatButtonModule],
  template: `
    <!-- Header：維持 content-container 置中 -->
    <div class="content-container">
      <header class="page-header">
        <h1>{{ cfg.navLabels.tools }}</h1>
        <p>收集了一些日常開發中常用的小工具。</p>
      </header>
    </div>

    <!-- Grid：獨立寬容器，充分利用水平空間 -->
    <div class="tools-grid-wrapper">
      <div class="tools-grid">
        @for (tool of tools(); track tool.id) {
          <mat-card class="tool-card" appearance="outlined">
            <mat-card-header>
              <div class="tool-icon-wrap" mat-card-avatar>
                <mat-icon>{{ tool.icon }}</mat-icon>
              </div>
              <mat-card-title>{{ tool.name }}</mat-card-title>
              <mat-card-subtitle>{{ tool.description }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-actions align="end">
              <a mat-button [routerLink]="['/tools', tool.route]">
                開啟 <mat-icon>arrow_forward</mat-icon>
              </a>
            </mat-card-actions>
          </mat-card>
        }

        @if (tools().length === 0) {
          <p class="empty-state">工具載入中...</p>
        }
      </div>
    </div>
  `,
  styles: [`
    /* ── Grid wrapper：寬於 content-container，但仍置中 ── */
    .tools-grid-wrapper {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 24px 72px;
    }
    @media (min-width: 768px)  { .tools-grid-wrapper { padding: 0 40px 72px; } }
    @media (min-width: 1024px) { .tools-grid-wrapper { padding: 0 56px 72px; } }

    /* ── RWD Grid：minmax(260px) → 1/2/3/4 欄自適應 ── */
    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 20px;
    }

    /* ── Card ── */
    .tool-card {
      display: flex;
      flex-direction: column;
      transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1),
                  box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);
      border-color: var(--border-color);
      background-color: var(--surface-color);
    }
    .tool-card:hover {
      transform: translateY(-4px);
      border-color: var(--accent-color);
    }

    /* Icon 圓形背景 */
    .tool-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--surface-alt);
      color: var(--accent-color);
      flex-shrink: 0;
      mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }

    .empty-state {
      color: var(--text-muted);
      padding: 48px 0;
    }
  `],
})
export class ToolsComponent {
  readonly cfg = SITE_CONFIG;
  private dataService = inject(DataService);
  tools = toSignal(this.dataService.getTools(), { initialValue: [] });
}
