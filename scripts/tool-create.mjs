/**
 * 建立新工具 scaffold，並更新 tools.json 與 app.routes.ts。
 * 用法: npm run tool:create -- my-tool-id
 */
import fs from 'fs';
import { PATHS, resolveFromRoot } from './lib/paths.mjs';
import {
  loadTools,
  saveTools,
  componentClassName,
  kebabToPascal,
} from './lib/tools.mjs';
import { appendToolRoute } from './lib/routes.mjs';

const id = process.argv[2]?.trim();

if (!id) {
  console.error('用法: npm run tool:create -- <tool-id>');
  console.error('範例: npm run tool:create -- json-diff');
  process.exit(1);
}

if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id)) {
  console.error('tool-id 須為 kebab-case，例如: my-new-tool');
  process.exit(1);
}

const tools = loadTools();
if (tools.some((t) => t.id === id)) {
  console.error(`工具 id 已存在: ${id}`);
  process.exit(1);
}

const featureDir = resolveFromRoot(PATHS.toolsFeatureDir, id);
if (fs.existsSync(featureDir)) {
  console.error(`目錄已存在: ${PATHS.toolsFeatureDir}/${id}`);
  process.exit(1);
}

const className = componentClassName(id);
const selector = `app-${id}`;
const displayName = kebabToPascal(id).replace(/([A-Z])/g, ' $1').trim();

const componentSource = `import { Component } from '@angular/core';
import { ToolLayoutComponent } from '../tool-layout.component';

@Component({
  selector: '${selector}',
  standalone: true,
  imports: [ToolLayoutComponent],
  template: \`
    <app-tool-layout
      title="${displayName}"
      description="在此實作工具邏輯。">
      <p class="tool-placeholder">工具開發中…</p>
    </app-tool-layout>
  \`,
  styles: [\`
    .tool-placeholder {
      opacity: 0.7;
      padding: 24px 0;
    }
  \`],
})
export class ${className} {}
`;

fs.mkdirSync(featureDir, { recursive: true });
fs.writeFileSync(
  resolveFromRoot(PATHS.toolsFeatureDir, id, `${id}.component.ts`),
  componentSource,
  'utf-8'
);

tools.push({
  id,
  name: displayName,
  description: '（請更新 tools.json 中的描述）',
  icon: 'build',
  route: id,
  category: 'work',
});
saveTools(tools);

appendToolRoute({
  route: id,
  name: displayName,
  componentClass: className,
  folder: id,
});

console.log(`✅ 已建立工具「${id}」`);
console.log('   1. 實作', `${PATHS.toolsFeatureDir}/${id}/${id}.component.ts`);
console.log('   2. 更新', PATHS.toolsJson);
console.log('   3. 執行 npm run content');
