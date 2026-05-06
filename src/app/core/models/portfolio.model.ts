export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  /** 卡片封面圖 URL（可為外部連結或本地 assets/） */
  image?: string;
  tags: string[];
  /** GitHub / GitLab 原始碼連結 */
  sourceUrl?: string;
  /** 線上 Demo 連結 */
  demoUrl?: string;
  /** 是否在首頁精選展示 */
  featured?: boolean;
}
