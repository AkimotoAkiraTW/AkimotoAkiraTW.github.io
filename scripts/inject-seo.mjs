import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DIST_DIR = join(process.cwd(), 'dist/portfolio/browser');
const INDEX_FILE = join(DIST_DIR, 'index.html');
const SITE_JSON = join(process.cwd(), 'src/assets/data/site.json');

try {
  // 1. 讀取設定檔
  const siteConfig = JSON.parse(readFileSync(SITE_JSON, 'utf-8'));
  
  // 2. 讀取建置後的 index.html
  let indexContent = readFileSync(INDEX_FILE, 'utf-8');

  // 3. 替換 SEO 標籤與標題
  // 替換 <title>
  indexContent = indexContent.replace(
    /<title>.*?<\/title>/g,
    `<title>${siteConfig.siteTitle}</title>`
  );

  // 替換 meta title (og:title, twitter:title, name="title")
  indexContent = indexContent.replace(
    /content="[^"]*\|\s*全端工程師"/g,
    `content="${siteConfig.siteTitle}"`
  );

  // 替換 meta description
  indexContent = indexContent.replace(
    /content="KC 的個人網站。[^"]*"/g,
    `content="${siteConfig.siteDescription}"`
  );

  // 替換 URL
  indexContent = indexContent.replace(
    /content="https:\/\/AkimotoAkiraTW\.github\.io\/"/g,
    `content="${siteConfig.siteUrl}/"`
  );

  // 4. 寫回檔案
  writeFileSync(INDEX_FILE, indexContent, 'utf-8');
  console.log('✅ 成功將 site.json 的 SEO 資訊注入至 index.html');

} catch (error) {
  console.error('❌ SEO 注入失敗:', error);
  process.exit(1);
}
