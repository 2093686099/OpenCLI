import { cli, Strategy } from '@jackwener/opencli/registry';
import { teableGet } from './utils.js';
import { resolveTableId } from './cache.js';

cli({
  site: 'teable',
  name: 'schema',
  description: '查看表的字段名、类型和选项（让 agent 能自省表结构）',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'table', required: true, positional: true, help: '表名或表 ID (tbl...)' },
  ],
  columns: ['name', 'type', 'id'],
  requiredEnv: [{ name: 'TEABLE_TOKEN', help: 'Teable API token (Bearer)' }],
  func: async (_page, kwargs) => {
    const tableId = await resolveTableId(kwargs.table);
    const data = await teableGet(`/api/table/${tableId}/field`);
    return (data || []).map(f => ({
      name: f.name,
      type: f.type,
      id: f.id,
      ...(f.options ? { options: JSON.stringify(f.options) } : {}),
    }));
  },
});
