import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 專案根目錄（scripts/lib 的上兩層） */
export const ROOT = path.resolve(__dirname, '../..');

export const PATHS = {
  toolsJson: 'src/assets/data/tools.json',
  siteJson: 'src/assets/data/site.json',
  routesFile: 'src/app/app.routes.ts',
  blogDir: 'src/assets/blog',
  toolsFeatureDir: 'src/app/features/tools',
  readme: 'README.md',
};

export function resolveFromRoot(...segments) {
  return path.join(ROOT, ...segments);
}
