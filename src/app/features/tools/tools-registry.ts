import { ToolEntry } from '../../core/models/tool.model';

export const TOOLS_REGISTRY = [
  {
    id: 'json-formatter',
    name: 'JSON 格式化工具',
    description: '貼上 JSON 字串進行格式化、語法驗證與高亮顯示。',
    icon: 'data_object',
    route: 'json-formatter',
  },
] as const satisfies readonly ToolEntry[];
