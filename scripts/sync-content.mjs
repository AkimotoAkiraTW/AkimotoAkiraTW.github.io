import fs from 'fs';
import path from 'path';

const BLOG_DIR = 'src/assets/blog';
const SITE_JSON = 'src/assets/data/site.json';
const README_FILE = 'README.md';

/**
 * 1. 自動掃描並更新 Blog 索引
 */
function syncBlog() {
  const files = fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const content = fs.readFileSync(path.join(BLOG_DIR, f), 'utf-8');
      const stats = fs.statSync(path.join(BLOG_DIR, f));
      
      // 提取第一個 # 標題
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : f.replace('.md', '');
      
      return {
        id: f.replace('.md', ''),
        title: title,
        date: stats.mtime.toISOString().split('T')[0],
        summary: content.substring(0, 100).replace(/#+\s/g, '').replace(/\n/g, ' ') + '...'
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  fs.writeFileSync(path.join(BLOG_DIR, 'index.json'), JSON.stringify(files, null, 2));
  console.log('✅ Blog 索引已自動更新');
}

/**
 * 2. 根據 site.json 自動同步 README.md
 */
function syncReadme() {
  const siteData = JSON.parse(fs.readFileSync(SITE_JSON, 'utf-8'));
  let readmeContent = fs.readFileSync(README_FILE, 'utf-8');

  const toolsList = siteData.tools.map((t, i) => {
    return `${i + 1}. **${t.name}**：${t.description}`;
  }).join('\n');

  // 使用正則表達式尋找標籤區塊並替換
  const startMarker = '## 🛠️ 目前已集成的工具';
  const endMarker = '## 🚀 技術棧';
  
  const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
  const newSection = `${startMarker}\n\n${toolsList}\n\n${endMarker}`;
  
  if (readmeContent.match(regex)) {
    readmeContent = readmeContent.replace(regex, newSection);
    fs.writeFileSync(README_FILE, readmeContent);
    console.log('✅ README.md 工具列表已同步');
  }
}

// 執行
try {
  syncBlog();
  syncReadme();
} catch (e) {
  console.error('❌ 自動化腳本執行失敗:', e);
}
