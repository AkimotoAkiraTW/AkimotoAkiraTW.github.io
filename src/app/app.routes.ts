import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'KC | 全端工程師',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'resume',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'portfolio',
    title: '作品集 | KC',
    loadComponent: () => import('./features/portfolio/portfolio.component').then(m => m.PortfolioComponent),
  },
  {
    path: 'blog',
    title: '技術隨筆 | KC',
    loadComponent: () => import('./features/blog/blog-list.component').then(m => m.BlogListComponent),
  },
  {
    path: 'blog/:slug',
    title: '文章內容 | KC',
    loadComponent: () => import('./features/blog/blog-post.component').then(m => m.BlogPostComponent),
  },
  {
    path: 'tools',
    title: '工具箱 | KC',
    loadComponent: () => import('./features/tools/tools.component').then(m => m.ToolsComponent),
  },
  {
    path: 'tools/json-formatter',
    title: 'JSON 格式化工具 | KC',
    loadComponent: () => import('./features/tools/json-formatter/json-formatter.component').then(m => m.JsonFormatterComponent),
  },
  {
    path: 'tools/uber-eats-settlement',
    title: 'Uber Eats 對帳工具 | KC',
    loadComponent: () => import('./features/tools/uber-eats-settlement/uber-eats-settlement.component').then(m => m.UberEatsSettlementComponent),
  },
  {
    path: 'tools/connection-checker',
    title: 'Connection Checker | KC',
    loadComponent: () => import('./features/tools/connection-checker/connection-checker.component').then(m => m.ConnectionCheckerComponent),
  },
  {
    path: 'tools/number-to-chinese',
    title: '數字轉中文大寫 | KC',
    loadComponent: () => import('./features/tools/number-to-chinese/number-to-chinese.component').then(m => m.NumberToChineseComponent),
  },
  {
    path: 'tools/markdown-editor',
    title: '智慧編輯器 | KC',
    loadComponent: () => import('./features/tools/markdown-editor/markdown-editor.component').then(m => m.MarkdownEditorComponent),
  },
  {
    path: 'tools/media-declaration-parser',
    title: '媒體申報檔解析工具 | KC',
    loadComponent: () => import('./features/tools/media-declaration-parser/media-declaration-parser.component').then(m => m.MediaDeclarationParserComponent),
  },
  {
    path: 'tools/tradevan-parser',
    title: '關貿 CSV 解析工具 | KC',
    loadComponent: () => import('./features/tools/tradevan-parser/tradevan-parser.component').then(m => m.TradevanParserComponent),
  },
  {
    path: 'tools/barcode-generator',
    title: '條碼與 QR Code 產生器 | KC',
    loadComponent: () => import('./features/tools/barcode-generator/barcode-generator.component').then(m => m.BarcodeGeneratorComponent),
  },
  {
    path: 'tools/barcode-scanner',
    title: '條碼掃描器 | KC',
    loadComponent: () => import('./features/tools/barcode-scanner/barcode-scanner.component').then(m => m.BarcodeScannerComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
