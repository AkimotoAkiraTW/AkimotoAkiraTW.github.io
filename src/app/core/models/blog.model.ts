export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  summary: string;
  category?: string; // 預留分類欄位
}

/** 標籤統計介面 */
export interface TagCount {
  tag: string;
  count: number;
}

/** 時間軸分組介面 */
export interface ArchiveGroup {
  year: number;
  posts: BlogPost[];
}

/** 上下篇導覽介面 */
export interface PostNavigation {
  prev: BlogPost | null;
  next: BlogPost | null;
}
