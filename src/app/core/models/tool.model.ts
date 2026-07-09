export type ToolCategory = 'work' | 'life';

export interface ToolEntry {
  id: string;
  name: string;
  description: string;
  /** Material Icon 名稱 */
  icon: string;
  /** /tools/ 後的路徑片段（須與 id 相同） */
  route: string;
  /** 工具分類（選填，供日後分組使用） */
  category?: ToolCategory;
}
