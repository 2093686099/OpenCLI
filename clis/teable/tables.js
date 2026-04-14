import { cli, Strategy } from '@jackwener/opencli/registry';
import { teableGet } from './utils.js';
import { resolveBaseId } from './cache.js';

cli({
  site: 'teable',
  name: 'tables',
  description: '列出 base 下的所有表',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'base', required: true, positional: true, help: 'Base 名称或 ID (bse...)' },
  ],
  columns: ['id', 'name'],
  requiredEnv: [{ name: 'TEABLE_TOKEN', help: 'Teable API token (Bearer)' }],
  func: async (_page, kwargs) => {
    const baseId = await resolveBaseId(kwargs.base);
    const data = await teableGet(`/api/base/${baseId}/table`);
    return (data || []).map(t => ({ id: t.id, name: t.name }));
  },
});
