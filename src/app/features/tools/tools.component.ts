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
    <div class="content-container">
      <header class="page-header">
        <h1>{{ cfg.navLabels.tools }}</h1>
        <p>收集了一些日常開發中常用的小工具。</p>
      </header>

      <div class="tools-grid">
        @for (tool of tools(); track tool.id) {
          <mat-card class="tool-card" appearance="outlined">
            <mat-card-header>
              <mat-icon mat-card-avatar>{{ tool.icon }}</mat-icon>
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
    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 32px;
      padding-bottom: 48px;
    }
    .tool-card {
      transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
      padding: 16px;
    }
    .tool-card:hover {
      transform: translateY(-4px);
    }
    .empty-state {
      opacity: 0.5;
      padding: 48px 0;
    }
  `],
})
export class ToolsComponent {
  readonly cfg = SITE_CONFIG;
  private dataService = inject(DataService);
  tools = toSignal(this.dataService.getTools(), { initialValue: [] });
}
