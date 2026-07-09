/**
 * 內容同步（npm run content 的第一步）：
 * - blog/index.json ← 掃描 assets/blog/*.md
 * - README.md 工具列表 ← tools.json
 */
import fs from 'fs';
import path from 'path';
import { PATHS, resolveFromRoot } from './lib/paths.mjs';
import { loadTools } from './lib/tools.mjs';

const BLOG_DIR = resolveFromRoot(PATHS.blogDir);
const README_PATH = resolveFromRoot(PATHS.readme);

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    return { body: content, meta: {} };
  }

  const meta = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');

    if (key === 'tags') {
      meta.tags = value
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      meta[key] = value;
    }
  }

  return { body: content.slice(match[0].length), meta };
}

function syncBlog() {
  if (!fs.existsSync(BLOG_DIR)) {
    fs.mkdirSync(BLOG_DIR, { recursive: true });
  }

  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const filePath = path.join(BLOG_DIR, f);
      const content = fs.readFileSync(filePath, 'utf-8');
      const stats = fs.statSync(filePath);
      const { body, meta } = parseFrontmatter(content);
      const slug = f.replace(/\.md$/, '');

      const titleMatch = body.match(/^#\s+(.+)$/m);
      const title = meta.title ?? (titleMatch ? titleMatch[1] : slug);
      const date =
        meta.date ?? stats.mtime.toISOString().split('T')[0];
      const summary =
        meta.summary ??
        body.substring(0, 100).replace(/#+\s/g, '').replace(/\n/g, ' ').trim() +
          '...';

      return {
        slug,
        title,
        date,
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        summary,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  fs.writeFileSync(
    path.join(BLOG_DIR, 'index.json'),
    `${JSON.stringify(files, null, 2)}\n`,
    'utf-8'
  );
  console.log(`✅ Blog 索引已更新（${files.length} 篇）`);
}

function syncReadme() {
  const tools = loadTools();
  let readmeContent = fs.readFileSync(README_PATH, 'utf-8');

  const toolsList = tools
    .map((t, i) => `${i + 1}. **${t.name}**：${t.description}`)
    .join('\n');

  const startMarker = '## 🛠️ 目前已集成的工具';
  const endMarker = '## 📦 內容與維護';
  const legacyEndMarker = '## 🚀 技術棧';
  const end = readmeContent.includes(endMarker) ? endMarker : legacyEndMarker;

  const regex = new RegExp(`${startMarker}[\\s\\S]*?(?=${end})`);
  const newSection = `${startMarker}\n\n${toolsList}\n\n`;

  if (readmeContent.match(regex)) {
    readmeContent = readmeContent.replace(regex, newSection);
    fs.writeFileSync(README_PATH, readmeContent, 'utf-8');
    console.log('✅ README.md 工具列表已同步');
  } else {
    console.warn('⚠️ README.md 找不到工具區塊標記，略過同步');
  }
}

try {
  syncBlog();
  syncReadme();
} catch (e) {
  console.error('❌ sync-content 失敗:', e);
  process.exit(1);
}
