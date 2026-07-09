/**
 * 驗證內容單一事實來源與程式碼是否一致。
 * 建置前執行，避免 tools.json / 路由 / 資料夾 漂移。
 */
import fs from 'fs';
import { PATHS, resolveFromRoot } from './lib/paths.mjs';
import { loadTools } from './lib/tools.mjs';
import { parseToolRoutesFromFile } from './lib/routes.mjs';

const errors = [];

function fail(message) {
  errors.push(message);
}

function validateToolsJson(tools) {
  const ids = new Set();

  for (const tool of tools) {
    for (const key of ['id', 'name', 'description', 'icon', 'route']) {
      if (!tool[key] || typeof tool[key] !== 'string') {
        fail(`工具缺少或無效的 ${key}: ${JSON.stringify(tool)}`);
      }
    }
    if (tool.id !== tool.route) {
      fail(`工具 id 與 route 必須相同: id=${tool.id}, route=${tool.route}`);
    }
    if (ids.has(tool.id)) {
      fail(`重複的工具 id: ${tool.id}`);
    }
    ids.add(tool.id);

    if (tool.category && !['work', 'life'].includes(tool.category)) {
      fail(`工具 category 僅允許 work | life: ${tool.id}`);
    }

    const featureDir = resolveFromRoot(PATHS.toolsFeatureDir, tool.route);
    if (!fs.existsSync(featureDir)) {
      fail(`缺少工具目錄: ${PATHS.toolsFeatureDir}/${tool.route}`);
    }

    const componentFiles = fs
      .readdirSync(featureDir)
      .filter((f) => f.endsWith('.component.ts'));
    if (componentFiles.length === 0) {
      fail(`缺少元件檔: ${PATHS.toolsFeatureDir}/${tool.route}/*.component.ts`);
    }
  }

  return ids;
}

function validateRoutes(tools) {
  const jsonRoutes = new Set(tools.map((t) => t.route));
  const fileRoutes = new Set(parseToolRoutesFromFile());

  for (const route of jsonRoutes) {
    if (!fileRoutes.has(route)) {
      fail(`tools.json 有 "${route}"，但 app.routes.ts 缺少 path: 'tools/${route}'`);
    }
  }

  for (const route of fileRoutes) {
    if (!jsonRoutes.has(route)) {
      fail(`app.routes.ts 有 tools/${route}，但 tools.json 缺少對應項目`);
    }
  }
}

function validateBlogIndex() {
  const indexPath = resolveFromRoot(PATHS.blogDir, 'index.json');
  if (!fs.existsSync(indexPath)) {
    return;
  }

  const posts = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  if (!Array.isArray(posts)) {
    fail('blog/index.json 必須為陣列');
    return;
  }

  for (const post of posts) {
    if (!post.slug || typeof post.slug !== 'string') {
      fail(`部落格索引缺少 slug: ${JSON.stringify(post)}`);
    }
    if (!Array.isArray(post.tags)) {
      fail(`部落格文章缺少 tags 陣列: ${post.slug ?? '?'}`);
    }
    const mdPath = resolveFromRoot(PATHS.blogDir, `${post.slug}.md`);
    if (!fs.existsSync(mdPath)) {
      fail(`index.json 有 slug "${post.slug}"，但找不到 ${post.slug}.md`);
    }
  }
}

function main() {
  const tools = loadTools();
  validateToolsJson(tools);
  validateRoutes(tools);
  validateBlogIndex();

  if (errors.length > 0) {
    console.error('❌ 內容驗證失敗:\n');
    errors.forEach((e) => console.error(`  • ${e}`));
    process.exit(1);
  }

  console.log(`✅ 內容驗證通過（${tools.length} 個工具）`);
}

main();
