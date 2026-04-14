import { cli, Strategy } from '@jackwener/opencli/registry';
import { teableDelete } from './utils.js';
import { resolveTableId } from './cache.js';

cli({
  site: 'teable',
  name: 'delete',
  description: '删除记录',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'table', required: true, positional: true, help: '表名或表 ID (tbl...)' },
    { name: 'record-id', required: true, positional: true, help: '记录 ID (rec...)' },
  ],
  columns: ['id', 'status'],
  requiredEnv: [{ name: 'TEABLE_TOKEN', help: 'Teable API token (Bearer)' }],
  func: async (_page, kwargs) => {
    const tableId = await resolveTableId(kwargs.table);
    await teableDelete(`/api/table/${tableId}/record/${kwargs['record-id']}`);
    return [{ id: kwargs['record-id'], status: 'deleted' }];
  },
});
