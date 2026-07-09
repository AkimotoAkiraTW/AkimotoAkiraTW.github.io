import fs from 'fs';
import { PATHS, resolveFromRoot } from './paths.mjs';

const ROUTES_PATH = resolveFromRoot(PATHS.routesFile);

/** 從 app.routes.ts 解析 tools/<segment> 路徑（不含 tools 列表頁） */
export function parseToolRoutesFromFile() {
  const source = fs.readFileSync(ROUTES_PATH, 'utf-8');
  const matches = [...source.matchAll(/path:\s*'tools\/([^']+)'/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

/**
 * 在 app.routes.ts 的 catch-all 之前插入新工具路由
 * @param {{ route: string; name: string; componentClass: string; folder: string }} spec
 */
export function appendToolRoute(spec) {
  let source = fs.readFileSync(ROUTES_PATH, 'utf-8');
  const pathKey = `tools/${spec.route}`;
  if (source.includes(`path: '${pathKey}'`)) {
    throw new Error(`路由已存在: ${pathKey}`);
  }

  const block = `  {
    path: '${pathKey}',
    title: '${spec.name} | KC',
    loadComponent: () => import('./features/tools/${spec.folder}/${spec.folder}.component').then(m => m.${spec.componentClass}),
  },
`;

  const marker = "  {\n    path: '**',";
  if (!source.includes(marker)) {
    throw new Error('找不到插入點（path: \'**\'）');
  }
  source = source.replace(marker, `${block}${marker}`);
  fs.writeFileSync(ROUTES_PATH, source, 'utf-8');
}
